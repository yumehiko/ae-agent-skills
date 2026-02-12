function aeDecodeBridgePayload(raw, label) {
    if (typeof raw !== "string" || raw.length === 0) {
        throw new Error(label + " returned an empty payload.");
    }
    var decoded = raw;
    if (decoded.indexOf("__ENC__") === 0) {
        decoded = decodeURIComponent(decoded.substring("__ENC__".length));
    }
    var parsed = JSON.parse(decoded);
    if (parsed && parsed.status === "error") {
        throw new Error(parsed.message || (label + " failed."));
    }
    return parsed;
}

function aeInvokeMutation(fn, args, label) {
    var result = fn.apply(this, args);
    return aeDecodeBridgePayload(result, label);
}

function aeIsFiniteNumber(value) {
    return typeof value === "number" && isFinite(value);
}

function aeRequireFiniteNumber(value, fieldPath, errors) {
    if (!aeIsFiniteNumber(value)) {
        errors.push(fieldPath + " must be a finite number.");
        return false;
    }
    return true;
}

var AE_SCENE_ID_PREFIX = "aeSceneId:";
var AE_SCENE_APPLY_MODE_MERGE = "merge";
var AE_SCENE_APPLY_MODE_REPLACE_MANAGED = "replace-managed";
var AE_SCENE_APPLY_MODE_CLEAR_ALL = "clear-all";

function aeExtractSceneIdFromComment(comment) {
    if (comment === null || comment === undefined) {
        return null;
    }
    var raw = String(comment);
    var lines = raw.split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (line.indexOf(AE_SCENE_ID_PREFIX) === 0) {
            var id = line.substring(AE_SCENE_ID_PREFIX.length);
            if (id.length > 0) {
                return id;
            }
        }
    }
    return null;
}

function aeAttachSceneIdToLayer(layer, sceneId) {
    if (!layer || !sceneId) {
        return;
    }
    var rawComment = "";
    try {
        rawComment = layer.comment ? String(layer.comment) : "";
    } catch (eCommentRead) {
        rawComment = "";
    }
    var lines = rawComment.length > 0 ? rawComment.split(/\r?\n/) : [];
    var nextLines = [];
    for (var i = 0; i < lines.length; i++) {
        if (lines[i].indexOf(AE_SCENE_ID_PREFIX) !== 0) {
            nextLines.push(lines[i]);
        }
    }
    nextLines.push(AE_SCENE_ID_PREFIX + sceneId);
    try {
        layer.comment = nextLines.join("\n");
    } catch (eCommentWrite) {}
}

function aeBuildSceneLayerIndex(comp) {
    var index = {};
    for (var i = 1; i <= comp.numLayers; i++) {
        var layer = comp.layer(i);
        if (!layer) {
            continue;
        }
        var sceneId = aeExtractSceneIdFromComment(layer.comment);
        if (!sceneId) {
            continue;
        }
        if (!index[sceneId]) {
            index[sceneId] = [];
        }
        index[sceneId].push(layer);
    }
    return index;
}

function aeNormalizeSceneApplyMode(mode) {
    if (mode === null || mode === undefined || mode === "") {
        return AE_SCENE_APPLY_MODE_MERGE;
    }
    var raw = String(mode).toLowerCase();
    if (
        raw === AE_SCENE_APPLY_MODE_MERGE
        || raw === AE_SCENE_APPLY_MODE_REPLACE_MANAGED
        || raw === AE_SCENE_APPLY_MODE_CLEAR_ALL
    ) {
        return raw;
    }
    throw new Error(
        "Invalid scene apply mode '" + raw
        + "'. Use one of: merge, replace-managed, clear-all."
    );
}

function aeBuildDeclaredSceneIdSet(sceneLayers) {
    var ids = {};
    for (var i = 0; i < sceneLayers.length; i++) {
        var layerSpec = sceneLayers[i];
        if (!layerSpec || layerSpec.id === undefined || layerSpec.id === null) {
            continue;
        }
        ids[String(layerSpec.id)] = true;
    }
    return ids;
}

