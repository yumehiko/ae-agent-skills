function aeValidateSceneSpec(scene) {
    var errors = [];
    if (!scene || typeof scene !== "object" || scene instanceof Array) {
        errors.push("scene must be an object.");
        return { ok: false, errors: errors };
    }

    var comp = scene.composition;
    if (comp !== undefined) {
        if (!comp || typeof comp !== "object" || comp instanceof Array) {
            errors.push("composition must be an object when specified.");
        } else {
            if (comp.compId !== undefined && (!aeIsFiniteNumber(comp.compId) || comp.compId <= 0)) {
                errors.push("composition.compId must be a positive number when specified.");
            }
            if (comp.compName !== undefined && typeof comp.compName !== "string") {
                errors.push("composition.compName must be a string when specified.");
            }
            if (comp.name !== undefined && typeof comp.name !== "string") {
                errors.push("composition.name must be a string when specified.");
            }
            if (comp.width !== undefined && (!aeIsFiniteNumber(comp.width) || comp.width <= 0)) {
                errors.push("composition.width must be a positive number when specified.");
            }
            if (comp.height !== undefined && (!aeIsFiniteNumber(comp.height) || comp.height <= 0)) {
                errors.push("composition.height must be a positive number when specified.");
            }
            if (comp.duration !== undefined && (!aeIsFiniteNumber(comp.duration) || comp.duration <= 0)) {
                errors.push("composition.duration must be a positive number when specified.");
            }
            if (comp.frameRate !== undefined && (!aeIsFiniteNumber(comp.frameRate) || comp.frameRate <= 0)) {
                errors.push("composition.frameRate must be a positive number when specified.");
            }
            if (comp.pixelAspect !== undefined && (!aeIsFiniteNumber(comp.pixelAspect) || comp.pixelAspect <= 0)) {
                errors.push("composition.pixelAspect must be a positive number when specified.");
            }
            if (comp.createIfMissing !== undefined && typeof comp.createIfMissing !== "boolean") {
                errors.push("composition.createIfMissing must be a boolean when specified.");
            }
            if (comp.setActive !== undefined && typeof comp.setActive !== "boolean") {
                errors.push("composition.setActive must be a boolean when specified.");
            }
        }
    }

    var layers = scene.layers;
    if (layers !== undefined) {
        if (!(layers instanceof Array)) {
            errors.push("layers must be an array when specified.");
        } else {
            var seenIds = {};
            for (var i = 0; i < layers.length; i++) {
                var layer = layers[i];
                var prefix = "layers[" + i + "]";
                if (!layer || typeof layer !== "object" || layer instanceof Array) {
                    errors.push(prefix + " must be an object.");
                    continue;
                }
                if (layer.id !== undefined) {
                    if (typeof layer.id !== "string" || layer.id.length === 0) {
                        errors.push(prefix + ".id must be a non-empty string when specified.");
                    } else if (seenIds[layer.id]) {
                        errors.push(prefix + ".id is duplicated: " + layer.id);
                    } else {
                        seenIds[layer.id] = true;
                    }
                }
                if (layer.type === undefined || typeof layer.type !== "string") {
                    errors.push(prefix + ".type is required and must be a string.");
                } else {
                    var normalizedType = String(layer.type).toLowerCase();
                    if (
                        normalizedType !== "text"
                        && normalizedType !== "null"
                        && normalizedType !== "solid"
                        && normalizedType !== "shape"
                        && normalizedType !== "comp"
                    ) {
                        errors.push(prefix + ".type must be one of: text, null, solid, shape, comp.");
                    }
                    if (normalizedType === "comp") {
                        var hasRefCompId = layer.refCompId !== undefined;
                        var hasRefCompName = layer.refCompName !== undefined;
                        if (!hasRefCompId && !hasRefCompName) {
                            errors.push(prefix + " requires refCompId or refCompName when type is comp.");
                        }
                    } else if (layer.refCompId !== undefined || layer.refCompName !== undefined) {
                        errors.push(prefix + ".refCompId/refCompName are only allowed when type is comp.");
                    }
                }
                if (layer.name !== undefined && typeof layer.name !== "string") {
                    errors.push(prefix + ".name must be a string when specified.");
                }
                if (layer.refCompId !== undefined && (!aeIsFiniteNumber(layer.refCompId) || layer.refCompId <= 0)) {
                    errors.push(prefix + ".refCompId must be a positive number when specified.");
                }
                if (
                    layer.refCompName !== undefined
                    && (typeof layer.refCompName !== "string" || String(layer.refCompName).length === 0)
                ) {
                    errors.push(prefix + ".refCompName must be a non-empty string when specified.");
                }
                if (layer.text !== undefined && typeof layer.text !== "string") {
                    errors.push(prefix + ".text must be a string when specified.");
                }

                var timing = layer.timing;
                if (timing !== undefined) {
                    if (!timing || typeof timing !== "object" || timing instanceof Array) {
                        errors.push(prefix + ".timing must be an object when specified.");
                    } else {
                        if (timing.inPoint !== undefined) {
                            aeRequireFiniteNumber(timing.inPoint, prefix + ".timing.inPoint", errors);
                        }
                        if (timing.outPoint !== undefined) {
                            aeRequireFiniteNumber(timing.outPoint, prefix + ".timing.outPoint", errors);
                        }
                        if (timing.startTime !== undefined) {
                            aeRequireFiniteNumber(timing.startTime, prefix + ".timing.startTime", errors);
                        }
                    }
                }

                var transform = layer.transform;
                if (transform !== undefined && (!transform || typeof transform !== "object" || transform instanceof Array)) {
                    errors.push(prefix + ".transform must be an object when specified.");
                }

                if (layer.parentId !== undefined && layer.parentId !== null && typeof layer.parentId !== "string") {
                    errors.push(prefix + ".parentId must be a string or null when specified.");
                }

                var propertyValues = layer.propertyValues;
                if (propertyValues !== undefined) {
                    if (!(propertyValues instanceof Array)) {
                        errors.push(prefix + ".propertyValues must be an array when specified.");
                    } else {
                        for (var j = 0; j < propertyValues.length; j++) {
                            var pv = propertyValues[j];
                            var pvPrefix = prefix + ".propertyValues[" + j + "]";
                            if (!pv || typeof pv !== "object" || pv instanceof Array) {
                                errors.push(pvPrefix + " must be an object.");
                                continue;
                            }
                            if (typeof pv.propertyPath !== "string" || pv.propertyPath.length === 0) {
                                errors.push(pvPrefix + ".propertyPath is required and must be a string.");
                            }
                            if (pv.value === undefined) {
                                errors.push(pvPrefix + ".value is required.");
                            }
                        }
                    }
                }

                var effects = layer.effects;
                if (effects !== undefined) {
                    if (!(effects instanceof Array)) {
                        errors.push(prefix + ".effects must be an array when specified.");
                    } else {
                        for (var k = 0; k < effects.length; k++) {
                            var effect = effects[k];
                            var effectPrefix = prefix + ".effects[" + k + "]";
                            if (!effect || typeof effect !== "object" || effect instanceof Array) {
                                errors.push(effectPrefix + " must be an object.");
                                continue;
                            }
                            if (typeof effect.matchName !== "string" || effect.matchName.length === 0) {
                                errors.push(effectPrefix + ".matchName is required and must be a string.");
                            }
                            if (effect.name !== undefined && typeof effect.name !== "string") {
                                errors.push(effectPrefix + ".name must be a string when specified.");
                            }
                            if (effect.params !== undefined) {
                                if (!(effect.params instanceof Array)) {
                                    errors.push(effectPrefix + ".params must be an array when specified.");
                                } else {
                                    for (var p = 0; p < effect.params.length; p++) {
                                        var param = effect.params[p];
                                        var paramPrefix = effectPrefix + ".params[" + p + "]";
                                        if (!param || typeof param !== "object" || param instanceof Array) {
                                            errors.push(paramPrefix + " must be an object.");
                                            continue;
                                        }
                                        if (param.value === undefined) {
                                            errors.push(paramPrefix + ".value is required.");
                                        }
                                        var hasParamPath = typeof param.propertyPath === "string" && param.propertyPath.length > 0;
                                        var hasParamMatchName = typeof param.matchName === "string" && param.matchName.length > 0;
                                        var hasParamIndex = param.propertyIndex !== undefined;
                                        var selectorCount = 0;
                                        if (hasParamPath) selectorCount += 1;
                                        if (hasParamMatchName) selectorCount += 1;
                                        if (hasParamIndex) selectorCount += 1;
                                        if (selectorCount !== 1) {
                                            errors.push(paramPrefix + " must specify exactly one of propertyPath, matchName, propertyIndex.");
                                        }
                                        if (hasParamIndex) {
                                            var parsedIndex = parseInt(param.propertyIndex, 10);
                                            if (isNaN(parsedIndex) || parsedIndex <= 0) {
                                                errors.push(paramPrefix + ".propertyIndex must be a positive integer.");
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                var repeaters = layer.repeaters;
                if (repeaters !== undefined) {
                    if (!(repeaters instanceof Array)) {
                        errors.push(prefix + ".repeaters must be an array when specified.");
                    } else {
                        for (var rp = 0; rp < repeaters.length; rp++) {
                            var repeater = repeaters[rp];
                            var repeaterPrefix = prefix + ".repeaters[" + rp + "]";
                            if (!repeater || typeof repeater !== "object" || repeater instanceof Array) {
                                errors.push(repeaterPrefix + " must be an object.");
                                continue;
                            }
                            if (
                                repeater.groupIndex !== undefined
                                && (!aeIsFiniteNumber(repeater.groupIndex) || repeater.groupIndex <= 0)
                            ) {
                                errors.push(repeaterPrefix + ".groupIndex must be a positive number when specified.");
                            }
                        }
                    }
                }

                var expressions = layer.expressions;
                if (expressions !== undefined) {
                    if (!(expressions instanceof Array)) {
                        errors.push(prefix + ".expressions must be an array when specified.");
                    } else {
                        for (var e = 0; e < expressions.length; e++) {
                            var exp = expressions[e];
                            var expPrefix = prefix + ".expressions[" + e + "]";
                            if (!exp || typeof exp !== "object" || exp instanceof Array) {
                                errors.push(expPrefix + " must be an object.");
                                continue;
                            }
                            if (typeof exp.propertyPath !== "string" || exp.propertyPath.length === 0) {
                                errors.push(expPrefix + ".propertyPath is required and must be a string.");
                            }
                            if (typeof exp.expression !== "string") {
                                errors.push(expPrefix + ".expression is required and must be a string.");
                            }
                        }
                    }
                }

                var essentialProperties = layer.essentialProperties;
                if (essentialProperties !== undefined) {
                    if (!(essentialProperties instanceof Array)) {
                        errors.push(prefix + ".essentialProperties must be an array when specified.");
                    } else {
                        for (var q = 0; q < essentialProperties.length; q++) {
                            var ep = essentialProperties[q];
                            var epPrefix = prefix + ".essentialProperties[" + q + "]";
                            if (!ep || typeof ep !== "object" || ep instanceof Array) {
                                errors.push(epPrefix + " must be an object.");
                                continue;
                            }
                            if (typeof ep.propertyPath !== "string" || ep.propertyPath.length === 0) {
                                errors.push(epPrefix + ".propertyPath is required and must be a string.");
                            }
                            if (ep.essentialName !== undefined && typeof ep.essentialName !== "string") {
                                errors.push(epPrefix + ".essentialName must be a string when specified.");
                            }
                        }
                    }
                }

                var animations = layer.animations;
                if (animations !== undefined) {
                    if (!(animations instanceof Array)) {
                        errors.push(prefix + ".animations must be an array when specified.");
                    } else {
                        for (var m = 0; m < animations.length; m++) {
                            var animation = animations[m];
                            var animationPrefix = prefix + ".animations[" + m + "]";
                            if (!animation || typeof animation !== "object" || animation instanceof Array) {
                                errors.push(animationPrefix + " must be an object.");
                                continue;
                            }
                            if (typeof animation.propertyPath !== "string" || animation.propertyPath.length === 0) {
                                errors.push(animationPrefix + ".propertyPath is required and must be a string.");
                            }
                            if (!(animation.keyframes instanceof Array) || animation.keyframes.length === 0) {
                                errors.push(animationPrefix + ".keyframes must be a non-empty array.");
                            } else {
                                for (var n = 0; n < animation.keyframes.length; n++) {
                                    var keyframe = animation.keyframes[n];
                                    var keyPrefix = animationPrefix + ".keyframes[" + n + "]";
                                    if (!keyframe || typeof keyframe !== "object" || keyframe instanceof Array) {
                                        errors.push(keyPrefix + " must be an object.");
                                        continue;
                                    }
                                    if (!aeRequireFiniteNumber(keyframe.time, keyPrefix + ".time", errors)) {
                                        continue;
                                    }
                                    if (keyframe.value === undefined) {
                                        errors.push(keyPrefix + ".value is required.");
                                    }
                                    if (
                                        keyframe.inInterp !== undefined
                                        && keyframe.inInterp !== "linear"
                                        && keyframe.inInterp !== "bezier"
                                        && keyframe.inInterp !== "hold"
                                    ) {
                                        errors.push(keyPrefix + ".inInterp must be linear, bezier, or hold.");
                                    }
                                    if (
                                        keyframe.outInterp !== undefined
                                        && keyframe.outInterp !== "linear"
                                        && keyframe.outInterp !== "bezier"
                                        && keyframe.outInterp !== "hold"
                                    ) {
                                        errors.push(keyPrefix + ".outInterp must be linear, bezier, or hold.");
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    return { ok: errors.length === 0, errors: errors };
}

function aeResolveSceneComp(spec, mutate) {
    var compSpec = spec.composition || {};
    var targetComp = null;
    var hasCompId = compSpec.compId !== undefined;
    var hasCompName = compSpec.compName !== undefined && String(compSpec.compName).length > 0;
    var createIfMissing = compSpec.createIfMissing !== false;
    var shouldSetActive = compSpec.setActive !== false;

    if (hasCompId || hasCompName) {
        targetComp = findCompByIdOrName(hasCompId ? compSpec.compId : null, hasCompName ? compSpec.compName : null);
        if (!targetComp) {
            throw new Error("Specified composition was not found.");
        }
        if (mutate && shouldSetActive) {
            aeInvokeMutation(
                setActiveComp,
                [hasCompId ? compSpec.compId : null, hasCompName ? compSpec.compName : null],
                "setActiveComp"
            );
            targetComp = app.project.activeItem;
        }
    } else if (compSpec.name !== undefined) {
        targetComp = findCompByIdOrName(null, compSpec.name);
        if (!targetComp && !createIfMissing) {
            throw new Error("composition.name was not found and createIfMissing is false.");
        }
        if (!targetComp && mutate) {
            var compWidth = compSpec.width !== undefined ? compSpec.width : 1920;
            var compHeight = compSpec.height !== undefined ? compSpec.height : 1080;
            var compDuration = compSpec.duration !== undefined ? compSpec.duration : 8.0;
            var compFrameRate = compSpec.frameRate !== undefined ? compSpec.frameRate : 30.0;
            var compPixelAspect = compSpec.pixelAspect !== undefined ? compSpec.pixelAspect : 1.0;
            aeInvokeMutation(
                createComp,
                [compSpec.name, compWidth, compHeight, compPixelAspect, compDuration, compFrameRate],
                "createComp"
            );
            targetComp = app.project.activeItem;
        } else if (targetComp && mutate && shouldSetActive) {
            aeInvokeMutation(setActiveComp, [targetComp.id, null], "setActiveComp");
            targetComp = app.project.activeItem;
        }
    } else {
        targetComp = app.project && app.project.activeItem ? app.project.activeItem : null;
        if (!targetComp || !(targetComp instanceof CompItem)) {
            throw new Error("No target composition available. Provide composition settings or open an active comp.");
        }
    }

    if (!targetComp || !(targetComp instanceof CompItem)) {
        throw new Error("Resolved composition is invalid.");
    }
    return targetComp;
}

function aeResolveCompReferenceForLayer(layerSpec, layerIndex) {
    var hasRefId = layerSpec.refCompId !== undefined && layerSpec.refCompId !== null;
    var hasRefName = layerSpec.refCompName !== undefined && String(layerSpec.refCompName).length > 0;
    if (!hasRefId && !hasRefName) {
        throw new Error(
            "layers[" + layerIndex + "] type=comp requires refCompId or refCompName."
        );
    }
    var targetComp = findCompByIdOrName(hasRefId ? layerSpec.refCompId : null, hasRefName ? layerSpec.refCompName : null);
    if (!targetComp || !(targetComp instanceof CompItem)) {
        throw new Error(
            "Referenced composition was not found for layers[" + layerIndex + "]"
            + (hasRefName ? " refCompName='" + layerSpec.refCompName + "'" : "")
            + (hasRefId ? " refCompId=" + layerSpec.refCompId : "")
            + "."
        );
    }
    return targetComp;
}

function aeAssertCompLayerSource(layer, layerSpec, layerIndex) {
    if (!layer || !(layer instanceof AVLayer) || !(layer.source instanceof CompItem)) {
        throw new Error("layers[" + layerIndex + "] expected an AVLayer sourced from a composition.");
    }
    var sourceComp = layer.source;
    if (layerSpec.refCompId !== undefined && Number(sourceComp.id) !== Number(layerSpec.refCompId)) {
        throw new Error(
            "layers[" + layerIndex + "] source comp id mismatch: expected "
            + layerSpec.refCompId + ", got " + sourceComp.id + "."
        );
    }
    if (
        layerSpec.refCompName !== undefined
        && String(layerSpec.refCompName).length > 0
        && String(sourceComp.name) !== String(layerSpec.refCompName)
    ) {
        throw new Error(
            "layers[" + layerIndex + "] source comp name mismatch: expected '"
            + layerSpec.refCompName + "', got '" + sourceComp.name + "'."
        );
    }
}

function aeExtractScenesFromInput(sceneInput) {
    if (!sceneInput || typeof sceneInput !== "object" || sceneInput instanceof Array) {
        throw new Error("scene must be an object.");
    }
    if (sceneInput.compositions === undefined) {
        return [sceneInput];
    }
    if (!(sceneInput.compositions instanceof Array) || sceneInput.compositions.length === 0) {
        throw new Error("compositions must be a non-empty array when specified.");
    }
    return sceneInput.compositions;
}

function aeGetSceneCompositionKeys(scene, index) {
    var keys = [];
    var compSpec = scene && scene.composition ? scene.composition : {};
    if (compSpec.name !== undefined && String(compSpec.name).length > 0) {
        keys.push(String(compSpec.name));
    }
    if (compSpec.compName !== undefined && String(compSpec.compName).length > 0) {
        var normalizedCompName = String(compSpec.compName);
        var already = false;
        for (var i = 0; i < keys.length; i++) {
            if (keys[i] === normalizedCompName) {
                already = true;
                break;
            }
        }
        if (!already) {
            keys.push(normalizedCompName);
        }
    }
    if (keys.length === 0) {
        keys.push("__scene_index__" + index);
    }
    return keys;
}

function aeGetSceneDisplayName(scene, index) {
    var compSpec = scene && scene.composition ? scene.composition : {};
    if (compSpec.name !== undefined && String(compSpec.name).length > 0) {
        return String(compSpec.name);
    }
    if (compSpec.compName !== undefined && String(compSpec.compName).length > 0) {
        return String(compSpec.compName);
    }
    if (compSpec.compId !== undefined) {
        return "compId:" + compSpec.compId;
    }
    return "scene[" + index + "]";
}

function aeOrderScenesByCompositionDependency(scenes) {
    if (!(scenes instanceof Array) || scenes.length <= 1) {
        return scenes;
    }

    var nameToIndex = {};
    for (var i = 0; i < scenes.length; i++) {
        var sceneKeys = aeGetSceneCompositionKeys(scenes[i], i);
        for (var k = 0; k < sceneKeys.length; k++) {
            var key = sceneKeys[k];
            if (nameToIndex[key] !== undefined) {
                throw new Error(
                    "Duplicate composition identifier in compositions[]: '" + key + "'."
                );
            }
            nameToIndex[key] = i;
        }
    }

    var incoming = [];
    var outgoing = [];
    var edgeMap = {};
    for (var s = 0; s < scenes.length; s++) {
        incoming.push(0);
        outgoing.push([]);
    }

    for (var sourceIdx = 0; sourceIdx < scenes.length; sourceIdx++) {
        var layers = scenes[sourceIdx].layers || [];
        for (var li = 0; li < layers.length; li++) {
            var layer = layers[li];
            if (!layer || String(layer.type).toLowerCase() !== "comp") {
                continue;
            }
            var refName = layer.refCompName !== undefined ? String(layer.refCompName) : "";
            if (!refName || nameToIndex[refName] === undefined) {
                continue;
            }
            var depIdx = nameToIndex[refName];
            if (depIdx === sourceIdx) {
                throw new Error(
                    "Self reference detected: " + aeGetSceneDisplayName(scenes[sourceIdx], sourceIdx)
                    + " references itself via refCompName '" + refName + "'."
                );
            }
            var edgeKey = depIdx + "->" + sourceIdx;
            if (edgeMap[edgeKey]) {
                continue;
            }
            edgeMap[edgeKey] = true;
            outgoing[depIdx].push(sourceIdx);
            incoming[sourceIdx] += 1;
        }
    }

    var queue = [];
    for (var q = 0; q < incoming.length; q++) {
        if (incoming[q] === 0) {
            queue.push(q);
        }
    }

    var orderedIndexes = [];
    while (queue.length > 0) {
        var current = queue.shift();
        orderedIndexes.push(current);
        var nextNodes = outgoing[current];
        for (var nx = 0; nx < nextNodes.length; nx++) {
            var nextIdx = nextNodes[nx];
            incoming[nextIdx] -= 1;
            if (incoming[nextIdx] === 0) {
                queue.push(nextIdx);
            }
        }
    }

    if (orderedIndexes.length !== scenes.length) {
        throw new Error("Cycle detected in composition dependencies. Check comp layers with refCompName.");
    }

    var orderedScenes = [];
    for (var oi = 0; oi < orderedIndexes.length; oi++) {
        orderedScenes.push(scenes[orderedIndexes[oi]]);
    }
    return orderedScenes;
}

