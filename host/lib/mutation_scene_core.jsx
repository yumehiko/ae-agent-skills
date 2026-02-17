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
        var existingType = aeNormalizeLayerTypeForScene(layer);
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
    if (typeName === "precomp") {
        return "comp";
    }
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

