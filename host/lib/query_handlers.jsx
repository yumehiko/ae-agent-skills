function aeBuildPropertyPath(prop) {
    function getPathIdentifier(target) {
        return aeGetPropertyIdentifier(target, null);
    }
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

function aeInterpolationTypeToName(interpType) {
    if (interpType === KeyframeInterpolationType.LINEAR) {
        return "linear";
    }
    if (interpType === KeyframeInterpolationType.BEZIER) {
        return "bezier";
    }
    if (interpType === KeyframeInterpolationType.HOLD) {
        return "hold";
    }
    return null;
}

function aeSerializeTemporalEaseList(eases) {
    if (!(eases instanceof Array)) {
        return null;
    }
    var pairs = [];
    for (var i = 0; i < eases.length; i++) {
        var ease = eases[i];
        if (!ease) {
            continue;
        }
        var speed = null;
        var influence = null;
        try {
            speed = ease.speed;
            influence = ease.influence;
        } catch (eEaseRead) {
            speed = null;
            influence = null;
        }
        if (speed === null || influence === null) {
            continue;
        }
        pairs.push([speed, influence]);
    }
    return pairs.length > 0 ? pairs : null;
}

function aeSerializeKeyValue(value) {
    if (value === null || value === undefined) {
        return null;
    }
    if (value instanceof Array) {
        return value;
    }
    var t = typeof value;
    if (t === "number" || t === "boolean" || t === "string") {
        return value;
    }
    return String(value);
}

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
            var parentLayerId = null;
            var parentLayerName = null;
            try {
                if (layer.parent) {
                    parentLayerId = layer.parent.index;
                    parentLayerName = layer.parent.name;
                }
            } catch (eParent) {}

            var solidColor = null;
            var sourceWidth = null;
            var sourceHeight = null;
            var sourceDuration = null;
            try {
                if (layer.source) {
                    sourceWidth = layer.source.width;
                    sourceHeight = layer.source.height;
                    sourceDuration = layer.source.duration;
                    if (layer.source.mainSource && layer.source.mainSource instanceof SolidSource) {
                        solidColor = layer.source.mainSource.color;
                    }
                }
            } catch (eSource) {}

            var isNullLayer = false;
            try {
                isNullLayer = layer.nullLayer === true;
            } catch (eNull) {}

            layers.push({
                id: layer.index,
                layerUid: aeTryGetLayerUid(layer),
                name: layer.name,
                type: getLayerTypeName(layer),
                parentLayerId: parentLayerId,
                parentLayerName: parentLayerName,
                inPoint: layer.inPoint,
                outPoint: layer.outPoint,
                startTime: layer.startTime,
                nullLayer: isNullLayer,
                sourceWidth: sourceWidth,
                sourceHeight: sourceHeight,
                sourceDuration: sourceDuration,
                solidColor: solidColor
            });
        }
        return encodePayload(layers);
    } catch (e) {
        log("getLayers() threw: " + e.toString());
        return encodePayload({ status: "error", message: e.toString() });
    }
}

function getExpressions(layerId, optionsJSON) {
    try {
        ensureJSON();
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return encodePayload({ status: "Error", message: "Active composition not found." });
        }
        var options = {};
        if (optionsJSON && optionsJSON !== "null") {
            try {
                options = JSON.parse(optionsJSON);
            } catch (e) {
                options = {};
            }
        }
        var layerName = null;
        if (options.layerName !== undefined && options.layerName !== null) {
            layerName = String(options.layerName);
        }
        var resolvedLayer = aeResolveLayer(comp, layerId, layerName);
        if (resolvedLayer.error) {
            return encodePayload({ status: "Error", message: resolvedLayer.error });
        }
        var layer = resolvedLayer.layer;
        var expressionItems = [];

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
            var expressionText = null;
            try {
                if (typeof prop.expression === "string" && prop.expression.length > 0) {
                    expressionText = prop.expression;
                }
            } catch (eExpression) {
                expressionText = null;
            }
            if (!expressionText) {
                return;
            }
            expressionItems.push({
                layerId: layer.index,
                layerUid: aeTryGetLayerUid(layer),
                layerName: layer.name,
                propertyPath: aeBuildPropertyPath(prop),
                propertyName: prop.name,
                expression: expressionText
            });
        }

        scan(layer);
        return encodePayload(expressionItems);
    } catch (e) {
        log("getExpressions() threw: " + e.toString());
        return encodePayload({ status: "Error", message: e.toString() });
    }
}

function getAnimations(layerId, optionsJSON) {
    try {
        ensureJSON();
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return encodePayload({ status: "Error", message: "Active composition not found." });
        }
        var options = {};
        if (optionsJSON && optionsJSON !== "null") {
            try {
                options = JSON.parse(optionsJSON);
            } catch (e) {
                options = {};
            }
        }
        var layerName = null;
        if (options.layerName !== undefined && options.layerName !== null) {
            layerName = String(options.layerName);
        }
        var resolvedLayer = aeResolveLayer(comp, layerId, layerName);
        if (resolvedLayer.error) {
            return encodePayload({ status: "Error", message: resolvedLayer.error });
        }
        var layer = resolvedLayer.layer;
        var animationItems = [];

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
            if (!aeIsPropertyNode(prop)) {
                return;
            }
            var numKeys = 0;
            try {
                numKeys = prop.numKeys;
            } catch (eNumKeys) {
                numKeys = 0;
            }
            if (!numKeys || numKeys <= 0) {
                return;
            }
            var keyframes = [];
            for (var k = 1; k <= numKeys; k++) {
                var keyTime = null;
                var keyValue = null;
                try {
                    keyTime = prop.keyTime(k);
                    keyValue = aeSerializeKeyValue(prop.keyValue(k));
                } catch (eKeyRead) {
                    continue;
                }
                var inInterp = null;
                var outInterp = null;
                try {
                    inInterp = aeInterpolationTypeToName(prop.keyInInterpolationType(k));
                } catch (eInInterp) {}
                try {
                    outInterp = aeInterpolationTypeToName(prop.keyOutInterpolationType(k));
                } catch (eOutInterp) {}
                var easeIn = null;
                var easeOut = null;
                try {
                    easeIn = aeSerializeTemporalEaseList(prop.keyInTemporalEase(k));
                } catch (eInEase) {}
                try {
                    easeOut = aeSerializeTemporalEaseList(prop.keyOutTemporalEase(k));
                } catch (eOutEase) {}
                keyframes.push({
                    time: keyTime,
                    value: keyValue,
                    inInterp: inInterp,
                    outInterp: outInterp,
                    easeIn: easeIn,
                    easeOut: easeOut
                });
            }
            if (keyframes.length === 0) {
                return;
            }
            animationItems.push({
                layerId: layer.index,
                layerUid: aeTryGetLayerUid(layer),
                layerName: layer.name,
                propertyPath: aeBuildPropertyPath(prop),
                propertyName: prop.name,
                keyframes: keyframes
            });
        }

        scan(layer);
        return encodePayload(animationItems);
    } catch (e) {
        log("getAnimations() threw: " + e.toString());
        return encodePayload({ status: "Error", message: e.toString() });
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

                var path = aeBuildPropertyPath(prop);
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

function getExpressionErrors() {
    try {
        ensureJSON();
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return encodePayload({ status: "Error", message: "Active composition not found." });
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
                    propertyPath: aeBuildPropertyPath(prop),
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
