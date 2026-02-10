function getLayers() {
    try {
        ensureJSON();
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            log("getLayers(): Active composition not found.");
            return encodePayload({ status: "error", message: "Active composition not found." });
        }

        var layers = [];
        for (var i = 1; i <= comp.numLayers; i++) {
            var layer = comp.layer(i);
            layers.push({
                id: layer.index,
                layerUid: aeTryGetLayerUid(layer),
                name: layer.name,
                type: getLayerTypeName(layer)
            });
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
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            log("getProperties(): Active composition not found.");
            return encodePayload({ status: "Error", message: "Active composition not found." });
        }

        var options = {};
        if (optionsJSON && optionsJSON !== "null") {
            try {
                options = JSON.parse(optionsJSON);
            } catch (e) {
                log("getProperties(): Failed to parse options JSON - " + e.toString());
                options = {};
            }
        }

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
                    properties.push({
                        name: prop.name,
                        path: currentPath,
                        value: aePropertyValueToString(prop),
                        hasExpression: hasExpression
                    });
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
