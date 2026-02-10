function splitPropertyPath(path) {
    if (!path || typeof path !== "string") {
        return [];
    }
    var normalized = path;
    if (normalized.indexOf(">") >= 0) {
        normalized = normalized.replace(/\s*>\s*/g, ".");
    }
    var rawParts = normalized.split(".");
    var parts = [];
    for (var i = 0; i < rawParts.length; i++) {
        var part = rawParts[i];
        if (part === null || part === undefined) {
            continue;
        }
        var trimmed = String(part).replace(/^\s+|\s+$/g, "");
        if (trimmed.length > 0) {
            parts.push(trimmed);
        }
    }
    return parts;
}

function resolveProperty(layer, path) {
    var parts = splitPropertyPath(path);
    if (parts.length === 0) {
        return null;
    }
    var prop = layer;
    for (var i = 0; i < parts.length; i += 1) {
        var segment = parts[i];
        var next = null;
        try {
            next = prop.property(segment);
        } catch (eByName) {
            next = null;
        }
        if (!next) {
            var asNumber = parseInt(segment, 10);
            if (!isNaN(asNumber)) {
                try {
                    next = prop.property(asNumber);
                } catch (eByIndex) {
                    next = null;
                }
            }
        }
        prop = next;
        if (!prop) {
            return null;
        }
    }
    return prop;
}

function findCompByIdOrName(compId, compName) {
    if (!app.project) {
        return null;
    }
    var targetId = null;
    if (compId !== null && compId !== undefined) {
        targetId = parseInt(compId, 10);
        if (isNaN(targetId)) {
            targetId = null;
        }
    }

    for (var i = 1; i <= app.project.numItems; i++) {
        var item = app.project.item(i);
        if (!item || !(item instanceof CompItem)) {
            continue;
        }
        if (targetId !== null && item.id === targetId) {
            return item;
        }
        if (compName && item.name === compName) {
            return item;
        }
    }
    return null;
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

function addLayer(layerType, optionsJSON) {
    try {
        ensureJSON();
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return encodePayload({ status: "error", message: "Active composition not found." });
        }

        var requestedType = (layerType || "null").toString().toLowerCase();
        var options = {};
        if (optionsJSON && optionsJSON !== "null") {
            try {
                options = JSON.parse(optionsJSON);
            } catch (eParse) {
                return encodePayload({ status: "error", message: "Invalid options JSON: " + eParse.toString() });
            }
        }

        function getNumber(value, fallback) {
            if (value === null || value === undefined) {
                return fallback;
            }
            var parsed = Number(value);
            if (isNaN(parsed)) {
                return fallback;
            }
            return parsed;
        }

        function toColor01(value, fallback) {
            if (!(value instanceof Array) || value.length !== 3) {
                return fallback;
            }
            var color = [];
            for (var i = 0; i < 3; i++) {
                var part = Number(value[i]);
                if (isNaN(part)) {
                    return fallback;
                }
                if (part > 1) {
                    part = part / 255;
                }
                if (part < 0) {
                    part = 0;
                }
                if (part > 1) {
                    part = 1;
                }
                color.push(part);
            }
            return color;
        }

        var layer = null;
        var name = options.name && options.name.length > 0 ? options.name : null;

        if (requestedType === "text") {
            var text = options.text;
            if (text === null || text === undefined) {
                text = "";
            }
            layer = comp.layers.addText(String(text));
        } else if (requestedType === "null") {
            layer = comp.layers.addNull();
        } else if (requestedType === "shape") {
            layer = comp.layers.addShape();
        } else if (requestedType === "solid") {
            var solidName = name || "Solid";
            var solidColor = toColor01(options.color, [0.5, 0.5, 0.5]);
            var solidWidth = Math.max(1, Math.round(getNumber(options.width, comp.width)));
            var solidHeight = Math.max(1, Math.round(getNumber(options.height, comp.height)));
            var solidDuration = getNumber(options.duration, comp.duration);
            if (solidDuration <= 0) {
                solidDuration = comp.duration;
            }
            layer = comp.layers.addSolid(solidColor, solidName, solidWidth, solidHeight, 1.0, solidDuration);
        } else {
            return encodePayload({
                status: "error",
                message: "Unsupported layerType. Use one of: text, null, solid, shape."
            });
        }

        if (!layer) {
            return encodePayload({ status: "error", message: "Failed to add layer." });
        }

        if (name && requestedType !== "solid") {
            layer.name = name;
        }

        return encodePayload({
            status: "success",
            layerId: layer.index,
            layerName: layer.name,
            layerType: getLayerTypeName(layer)
        });
    } catch (e) {
        log("addLayer() threw: " + e.toString());
        return encodePayload({ status: "error", message: e.toString() });
    }
}