function aeCollectLayersForSceneApplyMode(comp, mode, declaredSceneIds) {
    var targets = [];
    for (var i = 1; i <= comp.numLayers; i++) {
        var layer = comp.layer(i);
        if (!layer) {
            continue;
        }
        var sceneId = aeExtractSceneIdFromComment(layer.comment);
        var shouldDelete = false;
        if (mode === AE_SCENE_APPLY_MODE_CLEAR_ALL) {
            shouldDelete = true;
        } else if (mode === AE_SCENE_APPLY_MODE_REPLACE_MANAGED) {
            shouldDelete = !!sceneId && !declaredSceneIds[sceneId];
        }
        if (!shouldDelete) {
            continue;
        }
        targets.push({
            layerRef: layer,
            layerId: layer.index,
            layerName: layer.name,
            sceneId: sceneId
        });
    }
    return targets;
}

function aeSortLayerDeleteTargetsDescending(targets) {
    targets.sort(function(a, b) {
        return b.layerId - a.layerId;
    });
    return targets;
}

function aeDeleteLayerTargets(targets) {
    var deleted = [];
    var orderedTargets = aeSortLayerDeleteTargetsDescending(targets);
    for (var i = 0; i < orderedTargets.length; i++) {
        var target = orderedTargets[i];
        var layerRef = target.layerRef;
        if (!layerRef) {
            continue;
        }
        layerRef.remove();
        deleted.push({
            layerId: target.layerId,
            layerName: target.layerName,
            sceneId: target.sceneId
        });
    }
    return deleted;
}

function aeFindUntaggedLayerByNameAndType(comp, name, expectedType) {
    if (!name || typeof name !== "string") {
        return { layer: null, error: null };
    }
    var matches = [];
    for (var i = 1; i <= comp.numLayers; i++) {
        var layer = comp.layer(i);
        if (!layer || layer.name !== name) {
            continue;
        }
        var existingSceneId = aeExtractSceneIdFromComment(layer.comment);
        if (existingSceneId) {
            continue;
        }
        var existingType = String(getLayerTypeName(layer)).toLowerCase();
        if (existingType === "video") {
            existingType = "solid";
        }
        if (existingType === expectedType) {
            matches.push(layer);
        }
    }
    if (matches.length >= 1) {
        return {
            layer: matches[0],
            error: null,
            ambiguous: matches.length > 1
        };
    }
    return { layer: null, error: null, ambiguous: false };
}

function aeNormalizeLayerTypeForScene(layer) {
    try {
        if (layer && layer.nullLayer === true) {
            return "null";
        }
    } catch (eNullType) {}
    var typeName = String(getLayerTypeName(layer)).toLowerCase();
    if (typeName === "video") {
        return "solid";
    }
    return typeName;
}

function aeSetTextLayerValue(layer, textValue) {
    if (!(layer instanceof TextLayer)) {
        throw new Error("text field is only allowed for text layers.");
    }
    var textGroup = layer.property("ADBE Text Properties");
    if (!textGroup) {
        throw new Error("Text properties group not found.");
    }
    var textDocProp = textGroup.property("ADBE Text Document");
    if (!textDocProp) {
        throw new Error("Source Text property not found.");
    }
    var textDoc = textDocProp.value;
    textDoc.text = String(textValue);
    textDocProp.setValue(textDoc);
}

function aeFindExistingEffect(layer, matchName, effectName) {
    var effectGroup = layer.property("ADBE Effect Parade");
    if (!effectGroup) {
        return null;
    }
    for (var i = 1; i <= effectGroup.numProperties; i++) {
        var effect = effectGroup.property(i);
        if (!effect || effect.matchName !== matchName) {
            continue;
        }
        if (effectName === null || effectName === undefined || effectName === "") {
            return effect;
        }
        if (effect.name === effectName) {
            return effect;
        }
    }
    return null;
}

function aeApplyExpression(layerId, propertyPath, expression) {
    var result = setExpression(layerId, null, propertyPath, expression);
    if (result !== "success") {
        throw new Error(String(result));
    }
}

function aeTryAddEssentialProperty(layerId, propertyPath, essentialName) {
    try {
        aeInvokeMutation(
            addEssentialProperty,
            [layerId, null, propertyPath, essentialName !== undefined ? essentialName : null],
            "addEssentialProperty"
        );
        return true;
    } catch (e) {
        var msg = String(e);
        if (
            msg.indexOf("Property cannot be added to Essential Graphics") >= 0
            || msg.indexOf("Failed to add property to Essential Graphics") >= 0
            || msg.indexOf("Property cannot be added to Essential Graphics in this AE version") >= 0
        ) {
            // Treat as idempotent no-op when it is already exported or unavailable in context.
            return false;
        }
        throw e;
    }
}

