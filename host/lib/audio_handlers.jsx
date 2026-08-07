function aeAudioIsFiniteNumber(value) {
    return typeof value === "number" && !isNaN(value) && isFinite(value);
}

function aeGetAudioLevelsProperty(layer) {
    if (!layer || !(layer instanceof AVLayer)) {
        return null;
    }
    var audioGroup = layer.property("ADBE Audio Group");
    if (!audioGroup) {
        return null;
    }
    return audioGroup.property("ADBE Audio Levels");
}

function aeAudioPropertyBound(property, boundName, fallback) {
    try {
        var value = Number(property[boundName]);
        if (!isNaN(value) && isFinite(value)) {
            return value;
        }
    } catch (e) {}
    return fallback;
}

function aeAudioLevelsArray(value) {
    if (value instanceof Array && value.length >= 2) {
        return [Number(value[0]), Number(value[1])];
    }
    if (value instanceof Array && value.length === 1) {
        return [Number(value[0]), Number(value[0])];
    }
    var scalar = Number(value);
    if (!isNaN(scalar) && isFinite(scalar)) {
        return [scalar, scalar];
    }
    return [0, 0];
}

function aeAudioLayerHasAudio(layer) {
    if (!layer || !(layer instanceof AVLayer)) {
        return false;
    }
    try {
        return layer.hasAudio === true;
    } catch (e) {
        return false;
    }
}

function aeAudioLayerSummary(layer) {
    var hasAudio = aeAudioLayerHasAudio(layer);
    var enabled = false;
    try {
        enabled = hasAudio && layer.audioEnabled === true;
    } catch (eEnabled) {}

    var summary = {
        hasAudio: hasAudio,
        enabled: enabled,
        muted: hasAudio ? !enabled : null,
        levelDb: null,
        levelsDb: null,
        currentLevelsDb: null,
        keyframeCount: 0,
        keyframes: []
    };
    if (!hasAudio) {
        return summary;
    }

    var levels = aeGetAudioLevelsProperty(layer);
    if (!levels) {
        return summary;
    }
    var currentLevels = aeAudioLevelsArray(levels.value);
    var nominalLevels = [currentLevels[0], currentLevels[1]];
    summary.currentLevelsDb = currentLevels;
    summary.keyframeCount = levels.numKeys;
    for (var i = 1; i <= levels.numKeys; i++) {
        var keyLevels = aeAudioLevelsArray(levels.keyValue(i));
        nominalLevels[0] = Math.max(nominalLevels[0], keyLevels[0]);
        nominalLevels[1] = Math.max(nominalLevels[1], keyLevels[1]);
        summary.keyframes.push({
            time: levels.keyTime(i),
            levelsDb: keyLevels
        });
    }
    summary.levelsDb = nominalLevels;
    if (Math.abs(nominalLevels[0] - nominalLevels[1]) < 0.0001) {
        summary.levelDb = nominalLevels[0];
    }
    return summary;
}

function aeRemoveAudioLevelKeyframes(levels) {
    for (var i = levels.numKeys; i >= 1; i--) {
        levels.removeKey(i);
    }
}

function aeSetAudioKeyframesLinear(levels) {
    for (var i = 1; i <= levels.numKeys; i++) {
        try {
            levels.setInterpolationTypeAtKey(
                i,
                KeyframeInterpolationType.LINEAR,
                KeyframeInterpolationType.LINEAR
            );
        } catch (e) {}
    }
}

function aeValidateAudioSettings(layer, audioSpec) {
    if (!audioSpec || typeof audioSpec !== "object" || audioSpec instanceof Array) {
        throw new Error("audio settings must be an object.");
    }
    if (!aeAudioLayerHasAudio(layer)) {
        throw new Error("Target layer does not contain audio.");
    }
    var allowedKeys = { muted: true, levelDb: true, fadeIn: true, fadeOut: true };
    var hasSetting = false;
    for (var key in audioSpec) {
        if (!audioSpec.hasOwnProperty(key)) {
            continue;
        }
        if (!allowedKeys[key]) {
            throw new Error("Unknown audio setting: " + key);
        }
        hasSetting = true;
    }
    if (!hasSetting) {
        throw new Error("Provide muted, levelDb, fadeIn, or fadeOut.");
    }
    if (audioSpec.muted !== undefined && typeof audioSpec.muted !== "boolean") {
        throw new Error("muted must be a boolean when specified.");
    }
    if (audioSpec.levelDb !== undefined && !aeAudioIsFiniteNumber(audioSpec.levelDb)) {
        throw new Error("levelDb must be a finite number when specified.");
    }
    if (audioSpec.fadeIn !== undefined
        && (!aeAudioIsFiniteNumber(audioSpec.fadeIn) || audioSpec.fadeIn < 0)) {
        throw new Error("fadeIn must be a finite number greater than or equal to 0.");
    }
    if (audioSpec.fadeOut !== undefined
        && (!aeAudioIsFiniteNumber(audioSpec.fadeOut) || audioSpec.fadeOut < 0)) {
        throw new Error("fadeOut must be a finite number greater than or equal to 0.");
    }

    var levels = aeGetAudioLevelsProperty(layer);
    if (!levels) {
        throw new Error("Audio Levels property was not found on the target layer.");
    }
    if (audioSpec.levelDb !== undefined) {
        var minDb = aeAudioPropertyBound(levels, "minValue", -192);
        var maxDb = aeAudioPropertyBound(levels, "maxValue", 24);
        if (audioSpec.levelDb < minDb || audioSpec.levelDb > maxDb) {
            throw new Error("levelDb must be between " + minDb + " and " + maxDb + ".");
        }
    }

    var fadeIn = audioSpec.fadeIn !== undefined ? Number(audioSpec.fadeIn) : 0;
    var fadeOut = audioSpec.fadeOut !== undefined ? Number(audioSpec.fadeOut) : 0;
    var layerDuration = Number(layer.outPoint) - Number(layer.inPoint);
    if (fadeIn + fadeOut > layerDuration + 0.0001) {
        throw new Error(
            "fadeIn + fadeOut exceeds layer duration (" + layerDuration + ")."
        );
    }
    return levels;
}

