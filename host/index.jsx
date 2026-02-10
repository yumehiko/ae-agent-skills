function log(message) {
    try {
        $.writeln("[LLM Video Agent] " + message);
    } catch (err) {}
}

function encodePayload(data) {
    try {
        var encoded = "__ENC__" + encodeURIComponent(JSON.stringify(data));
        return encoded;
    } catch (e) {
        log("encodePayload() failed: " + e.toString());
        return JSON.stringify({ status: "Error", message: "encodePayload failed: " + e.toString() });
    }
}

function getLayerTypeName(layer) {
    if (layer instanceof TextLayer) {
        return "Text";
    } else if (layer instanceof ShapeLayer) {
        return "Shape";
    } else if (layer instanceof AVLayer) {
        if (layer.source instanceof CompItem) {
            return "PreComp";
        } else if (layer.hasVideo && !layer.hasAudio) {
            return "Video";
        } else if (!layer.hasVideo && layer.hasAudio) {
            return "Audio";
        } else if (layer.source && layer.source.mainSource instanceof SolidSource) {
            return "Solid";
        } else {
            return "AVLayer";
        }
    } else if (layer instanceof CameraLayer) {
        return "Camera";
    } else if (layer instanceof LightLayer) {
        return "Light";
    }
    return "Unknown";
}

