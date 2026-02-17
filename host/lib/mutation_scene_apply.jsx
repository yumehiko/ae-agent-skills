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
        if (normalizedType === "comp") {
            var sourceComp = aeResolveCompReferenceForLayer(layerSpec, layerIndex);
            layer = comp.layers.add(sourceComp);
            created = true;
        } else {
            var options = aeBuildLayerCreateOptions(layerSpec);
            var createdPayload = aeInvokeMutation(addLayer, [normalizedType, JSON.stringify(options)], "addLayer");
            var createdLayerId = createdPayload.layerId;
            if (!createdLayerId) {
                throw new Error("addLayer did not return layerId for layers[" + layerIndex + "].");
            }
            layer = comp.layer(createdLayerId);
            created = true;
        }
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
    if (normalizedType === "comp") {
        aeAssertCompLayerSource(layer, layerSpec, layerIndex);
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

function aeEstimateSceneOperations(layers) {
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
    return operationsPlanned;
}

function aeApplySingleScene(scene, validateOnly, applyMode) {
    var layers = scene.layers || [];
    var operationsPlanned = aeEstimateSceneOperations(layers);

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
        return {
            status: "success",
            mode: "validate",
            applyMode: applyMode,
            composition: compSummary,
            layerCount: layers.length,
            operationsPlanned: operationsPlanned,
            deletedCount: deleteTargets.length
        };
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

    return {
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
    };
}

function applyScene(sceneJSON, optionsJSON) {
    try {
        ensureJSON();

        var sceneInput = JSON.parse(sceneJSON);
        var options = {};
        if (optionsJSON && optionsJSON !== "null") {
            options = JSON.parse(optionsJSON);
        }
        var validateOnly = options.validateOnly === true;
        var applyMode = aeNormalizeSceneApplyMode(options.mode);

        var scenes = aeExtractScenesFromInput(sceneInput);
        for (var i = 0; i < scenes.length; i++) {
            var validation = aeValidateSceneSpec(scenes[i]);
            if (!validation.ok) {
                var errors = [];
                for (var e = 0; e < validation.errors.length; e++) {
                    if (scenes.length === 1) {
                        errors.push(validation.errors[e]);
                    } else {
                        errors.push("compositions[" + i + "]: " + validation.errors[e]);
                    }
                }
                return encodePayload({
                    status: "error",
                    message: "Scene validation failed.",
                    errors: errors
                });
            }
        }

        var orderedScenes = aeOrderScenesByCompositionDependency(scenes);
        var sceneResults = [];
        for (var s = 0; s < orderedScenes.length; s++) {
            sceneResults.push(aeApplySingleScene(orderedScenes[s], validateOnly, applyMode));
        }

        if (sceneResults.length === 1) {
            return encodePayload(sceneResults[0]);
        }

        var summary = {
            status: "success",
            mode: validateOnly ? "validate" : "apply",
            applyMode: applyMode,
            compositionCount: sceneResults.length,
            results: sceneResults,
            compositions: []
        };
        var totalLayerCount = 0;
        var totalOperationsPlanned = 0;
        var totalDeletedCount = 0;
        var totalCreatedCount = 0;
        var totalReusedCount = 0;
        var totalParentAppliedCount = 0;
        for (var r = 0; r < sceneResults.length; r++) {
            var item = sceneResults[r];
            summary.compositions.push(item.composition);
            totalLayerCount += item.layerCount || 0;
            totalOperationsPlanned += item.operationsPlanned || 0;
            totalDeletedCount += item.deletedCount || 0;
            totalCreatedCount += item.createdCount || 0;
            totalReusedCount += item.reusedCount || 0;
            totalParentAppliedCount += item.parentAppliedCount || 0;
        }
        summary.layerCount = totalLayerCount;
        summary.operationsPlanned = totalOperationsPlanned;
        summary.deletedCount = totalDeletedCount;
        if (!validateOnly) {
            summary.createdCount = totalCreatedCount;
            summary.reusedCount = totalReusedCount;
            summary.parentAppliedCount = totalParentAppliedCount;
        }
        return encodePayload(summary);
    } catch (e) {
        log("applyScene() threw: " + e.toString());
        return encodePayload({ status: "error", message: e.toString() });
    }
}