function aeNormalizeSetValueInputForProp(prop, value) {
    if (!(value instanceof Array)) {
        return value;
    }
    try {
        var currentValue = prop.value;
        if (currentValue instanceof Array && currentValue.length === 3 && value.length === 2) {
            return [value[0], value[1], 0];
        }
    } catch (eCurrentValue) {}
    return value;
}

function aeResolveChildPropertyByMatchName(group, matchName) {
    if (!group || !matchName) {
        return null;
    }
    for (var i = 1; i <= group.numProperties; i++) {
        var child = group.property(i);
        if (child && child.matchName === matchName) {
            return child;
        }
    }
    return null;
}

function aeResolveEffectParamProperty(effect, paramSpec) {
    if (!effect || !paramSpec) {
        return null;
    }
    if (paramSpec.propertyPath !== undefined) {
        return resolveProperty(effect, String(paramSpec.propertyPath));
    }
    if (paramSpec.matchName !== undefined) {
        return aeResolveChildPropertyByMatchName(effect, String(paramSpec.matchName));
    }
    if (paramSpec.propertyIndex !== undefined) {
        var idx = parseInt(paramSpec.propertyIndex, 10);
        if (!isNaN(idx) && idx > 0) {
            return effect.property(idx);
        }
    }
    return null;
}

function aeApplyEffectParams(effect, paramSpecs) {
    if (!(paramSpecs instanceof Array)) {
        return 0;
    }
    var count = 0;
    for (var i = 0; i < paramSpecs.length; i++) {
        var paramSpec = paramSpecs[i];
        var prop = aeResolveEffectParamProperty(effect, paramSpec);
        if (!prop) {
            throw new Error("Effect parameter target was not found.");
        }
        if (typeof prop.setValue !== "function") {
            throw new Error("Effect parameter does not support setValue().");
        }
        var value = aeNormalizeSetValueInputForProp(prop, paramSpec.value);
        prop.setValue(value);
        count += 1;
    }
    return count;
}