function createComp(name, width, height, pixelAspect, duration, frameRate) {
    try {
        ensureJSON();
        if (!name || name.length === 0) {
            return encodePayload({ status: "error", message: "name is required." });
        }
        if (!app.project) {
            app.newProject();
        }

        var compWidth = Math.max(1, Math.round(Number(width)));
        var compHeight = Math.max(1, Math.round(Number(height)));
        var compPixelAspect = Number(pixelAspect);
        var compDuration = Number(duration);
        var compFrameRate = Number(frameRate);

        if (isNaN(compPixelAspect) || compPixelAspect <= 0) compPixelAspect = 1.0;
        if (isNaN(compDuration) || compDuration <= 0) {
            return encodePayload({ status: "error", message: "duration must be a positive number." });
        }
        if (isNaN(compFrameRate) || compFrameRate <= 0) {
            return encodePayload({ status: "error", message: "frameRate must be a positive number." });
        }

        var comp = app.project.items.addComp(
            String(name),
            compWidth,
            compHeight,
            compPixelAspect,
            compDuration,
            compFrameRate
        );
        if (!comp) {
            return encodePayload({ status: "error", message: "Failed to create comp." });
        }
        comp.openInViewer();

        return encodePayload({
            status: "success",
            id: comp.id,
            name: comp.name,
            width: comp.width,
            height: comp.height,
            pixelAspect: comp.pixelAspect,
            duration: comp.duration,
            frameRate: comp.frameRate
        });
    } catch (e) {
        log("createComp() threw: " + e.toString());
        return encodePayload({ status: "error", message: e.toString() });
    }
}

function setActiveComp(compId, compName) {
    try {
        ensureJSON();
        var comp = findCompByIdOrName(compId, compName);
        if (!comp) {
            return encodePayload({ status: "error", message: "Composition not found." });
        }
        comp.openInViewer();
        return encodePayload({
            status: "success",
            id: comp.id,
            name: comp.name
        });
    } catch (e) {
        log("setActiveComp() threw: " + e.toString());
        return encodePayload({ status: "error", message: e.toString() });
    }
}

function setPropertyValue(layerId, propertyPath, valueJSON) {
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

        var prop = resolveProperty(layer, propertyPath);
        if (!prop) {
            return encodePayload({ status: "error", message: "Property with path '" + propertyPath + "' not found." });
        }

        if (typeof prop.setValue !== "function") {
            return encodePayload({ status: "error", message: "Property does not support setValue()." });
        }

        var value = JSON.parse(valueJSON);
        prop.setValue(value);

        return encodePayload({
            status: "success",
            layerId: layer.index,
            layerName: layer.name,
            propertyPath: propertyPath
        });
    } catch (e) {
        log("setPropertyValue() threw: " + e.toString());
        return encodePayload({ status: "error", message: e.toString() });
    }
}

function setKeyframe(layerId, propertyPath, time, valueJSON) {
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

        var prop = resolveProperty(layer, propertyPath);
        if (!prop) {
            return encodePayload({ status: "error", message: "Property with path '" + propertyPath + "' not found." });
        }

        if (typeof prop.canVaryOverTime === "boolean" && !prop.canVaryOverTime) {
            return encodePayload({ status: "error", message: "Property cannot be keyframed." });
        }
        if (typeof prop.setValueAtTime !== "function") {
            return encodePayload({ status: "error", message: "Property does not support setValueAtTime()." });
        }

        var timeValue = Number(time);
        if (isNaN(timeValue)) {
            return encodePayload({ status: "error", message: "time must be a number." });
        }

        var value = JSON.parse(valueJSON);
        prop.setValueAtTime(timeValue, value);

        var keyIndex = null;
        try {
            keyIndex = prop.nearestKeyIndex(timeValue);
        } catch (eKey) {}

        return encodePayload({
            status: "success",
            layerId: layer.index,
            layerName: layer.name,
            propertyPath: propertyPath,
            time: timeValue,
            keyIndex: keyIndex
        });
    } catch (e) {
        log("setKeyframe() threw: " + e.toString());
        return encodePayload({ status: "error", message: e.toString() });
    }
}
