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