function aeApplyAudioSettings(layer, audioSpec, replaceLevels) {
    var levels = aeValidateAudioSettings(layer, audioSpec);
    var operationCount = 0;

    if (audioSpec.muted !== undefined || replaceLevels === true) {
        var shouldEnable = audioSpec.muted !== true;
        if (layer.audioEnabled !== shouldEnable) {
            layer.audioEnabled = shouldEnable;
            operationCount += 1;
        }
    }

    var shouldApplyLevels = replaceLevels === true
        || audioSpec.levelDb !== undefined
        || audioSpec.fadeIn !== undefined
        || audioSpec.fadeOut !== undefined;
    if (shouldApplyLevels) {
        var levelDb = audioSpec.levelDb !== undefined ? Number(audioSpec.levelDb) : 0;
        var fadeIn = audioSpec.fadeIn !== undefined ? Number(audioSpec.fadeIn) : 0;
        var fadeOut = audioSpec.fadeOut !== undefined ? Number(audioSpec.fadeOut) : 0;
        var baseLevels = [levelDb, levelDb];
        var silenceDb = aeAudioPropertyBound(levels, "minValue", -192);
        var silenceLevels = [silenceDb, silenceDb];
        var inPoint = Number(layer.inPoint);
        var outPoint = Number(layer.outPoint);

        aeRemoveAudioLevelKeyframes(levels);
        if (fadeIn <= 0 && fadeOut <= 0) {
            levels.setValue(baseLevels);
        } else {
            if (fadeIn > 0) {
                levels.setValueAtTime(inPoint, silenceLevels);
                levels.setValueAtTime(inPoint + fadeIn, baseLevels);
            } else {
                levels.setValueAtTime(inPoint, baseLevels);
            }
            if (fadeOut > 0) {
                levels.setValueAtTime(outPoint - fadeOut, baseLevels);
                levels.setValueAtTime(outPoint, silenceLevels);
            } else {
                levels.setValueAtTime(outPoint, baseLevels);
            }
            aeSetAudioKeyframesLinear(levels);
        }
        operationCount += 1;
    }

    return {
        operationCount: operationCount,
        audio: aeAudioLayerSummary(layer)
    };
}

function getLayerAudio(layerId, layerName) {
    try {
        ensureJSON();
        var comp = app.project ? app.project.activeItem : null;
        var resolved = aeResolveLayer(comp, layerId, layerName);
        if (resolved.error) {
            return encodePayload({ status: "error", message: resolved.error });
        }
        return encodePayload({
            status: "success",
            layerId: resolved.layer.index,
            layerUid: aeTryGetLayerUid(resolved.layer),
            layerName: resolved.layer.name,
            audio: aeAudioLayerSummary(resolved.layer)
        });
    } catch (e) {
        log("getLayerAudio() threw: " + e.toString());
        return encodePayload({ status: "error", message: e.toString() });
    }
}

function setLayerAudio(layerId, layerName, audioJSON) {
    try {
        ensureJSON();
        var audioSpec = JSON.parse(audioJSON);
        var comp = app.project ? app.project.activeItem : null;
        var resolved = aeResolveLayer(comp, layerId, layerName);
        if (resolved.error) {
            return encodePayload({ status: "error", message: resolved.error });
        }
        var applied = aeApplyAudioSettings(resolved.layer, audioSpec, false);
        return encodePayload({
            status: "success",
            layerId: resolved.layer.index,
            layerUid: aeTryGetLayerUid(resolved.layer),
            layerName: resolved.layer.name,
            operations: applied.operationCount,
            audio: applied.audio
        });
    } catch (e) {
        log("setLayerAudio() threw: " + e.toString());
        return encodePayload({ status: "error", message: e.toString() });
    }
}
