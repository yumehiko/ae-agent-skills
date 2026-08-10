function aeResolveQueryComp(compId, compName) {
    var hasId = compId !== null && compId !== undefined && compId !== "";
    var hasName = compName !== null && compName !== undefined && String(compName).length > 0;
    if (hasId || hasName) {
        return aeResolveCompByIdOrName(hasId ? compId : null, hasName ? compName : null);
    }
    var activeComp = app.project ? app.project.activeItem : null;
    if (!activeComp || !(activeComp instanceof CompItem)) {
        return { item: null, error: "Active composition not found." };
    }
    return { item: activeComp, error: null };
}

function aeQueryIsNullLayer(layer) {
    try {
        return layer.nullLayer === true;
    } catch (e) {
        return false;
    }
}

function aeQueryValueToJSON(value) {
    if (value === null || value === undefined) {
        return null;
    }
    if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
        return value;
    }
    if (value instanceof Array) {
        var values = [];
        for (var i = 0; i < value.length; i++) {
            values.push(aeQueryValueToJSON(value[i]));
        }
        return values;
    }
    try {
        return value.toString();
    } catch (e) {
        return "";
    }
}

function aeQueryInterpolationName(interpolationType) {
    try {
        if (interpolationType === KeyframeInterpolationType.LINEAR) return "linear";
        if (interpolationType === KeyframeInterpolationType.BEZIER) return "bezier";
        if (interpolationType === KeyframeInterpolationType.HOLD) return "hold";
    } catch (e) {}
    return "unknown";
}

function aeQueryTemporalEase(eases) {
    if (!eases || !(eases instanceof Array) || eases.length === 0) {
        return null;
    }
    var serialized = [];
    for (var i = 0; i < eases.length; i++) {
        serialized.push([Number(eases[i].speed), Number(eases[i].influence)]);
    }
    return serialized.length === 1 ? serialized[0] : serialized;
}

function aeQueryPropertyKeyframes(prop) {
    var keyframes = [];
    var numKeys = 0;
    try {
        numKeys = Number(prop.numKeys) || 0;
    } catch (eNumKeys) {}
    for (var i = 1; i <= numKeys; i++) {
        var keyframe = {
            index: i,
            time: Number(prop.keyTime(i)),
            value: aeQueryValueToJSON(prop.keyValue(i)),
            inInterpolation: aeQueryInterpolationName(prop.keyInInterpolationType(i)),
            outInterpolation: aeQueryInterpolationName(prop.keyOutInterpolationType(i))
        };
        try {
            keyframe.inTemporalEase = aeQueryTemporalEase(prop.keyInTemporalEase(i));
        } catch (eInEase) {}
        try {
            keyframe.outTemporalEase = aeQueryTemporalEase(prop.keyOutTemporalEase(i));
        } catch (eOutEase) {}
        keyframes.push(keyframe);
    }
    return keyframes;
}

function getLayers(compId, compName) {
    try {
        ensureJSON();
        var resolvedComp = aeResolveQueryComp(compId, compName);
        if (resolvedComp.error) {
            log("getLayers(): " + resolvedComp.error);
            return encodePayload({ status: "error", message: resolvedComp.error });
        }
        var comp = resolvedComp.item;

        var layers = [];
        for (var i = 1; i <= comp.numLayers; i++) {
            var layer = comp.layer(i);
            var summary = {
                id: layer.index,
                layerUid: aeTryGetLayerUid(layer),
                name: layer.name,
                type: getLayerTypeName(layer),
                isNull: aeQueryIsNullLayer(layer),
                startTime: layer.startTime,
                inPoint: layer.inPoint,
                outPoint: layer.outPoint
            };
            if (layer instanceof AVLayer && layer.source && aeIsFileFootageItem(layer.source)) {
                summary.source = aeFootageItemSummary(layer.source, false);
                summary.source.type = "footage";
                summary.sourceIn = layer.inPoint - layer.startTime;
                summary.sourceOut = layer.outPoint - layer.startTime;
            } else if (layer instanceof AVLayer && layer.source instanceof CompItem) {
                summary.source = aeCompItemSummary(layer.source);
                summary.source.type = "comp";
            }
            if (layer instanceof AVLayer && typeof aeAudioLayerSummary === "function") {
                summary.audio = aeAudioLayerSummary(layer);
            }
            layers.push(summary);
        }
        return encodePayload(layers);
    } catch (e) {
        log("getLayers() threw: " + e.toString());
        return encodePayload({ status: "error", message: e.toString() });
    }
}