function getLayers() {
    try {
        ensureJSON();
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            log("getLayers(): Active composition not found.");
            return encodePayload({ "status": "error", "message": "Active composition not found." });
        }

        var layers = [];
        for (var i = 1; i <= comp.numLayers; i++) {
            var layer = comp.layer(i);
            layers.push({
                id: layer.index,
                name: layer.name,
                type: getLayerTypeName(layer)
            });
        }
        return encodePayload(layers);
    } catch (e) {
        log("getLayers() threw: " + e.toString());
        return encodePayload({ "status": "error", "message": e.toString() });
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
        var layer = comp.layer(layerId);
        if (!layer) {
            log("getProperties(): layer " + layerId + " not found.");
            return encodePayload({ status: "Error", message: "Layer with id " + layerId + " not found." });
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

        var properties = [];

        // NOTE: Using literal numbers for property types because the global constants 
        // (PropertyType.PROPERTY, PropertyType.GROUP) were found to be unreliable in the ExtendScript context.
        // 6212 corresponds to PropertyType.PROPERTY
        // 6213 corresponds to PropertyType.GROUP
        var PROPERTY_TYPE_PROPERTY = 6212;
        var PROPERTY_TYPE_GROUP = 6213;

        function getPropertyIdentifier(prop, index) {
            try {
                if (prop.matchName && prop.matchName.length > 0) {
                    return prop.matchName;
                }
            } catch (e) {}
            try {
                if (prop.name && prop.name.length > 0) {
                    return prop.name;
                }
            } catch (e2) {}
            return "Property_" + index;
        }

        function arrayContains(arr, value) {
            if (!arr || !value) {
                return false;
            }
            for (var i = 0; i < arr.length; i++) {
                if (arr[i] === value) {
                    return true;
                }
            }
            return false;
        }

        function propertyValueToString(prop) {
            try {
                var value = prop.value;
                if (value === null || value === undefined) {
                    return "";
                }
                if (value instanceof Array) {
                    return value.join(", ");
                }
                if (typeof value === "boolean") {
                    return value ? "true" : "false";
                }
                return value.toString();
            } catch (e) {
                return "";
            }
        }

        function canTraverse(prop) {
            if (!prop) {
                return false;
            }
            try {
                if (prop.propertyType === PROPERTY_TYPE_GROUP) {
                    return true;
                }
            } catch (e) {}
            return typeof prop.numProperties === "number" && prop.numProperties > 0;
        }

        function isPropertyNode(prop) {
            if (!prop) {
                return false;
            }
            try {
                if (prop.propertyType === PROPERTY_TYPE_PROPERTY) {
                    return true;
                }
            } catch (e) {}
            return !canTraverse(prop);
        }

        function isEnabledProperty(prop) {
            if (!prop) {
                return false;
            }
            try {
                if (typeof prop.enabled === "boolean") {
                    return prop.enabled;
                }
            } catch (e) {}
            return true;
        }

        function canExposeProperty(prop) {
            var enabled = isEnabledProperty(prop);
            if (!enabled) {
                return false;
            }
            try {
                if (prop.canSetExpression === false) {
                    return false;
                }
                if (prop.canSetExpression === true) {
                    return true;
                }
            } catch (e) {}
            try {
                if (typeof prop.canSetValue === "boolean") {
                    return prop.canSetValue;
                }
            } catch (e2) {}
            return true;
        }

        function shouldSkipTopLevel(matchName, depth) {
            if (depth !== 0) {
                return false;
            }
            if (!matchName || matchName.length === 0) {
                return false;
            }
            if (includeGroups.length > 0 && !arrayContains(includeGroups, matchName)) {
                return true;
            }
            if (excludeGroups.length > 0 && arrayContains(excludeGroups, matchName)) {
                return true;
            }
            return false;
        }

        function scanProperties(propGroup, pathPrefix, depth) {
            if (!propGroup || typeof propGroup.numProperties !== "number") {
                return;
            }
            for (var i = 1; i <= propGroup.numProperties; i++) {
                var prop = propGroup.property(i);
                if (!prop) {
                    continue;
                }

                var identifier = getPropertyIdentifier(prop, i);
                var currentPath = pathPrefix ? pathPrefix + "." + identifier : identifier;
                var nextDepth = depth + 1;

                var matchName = "";
                try {
                    matchName = prop.matchName || "";
                } catch (eMatch) {}

                if (shouldSkipTopLevel(matchName, depth)) {
                    continue;
                }

                if (maxDepth !== null && nextDepth > maxDepth) {
                    continue;
                }

                if (isPropertyNode(prop)) {
                    if (!canExposeProperty(prop)) {
                        continue;
                    }
                    var hasExpression = false;
                    try {
                        hasExpression = prop.expressionEnabled;
                    } catch (e) {}
                    properties.push({
                        name: prop.name,
                        path: currentPath,
                        value: propertyValueToString(prop),
                        hasExpression: hasExpression
                    });
                }

                if (canTraverse(prop) && (maxDepth === null || nextDepth < maxDepth)) {
                    scanProperties(prop, currentPath, nextDepth);
                }
            }
        }

        scanProperties(layer, "", 0);

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

        var PROPERTY_TYPE_PROPERTY = 6212;
        var PROPERTY_TYPE_GROUP = 6213;

        function propertyValueToString(prop) {
            try {
                var value = prop.value;
                if (value === null || value === undefined) {
                    return "";
                }
                if (value instanceof Array) {
                    return value.join(", ");
                }
                if (typeof value === "boolean") {
                    return value ? "true" : "false";
                }
                return value.toString();
            } catch (e) {
                return "";
            }
        }

        function canTraverse(prop) {
            if (!prop) {
                return false;
            }
            try {
                if (prop.propertyType === PROPERTY_TYPE_GROUP) {
                    return true;
                }
            } catch (e) {}
            return typeof prop.numProperties === "number" && prop.numProperties > 0;
        }

        function isPropertyNode(prop) {
            if (!prop) {
                return false;
            }
            try {
                if (prop.propertyType === PROPERTY_TYPE_PROPERTY) {
                    return true;
                }
            } catch (e) {}
            return !canTraverse(prop);
        }

        function isEnabledProperty(prop) {
            if (!prop) {
                return false;
            }
            try {
                if (typeof prop.enabled === "boolean") {
                    return prop.enabled;
                }
            } catch (e) {}
            return true;
        }

        function canExposeProperty(prop) {
            var enabled = isEnabledProperty(prop);
            if (!enabled) {
                return false;
            }
            try {
                if (prop.canSetExpression === false) {
                    return false;
                }
                if (prop.canSetExpression === true) {
                    return true;
                }
            } catch (e) {}
            try {
                if (typeof prop.canSetValue === "boolean") {
                    return prop.canSetValue;
                }
            } catch (e2) {}
            return true;
        }

        function getPathIdentifier(prop) {
            try {
                if (prop.matchName && prop.matchName.length > 0) {
                    return prop.matchName;
                }
            } catch (e) {}
            try {
                if (prop.name && prop.name.length > 0) {
                    return prop.name;
                }
            } catch (e2) {}
            try {
                if (typeof prop.propertyIndex === "number") {
                    return "Property_" + prop.propertyIndex;
                }
            } catch (e3) {}
            return "Property";
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
                if (!prop) {
                    continue;
                }
                if (!isPropertyNode(prop)) {
                    continue;
                }
                if (!canExposeProperty(prop)) {
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
                    value: propertyValueToString(prop),
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

function resolveProperty(layer, path) {
    var parts = path.split('.');
    var prop = layer;
    for (var i = 0; i < parts.length; i++) {
        prop = prop.property(parts[i]);
        if (!prop) {
            return null;
        }
    }
    return prop;
}

function setExpression(layerId, propertyPath, expression) {
    try {
        ensureJSON();
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return "Error: Active composition not found.";
        }

        var layer = comp.layer(layerId);
        if (!layer) {
            return "Error: Layer with id " + layerId + " not found.";
        }

        var prop = resolveProperty(layer, propertyPath);
        if (!prop) {
            return "Error: Property with path '" + propertyPath + "' not found.";
        }

        if (prop.canSetExpression) {
            prop.expression = expression;
            return "success";
        } else {
            return "Error: Cannot set expression on property '" + prop.name + "'.";
        }
    } catch (e) {
        return "Error: " + e.toString();
    }
}

function addEffect(layerId, effectMatchName, effectName) {
    try {
        ensureJSON();
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return encodePayload({ status: "error", message: "Active composition not found." });
        }

        var layer = comp.layer(layerId);
        if (!layer) {
            return encodePayload({ status: "error", message: "Layer with id " + layerId + " not found." });
        }

        if (!effectMatchName || effectMatchName.length === 0) {
            return encodePayload({ status: "error", message: "effectMatchName is required." });
        }

        var effectGroup = layer.property("ADBE Effect Parade");
        if (!effectGroup) {
            return encodePayload({ status: "error", message: "Effects group not found on layer." });
        }

        var effect = effectGroup.addProperty(effectMatchName);
        if (!effect) {
            return encodePayload({ status: "error", message: "Failed to add effect: " + effectMatchName });
        }

        if (effectName && effectName.length > 0) {
            effect.name = effectName;
        }

        var payload = {
            status: "success",
            layerId: layer.index,
            layerName: layer.name,
            effectName: effect.name,
            effectMatchName: effect.matchName
        };
        return encodePayload(payload);
    } catch (e) {
        log("addEffect() threw: " + e.toString());
        return encodePayload({ status: "error", message: e.toString() });
    }
}

function ensureJSON() {
    if (typeof JSON === "undefined" || typeof JSON.stringify !== "function") {
        try {
            $.evalFile(File(Folder(app.path).fsName + "/Scripts/json2.js"));
            return;
        } catch (e) {
            // Fall through to local copy.
        }
        var scriptFolder = File($.fileName).parent;
        var localJson = File(scriptFolder.fsName + "/json2.js");
        if (!localJson.exists) {
            throw new Error("json2.js not found at " + localJson.fsName);
        }
        $.evalFile(localJson);
    }
}