function aeFindShapeRepeater(layer, groupIndex, repeaterName) {
    if (!layer || layer.matchName !== "ADBE Vector Layer") {
        return null;
    }
    var rootVectors = layer.property("ADBE Root Vectors Group");
    if (!rootVectors) {
        return null;
    }
    var targetIndex = groupIndex !== undefined ? parseInt(groupIndex, 10) : 1;
    if (isNaN(targetIndex) || targetIndex <= 0) {
        targetIndex = 1;
    }
    var targetGroup = rootVectors.property(targetIndex);
    if (!targetGroup || targetGroup.matchName !== "ADBE Vector Group") {
        return null;
    }
    var contents = targetGroup.property("ADBE Vectors Group");
    if (!contents) {
        return null;
    }
    for (var i = 1; i <= contents.numProperties; i++) {
        var prop = contents.property(i);
        if (!prop || prop.matchName !== "ADBE Vector Filter - Repeater") {
            continue;
        }
        if (repeaterName !== undefined && repeaterName !== null && String(repeaterName).length > 0) {
            if (prop.name === String(repeaterName)) {
                return prop;
            }
            continue;
        }
        return prop;
    }
    return null;
}

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
                    ) {
                        errors.push(prefix + ".type must be one of: text, null, solid, shape.");
                    }
                }
                if (layer.name !== undefined && typeof layer.name !== "string") {
                    errors.push(prefix + ".name must be a string when specified.");
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

function aeApplyLayerTransform(layerId, transform, skipPropertyPaths) {
    if (!transform) {
        return 0;
    }
    var count = 0;
    var pathMap = {
        anchorPoint: "ADBE Transform Group.ADBE Anchor Point",
        position: "ADBE Transform Group.ADBE Position",
        scale: "ADBE Transform Group.ADBE Scale",
        rotation: "ADBE Transform Group.ADBE Rotate Z",
        opacity: "ADBE Transform Group.ADBE Opacity"
    };
    for (var key in pathMap) {
        if (!pathMap.hasOwnProperty(key)) {
            continue;
        }
        if (transform[key] === undefined) {
            continue;
        }
        var propertyPath = pathMap[key];
        if (skipPropertyPaths && skipPropertyPaths[propertyPath]) {
            continue;
        }
        aeInvokeMutation(
            setPropertyValue,
            [layerId, null, propertyPath, JSON.stringify(transform[key])],
            "setPropertyValue(" + key + ")"
        );
        count += 1;
    }
    return count;
}

function aeApplyLayerTiming(comp, layerId, timing) {
    if (!timing) {
        return 0;
    }
    var count = 0;
    var hasIn = timing.inPoint !== undefined;
    var hasOut = timing.outPoint !== undefined;
    if (hasIn || hasOut) {
        aeInvokeMutation(
            setInOutPoint,
            [layerId, null, hasIn ? timing.inPoint : null, hasOut ? timing.outPoint : null],
            "setInOutPoint"
        );
        count += 1;
    }
    if (timing.startTime !== undefined) {
        var layer = comp.layer(layerId);
        if (!layer) {
            throw new Error("Layer not found while setting timing: layerId=" + layerId);
        }
        layer.startTime = Number(timing.startTime);
        count += 1;
    }
    return count;
}

function aeBuildLayerCreateOptions(layerSpec) {
    var options = {};
    if (layerSpec.name !== undefined) options.name = layerSpec.name;
    if (layerSpec.text !== undefined) options.text = layerSpec.text;
    if (layerSpec.width !== undefined) options.width = layerSpec.width;
    if (layerSpec.height !== undefined) options.height = layerSpec.height;
    if (layerSpec.color !== undefined) options.color = layerSpec.color;
    if (layerSpec.duration !== undefined) options.duration = layerSpec.duration;
    if (layerSpec.shapeType !== undefined) options.shapeType = layerSpec.shapeType;
    if (layerSpec.shapeSize !== undefined) options.shapeSize = layerSpec.shapeSize;
    if (layerSpec.shapePosition !== undefined) options.shapePosition = layerSpec.shapePosition;
    if (layerSpec.shapeFillColor !== undefined) options.shapeFillColor = layerSpec.shapeFillColor;
    if (layerSpec.shapeFillOpacity !== undefined) options.shapeFillOpacity = layerSpec.shapeFillOpacity;
    if (layerSpec.shapeStrokeColor !== undefined) options.shapeStrokeColor = layerSpec.shapeStrokeColor;
    if (layerSpec.shapeStrokeOpacity !== undefined) options.shapeStrokeOpacity = layerSpec.shapeStrokeOpacity;
    if (layerSpec.shapeStrokeWidth !== undefined) options.shapeStrokeWidth = layerSpec.shapeStrokeWidth;
    if (layerSpec.shapeStrokeLineCap !== undefined) options.shapeStrokeLineCap = layerSpec.shapeStrokeLineCap;
    if (layerSpec.shapeRoundness !== undefined) options.shapeRoundness = layerSpec.shapeRoundness;
    return options;
}

function aeResolveOrCreateSceneLayer(comp, layerSpec, layerIndex, sceneLayerIndex) {
    var normalizedType = String(layerSpec.type).toLowerCase();
    var sceneId = layerSpec.id !== undefined ? String(layerSpec.id) : null;
    var layer = null;
    var created = false;
    if (sceneId) {
        var taggedMatches = sceneLayerIndex[sceneId] || [];
        if (taggedMatches.length > 1) {
            throw new Error("Multiple layers share scene id '" + sceneId + "'. Resolve duplicates first.");
        }
        if (taggedMatches.length === 1) {
            layer = taggedMatches[0];
        } else {
            var fallback = aeFindUntaggedLayerByNameAndType(comp, layerSpec.name, normalizedType);
            if (fallback.error) {
                throw new Error(fallback.error);
            }
            if (fallback.layer) {
                layer = fallback.layer;
                aeAttachSceneIdToLayer(layer, sceneId);
                sceneLayerIndex[sceneId] = [layer];
            }
        }
    }
    if (!layer) {
        var options = aeBuildLayerCreateOptions(layerSpec);
        var createdPayload = aeInvokeMutation(addLayer, [normalizedType, JSON.stringify(options)], "addLayer");
        var createdLayerId = createdPayload.layerId;
        if (!createdLayerId) {
            throw new Error("addLayer did not return layerId for layers[" + layerIndex + "].");
        }
        layer = comp.layer(createdLayerId);
        created = true;
        if (sceneId && layer) {
            aeAttachSceneIdToLayer(layer, sceneId);
            sceneLayerIndex[sceneId] = [layer];
        }
    }
    if (!layer) {
        throw new Error("Failed to resolve layer for layers[" + layerIndex + "].");
    }
    var existingType = aeNormalizeLayerTypeForScene(layer);
    if (existingType !== normalizedType) {
        throw new Error(
            "Layer type mismatch for id '" + (sceneId || "<none>") + "': expected "
            + normalizedType + ", got " + existingType + "."
        );
    }
    return { layer: layer, created: created, sceneId: sceneId, layerType: normalizedType };
}

function aeApplySceneLayer(comp, layerSpec, layerIndex, sceneLayerIndex) {
    var resolved = aeResolveOrCreateSceneLayer(comp, layerSpec, layerIndex, sceneLayerIndex);
    var layer = resolved.layer;
    var layerId = layer.index;
    var operationCount = resolved.created ? 1 : 0;

    if (layerSpec.name !== undefined && layer.name !== layerSpec.name) {
        layer.name = layerSpec.name;
        operationCount += 1;
    }
    if (layerSpec.text !== undefined) {
        aeSetTextLayerValue(layer, layerSpec.text);
        operationCount += 1;
    }

    var skipPropertyPaths = {};
    var animationsForSkip = layerSpec.animations || [];
    for (var s = 0; s < animationsForSkip.length; s++) {
        var animationForSkip = animationsForSkip[s];
        if (animationForSkip && animationForSkip.propertyPath) {
            skipPropertyPaths[String(animationForSkip.propertyPath)] = true;
        }
    }
    operationCount += aeApplyLayerTransform(layerId, layerSpec.transform, skipPropertyPaths);
    operationCount += aeApplyLayerTiming(comp, layerId, layerSpec.timing);

    var propertyValues = layerSpec.propertyValues || [];
    for (var i = 0; i < propertyValues.length; i++) {
        var pv = propertyValues[i];
        aeInvokeMutation(
            setPropertyValue,
            [layerId, null, pv.propertyPath, JSON.stringify(pv.value)],
            "setPropertyValue(propertyValues)"
        );
        operationCount += 1;
    }

    var effects = layerSpec.effects || [];
    for (var j = 0; j < effects.length; j++) {
        var effect = effects[j];
        var effectName = effect.name !== undefined ? effect.name : null;
        var existingEffect = aeFindExistingEffect(layer, effect.matchName, effectName);
        if (!existingEffect) {
            aeInvokeMutation(
                addEffect,
                [layerId, null, effect.matchName, effectName],
                "addEffect"
            );
            operationCount += 1;
            existingEffect = aeFindExistingEffect(layer, effect.matchName, effectName);
            if (!existingEffect) {
                throw new Error("Added effect could not be resolved for parameter updates.");
            }
        }
        if (effect.params !== undefined) {
            operationCount += aeApplyEffectParams(existingEffect, effect.params);
        }
    }

    var repeaters = layerSpec.repeaters || [];
    for (var rr = 0; rr < repeaters.length; rr++) {
        var repeaterSpec = repeaters[rr];
        var repeaterName = repeaterSpec.name;
        if (repeaterName !== undefined && repeaterName !== null && String(repeaterName).length > 0) {
            var existingRepeater = aeFindShapeRepeater(layer, repeaterSpec.groupIndex, repeaterName);
            if (existingRepeater) {
                existingRepeater.remove();
                operationCount += 1;
            }
        }
        aeInvokeMutation(
            addShapeRepeater,
            [layerId, null, JSON.stringify(repeaterSpec)],
            "addShapeRepeater"
        );
        operationCount += 1;
    }

    var expressions = layerSpec.expressions || [];
    for (var p = 0; p < expressions.length; p++) {
        var expressionSpec = expressions[p];
        aeApplyExpression(layerId, expressionSpec.propertyPath, expressionSpec.expression);
        operationCount += 1;
    }

    var essentialProperties = layerSpec.essentialProperties || [];
    for (var r = 0; r < essentialProperties.length; r++) {
        var essentialSpec = essentialProperties[r];
        var addedEssential = aeTryAddEssentialProperty(
            layerId,
            essentialSpec.propertyPath,
            essentialSpec.essentialName
        );
        if (addedEssential) {
            operationCount += 1;
        }
    }

    var animations = layerSpec.animations || [];
    for (var m = 0; m < animations.length; m++) {
        var animation = animations[m];
        var keyframes = animation.keyframes || [];
        for (var n = 0; n < keyframes.length; n++) {
            var keyframe = keyframes[n];
            var keyframeOptions = {};
            if (keyframe.inInterp !== undefined) keyframeOptions.inInterp = keyframe.inInterp;
            if (keyframe.outInterp !== undefined) keyframeOptions.outInterp = keyframe.outInterp;
            if (keyframe.easeIn !== undefined) keyframeOptions.easeIn = keyframe.easeIn;
            if (keyframe.easeOut !== undefined) keyframeOptions.easeOut = keyframe.easeOut;
            aeInvokeMutation(
                setKeyframe,
                [
                    layerId,
                    null,
                    animation.propertyPath,
                    keyframe.time,
                    JSON.stringify(keyframe.value),
                    JSON.stringify(keyframeOptions),
                ],
                "setKeyframe"
            );
            operationCount += 1;
        }
    }

    return {
        id: resolved.sceneId,
        created: resolved.created,
        parentId: layerSpec.parentId !== undefined ? layerSpec.parentId : undefined,
        layerId: layerId,
        layerUid: layer ? aeTryGetLayerUid(layer) : null,
        layerName: layer ? layer.name : null,
        layerType: resolved.layerType,
        operations: operationCount
    };
}

function applyScene(sceneJSON, optionsJSON) {
    try {
        ensureJSON();

        var scene = JSON.parse(sceneJSON);
        var options = {};
        if (optionsJSON && optionsJSON !== "null") {
            options = JSON.parse(optionsJSON);
        }
        var validateOnly = options.validateOnly === true;
        var applyMode = aeNormalizeSceneApplyMode(options.mode);

        var validation = aeValidateSceneSpec(scene);
        if (!validation.ok) {
            return encodePayload({
                status: "error",
                message: "Scene validation failed.",
                errors: validation.errors
            });
        }

        var layers = scene.layers || [];
        var operationsPlanned = 0;
        for (var i = 0; i < layers.length; i++) {
            var layer = layers[i];
            operationsPlanned += 1;
            if (layer.transform) {
                if (layer.transform.anchorPoint !== undefined) operationsPlanned += 1;
                if (layer.transform.position !== undefined) operationsPlanned += 1;
                if (layer.transform.scale !== undefined) operationsPlanned += 1;
                if (layer.transform.rotation !== undefined) operationsPlanned += 1;
                if (layer.transform.opacity !== undefined) operationsPlanned += 1;
            }
            if (layer.timing && (layer.timing.inPoint !== undefined || layer.timing.outPoint !== undefined)) {
                operationsPlanned += 1;
            }
            if (layer.timing && layer.timing.startTime !== undefined) {
                operationsPlanned += 1;
            }
            operationsPlanned += (layer.propertyValues || []).length;
            var layerEffects = layer.effects || [];
            operationsPlanned += layerEffects.length;
            for (var ef = 0; ef < layerEffects.length; ef++) {
                operationsPlanned += (layerEffects[ef].params || []).length;
            }
            operationsPlanned += (layer.repeaters || []).length;
            operationsPlanned += (layer.expressions || []).length;
            operationsPlanned += (layer.essentialProperties || []).length;
            if (layer.parentId !== undefined) {
                operationsPlanned += 1;
            }
            var animations = layer.animations || [];
            for (var j = 0; j < animations.length; j++) {
                operationsPlanned += (animations[j].keyframes || []).length;
            }
        }

        var comp = null;
        var compSummary = null;
        if (validateOnly) {
            try {
                comp = aeResolveSceneComp(scene, false);
            } catch (eValidateComp) {
                var compSpec = scene.composition || {};
                var canUseVirtualComp = compSpec.name !== undefined && compSpec.createIfMissing !== false;
                if (!canUseVirtualComp) {
                    throw eValidateComp;
                }
                compSummary = {
                    id: null,
                    name: compSpec.name,
                    width: compSpec.width !== undefined ? compSpec.width : 1920,
                    height: compSpec.height !== undefined ? compSpec.height : 1080,
                    duration: compSpec.duration !== undefined ? compSpec.duration : 8.0,
                    frameRate: compSpec.frameRate !== undefined ? compSpec.frameRate : 30.0
                };
            }
        } else {
            comp = aeResolveSceneComp(scene, true);
        }
        if (!compSummary) {
            compSummary = {
                id: comp.id,
                name: comp.name,
                width: comp.width,
                height: comp.height,
                duration: comp.duration,
                frameRate: comp.frameRate
            };
        }

        var declaredSceneIds = aeBuildDeclaredSceneIdSet(layers);
        var deleteTargets = comp ? aeCollectLayersForSceneApplyMode(comp, applyMode, declaredSceneIds) : [];
        operationsPlanned += deleteTargets.length;

        if (validateOnly) {
            return encodePayload({
                status: "success",
                mode: "validate",
                applyMode: applyMode,
                composition: compSummary,
                layerCount: layers.length,
                operationsPlanned: operationsPlanned,
                deletedCount: deleteTargets.length
            });
        }

        var appliedLayers = [];
        var createdCount = 0;
        var reusedCount = 0;
        var parentAppliedCount = 0;
        var deletedLayers = [];
        app.beginUndoGroup("Apply Scene");
        try {
            deletedLayers = aeDeleteLayerTargets(deleteTargets);
            var sceneLayerIndex = aeBuildSceneLayerIndex(comp);
            for (var m = 0; m < layers.length; m++) {
                var applied = aeApplySceneLayer(comp, layers[m], m, sceneLayerIndex);
                appliedLayers.push(applied);
                if (applied.created) {
                    createdCount += 1;
                } else {
                    reusedCount += 1;
                }
            }

            for (var t = 0; t < appliedLayers.length; t++) {
                var normalizedApplied = appliedLayers[t];
                if (!normalizedApplied.id) {
                    continue;
                }
                var normalizedLayerSet = sceneLayerIndex[normalizedApplied.id] || [];
                if (normalizedLayerSet.length >= 1 && normalizedLayerSet[0]) {
                    normalizedApplied.layerId = normalizedLayerSet[0].index;
                    normalizedApplied.layerUid = aeTryGetLayerUid(normalizedLayerSet[0]);
                    normalizedApplied.layerName = normalizedLayerSet[0].name;
                }
            }

            var sceneIdToLayerId = {};
            for (var u = 0; u < appliedLayers.length; u++) {
                var appliedLayer = appliedLayers[u];
                if (appliedLayer.id) {
                    sceneIdToLayerId[appliedLayer.id] = appliedLayer.layerId;
                }
            }
            for (var v = 0; v < layers.length; v++) {
                var layerSpec = layers[v];
                if (layerSpec.parentId === undefined) {
                    continue;
                }
                var childApplied = appliedLayers[v];
                var parentLayerId = null;
                if (layerSpec.parentId !== null) {
                    parentLayerId = sceneIdToLayerId[String(layerSpec.parentId)];
                    if (!parentLayerId) {
                        throw new Error("parentId '" + layerSpec.parentId + "' was not found in scene layers.");
                    }
                }
                if (parentLayerId !== null && parentLayerId === childApplied.layerId) {
                    // Already in desired state for scene identity mapping.
                    continue;
                }
                aeInvokeMutation(
                    parentLayer,
                    [childApplied.layerId, parentLayerId],
                    "parentLayer"
                );
                childApplied.operations += 1;
                parentAppliedCount += 1;
            }
        } finally {
            app.endUndoGroup();
        }

        return encodePayload({
            status: "success",
            mode: "apply",
            composition: compSummary,
            applyMode: applyMode,
            layerCount: appliedLayers.length,
            operationsPlanned: operationsPlanned,
            createdCount: createdCount,
            reusedCount: reusedCount,
            parentAppliedCount: parentAppliedCount,
            deletedCount: deletedLayers.length,
            deletedLayers: deletedLayers,
            createdLayers: appliedLayers,
            appliedLayers: appliedLayers
        });
    } catch (e) {
        log("applyScene() threw: " + e.toString());
        return encodePayload({ status: "error", message: e.toString() });
    }
}