function listComps() {
    try {
        ensureJSON();
        if (!app.project) {
            return encodePayload([]);
        }

        var activeComp = app.project.activeItem;
        var activeCompId = null;
        if (activeComp && activeComp instanceof CompItem) {
            activeCompId = activeComp.id;
        }

        var comps = [];
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (!item || !(item instanceof CompItem)) {
                continue;
            }
            comps.push({
                id: item.id,
                name: item.name,
                width: item.width,
                height: item.height,
                pixelAspect: item.pixelAspect,
                duration: item.duration,
                frameRate: item.frameRate,
                isActive: activeCompId !== null && item.id === activeCompId
            });
        }
        return encodePayload(comps);
    } catch (e) {
        log("listComps() threw: " + e.toString());
        return encodePayload({ status: "error", message: e.toString() });
    }
}

function getProperties(layerId, optionsJSON) {
    try {
        ensureJSON();
        var options = {};
        if (optionsJSON && optionsJSON !== "null") {
            try {
                options = JSON.parse(optionsJSON);
            } catch (e) {
                log("getProperties(): Failed to parse options JSON - " + e.toString());
                options = {};
            }
        }
        var resolvedComp = aeResolveQueryComp(options.compId, options.compName);
        if (resolvedComp.error) {
            log("getProperties(): " + resolvedComp.error);
            return encodePayload({ status: "error", message: resolvedComp.error });
        }
        var comp = resolvedComp.item;

        function normalizeStringArray(value) {
            if (!value) {
                return [];
            }
            if (value instanceof Array) {
                var filtered = [];
                for (var i = 0; i < value.length; i++) {
                    var entry = value[i];
                    if (typeof entry === "string" && entry.length > 0) {
                        filtered.push(entry);
                    }
                }
                return filtered;
            }
            if (typeof value === "string" && value.length > 0) {
                return [value];
            }
            return [];
        }

        function parseMaxDepth(rawDepth) {
            if (rawDepth === null || rawDepth === undefined) {
                return null;
            }
            var parsed = parseInt(rawDepth, 10);
            if (isNaN(parsed) || parsed <= 0) {
                return null;
            }
            return parsed;
        }

        var includeGroups = normalizeStringArray(options.includeGroups);
        var excludeGroups = normalizeStringArray(options.excludeGroups);
        var maxDepth = parseMaxDepth(options.maxDepth);
        var includeGroupChildren = options.includeGroupChildren === true;
        var includeKeyframes = options.includeKeyframes === true;
        var evaluationTime = null;
        if (options.time !== null && options.time !== undefined) {
            evaluationTime = Number(options.time);
            if (isNaN(evaluationTime)) {
                return encodePayload({ status: "Error", message: "time must be a number." });
            }
        }

        var layerName = null;
        if (options.layerName !== null && options.layerName !== undefined) {
            layerName = String(options.layerName);
        }
        var resolvedLayer = aeResolveLayer(comp, layerId, layerName);
        if (resolvedLayer.error) {
            log("getProperties(): " + resolvedLayer.error);
            return encodePayload({ status: "Error", message: resolvedLayer.error });
        }
        var layer = resolvedLayer.layer;
        var properties = [];

        function shouldSkipTopLevel(matchName, depth) {
            if (depth !== 0 || !matchName || matchName.length === 0) {
                return false;
            }
            if (includeGroups.length > 0 && !aeArrayContains(includeGroups, matchName)) {
                return true;
            }
            if (excludeGroups.length > 0 && aeArrayContains(excludeGroups, matchName)) {
                return true;
            }
            return false;
        }

        function scanProperties(propGroup, pathPrefix, depth, forceRecursive) {
            if (!propGroup || typeof propGroup.numProperties !== "number") {
                return;
            }
            for (var i = 1; i <= propGroup.numProperties; i++) {
                var prop = propGroup.property(i);
                if (!prop) {
                    continue;
                }

                var identifier = aeGetPropertyIdentifier(prop, i);
                var currentPath = pathPrefix ? pathPrefix + "." + identifier : identifier;
                var nextDepth = depth + 1;

                var matchName = "";
                try {
                    matchName = prop.matchName || "";
                } catch (eMatch) {}

                if (shouldSkipTopLevel(matchName, depth)) {
                    continue;
                }
                if (!forceRecursive && maxDepth !== null && nextDepth > maxDepth) {
                    continue;
                }

                if (aeIsPropertyNode(prop)) {
                    if (!aeCanExposeProperty(prop)) {
                        continue;
                    }
                    var hasExpression = false;
                    try {
                        hasExpression = prop.expressionEnabled;
                    } catch (e) {}
                    var propertySummary = {
                        name: prop.name,
                        path: currentPath,
                        value: aePropertyValueToString(prop),
                        hasExpression: hasExpression
                    };
                    if (includeKeyframes) {
                        propertySummary.keyframes = aeQueryPropertyKeyframes(prop);
                    }
                    properties.push(propertySummary);
                }

                var shouldRecurse = aeCanTraverseProperty(prop)
                    && (forceRecursive || maxDepth === null || nextDepth < maxDepth);
                if (!shouldRecurse) {
                    continue;
                }
                var childForceRecursive = forceRecursive;
                if (includeGroupChildren && depth === 0 && matchName && aeArrayContains(includeGroups, matchName)) {
                    childForceRecursive = true;
                }
                scanProperties(prop, currentPath, nextDepth, childForceRecursive);
            }
        }

        var previousTime = null;
        if (evaluationTime !== null) {
            previousTime = comp.time;
            comp.time = evaluationTime;
        }
        try {
            scanProperties(layer, "", 0, false);
        } finally {
            if (evaluationTime !== null && previousTime !== null) {
                comp.time = previousTime;
            }
        }
        return encodePayload(properties);
    } catch (e) {
        log("getProperties() threw: " + e.toString());
        return encodePayload({ status: "Error", message: e.toString() });
    }
}

function getLayerBounds(layerId, optionsJSON) {
    try {
        ensureJSON();
        var options = {};
        if (optionsJSON && optionsJSON !== "null") {
            options = JSON.parse(optionsJSON);
        }
        var resolvedComp = aeResolveQueryComp(options.compId, options.compName);
        if (resolvedComp.error) {
            return encodePayload({ status: "error", message: resolvedComp.error });
        }
        var comp = resolvedComp.item;
        var layerName = options.layerName !== undefined ? String(options.layerName) : null;
        var resolvedLayer = aeResolveLayer(comp, layerId, layerName);
        if (resolvedLayer.error) {
            return encodePayload({ status: "error", message: resolvedLayer.error });
        }
        var time = options.time !== undefined ? Number(options.time) : 0.0;
        if (!isFinite(time)) {
            return encodePayload({ status: "error", message: "time must be a finite number." });
        }
        var layer = resolvedLayer.layer;
        if (aeQueryIsNullLayer(layer)) {
            return encodePayload({
                status: "error",
                message: "Null layer '" + layer.name + "' does not have visual bounds."
            });
        }
        var bounds = aeLayoutLayerBounds(layer, time);
        return encodePayload({
            compId: comp.id,
            compName: comp.name,
            time: time,
            layerId: layer.index,
            layerUid: aeTryGetLayerUid(layer),
            layerName: layer.name,
            bounds: bounds
        });
    } catch (e) {
        log("getLayerBounds() threw: " + e.toString());
        return encodePayload({ status: "error", message: e.toString() });
    }
}

function getSelectedProperties() {
    try {
        ensureJSON();
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return encodePayload({ status: "Error", message: "Active composition not found." });
        }

        var selectedLayers = comp.selectedLayers;
        if (!selectedLayers || selectedLayers.length === 0) {
            return encodePayload([]);
        }

        function getPathIdentifier(prop) {
            return aeGetPropertyIdentifier(prop, null);
        }

        function buildPropertyPath(prop) {
            var segments = [];
            var current = prop;
            var guard = 0;
            while (current && guard < 100) {
                var parent = null;
                try {
                    parent = current.parentProperty;
                } catch (eParent) {
                    parent = null;
                }
                if (!parent) {
                    break;
                }
                segments.unshift(getPathIdentifier(current));
                current = parent;
                guard += 1;
            }
            if (segments.length === 0) {
                return "";
            }
            return segments.join(".");
        }

        var selectedPropsPayload = [];
        for (var i = 0; i < selectedLayers.length; i++) {
            var layer = selectedLayers[i];
            if (!layer) {
                continue;
            }
            var props;
            try {
                props = layer.selectedProperties;
            } catch (eProps) {
                props = null;
            }
            if (!props || props.length === 0) {
                continue;
            }
            for (var j = 0; j < props.length; j++) {
                var prop = props[j];
                if (!prop || !aeIsPropertyNode(prop) || !aeCanExposeProperty(prop)) {
                    continue;
                }

                var path = buildPropertyPath(prop);
                if (!path || path.length === 0) {
                    continue;
                }

                var hasExpression = false;
                try {
                    hasExpression = prop.expressionEnabled;
                } catch (eHas) {}

                selectedPropsPayload.push({
                    layerId: layer.index,
                    layerName: layer.name,
                    name: prop.name,
                    path: path,
                    value: aePropertyValueToString(prop),
                    hasExpression: hasExpression
                });
            }
        }

        return encodePayload(selectedPropsPayload);
    } catch (e) {
        log("getSelectedProperties() threw: " + e.toString());
        return encodePayload({ status: "Error", message: e.toString() });
    }
}

function getExpressionErrors(compId, compName) {
    try {
        ensureJSON();
        var resolvedComp = aeResolveQueryComp(compId, compName);
        if (resolvedComp.error) {
            return encodePayload({ status: "error", message: resolvedComp.error });
        }
        var comp = resolvedComp.item;

        function getPathIdentifier(prop) {
            return aeGetPropertyIdentifier(prop, null);
        }

        function buildPropertyPath(prop) {
            var segments = [];
            var current = prop;
            var guard = 0;
            while (current && guard < 100) {
                var parent = null;
                try {
                    parent = current.parentProperty;
                } catch (eParent) {
                    parent = null;
                }
                if (!parent) {
                    break;
                }
                segments.unshift(getPathIdentifier(current));
                current = parent;
                guard += 1;
            }
            if (segments.length === 0) {
                return "";
            }
            return segments.join(".");
        }

        function collectLayerExpressionErrors(layer) {
            var issues = [];
            function scan(prop) {
                if (!prop) {
                    return;
                }

                if (aeCanTraverseProperty(prop)) {
                    for (var i = 1; i <= prop.numProperties; i++) {
                        scan(prop.property(i));
                    }
                    return;
                }

                var canSetExpression = false;
                try {
                    canSetExpression = prop.canSetExpression === true;
                } catch (eCanSet) {}
                if (!canSetExpression) {
                    return;
                }

                var enabled = false;
                try {
                    enabled = prop.expressionEnabled === true;
                } catch (eEnabled) {}
                if (!enabled) {
                    return;
                }

                var errorMessage = null;
                try {
                    if (typeof prop.expressionError === "string" && prop.expressionError.length > 0) {
                        errorMessage = prop.expressionError;
                    }
                } catch (eErrorRead) {}
                if (!errorMessage) {
                    return;
                }

                issues.push({
                    layerId: layer.index,
                    layerUid: aeTryGetLayerUid(layer),
                    layerName: layer.name,
                    propertyPath: buildPropertyPath(prop),
                    propertyName: prop.name,
                    message: errorMessage
                });
            }

            scan(layer);
            return issues;
        }

        var allIssues = [];
        for (var i = 1; i <= comp.numLayers; i++) {
            var layer = comp.layer(i);
            if (!layer) {
                continue;
            }
            var layerIssues = collectLayerExpressionErrors(layer);
            for (var j = 0; j < layerIssues.length; j++) {
                allIssues.push(layerIssues[j]);
            }
        }

        return encodePayload({
            compId: comp.id,
            compName: comp.name,
            count: allIssues.length,
            issues: allIssues
        });
    } catch (e) {
        log("getExpressionErrors() threw: " + e.toString());
        return encodePayload({ status: "Error", message: e.toString() });
    }
}
