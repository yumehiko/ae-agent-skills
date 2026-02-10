function addShapeRepeater(layerId, optionsJSON) {
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
        if (layer.matchName !== "ADBE Vector Layer") {
            return encodePayload({ status: "error", message: "Target layer is not a shape layer." });
        }

        var options = {};
        if (optionsJSON && optionsJSON !== "null") {
            try {
                options = JSON.parse(optionsJSON);
            } catch (eParse) {
                return encodePayload({ status: "error", message: "Invalid options JSON: " + eParse.toString() });
            }
        }

        function clamp(value, minValue, maxValue) {
            if (value < minValue) {
                return minValue;
            }
            if (value > maxValue) {
                return maxValue;
            }
            return value;
        }

        function toNumberOrNull(value) {
            if (value === null || value === undefined) {
                return null;
            }
            var num = Number(value);
            if (isNaN(num)) {
                return null;
            }
            return num;
        }

        function toVec2(value) {
            if (!(value instanceof Array) || value.length !== 2) {
                return null;
            }
            var x = Number(value[0]);
            var y = Number(value[1]);
            if (isNaN(x) || isNaN(y)) {
                return null;
            }
            return [x, y];
        }

        var rootVectors = layer.property("ADBE Root Vectors Group");
        if (!rootVectors) {
            return encodePayload({ status: "error", message: "Shape contents not found." });
        }

        var groupIndex = parseInt(options.groupIndex, 10);
        if (isNaN(groupIndex) || groupIndex <= 0) {
            groupIndex = 1;
        }

        var targetGroup = rootVectors.property(groupIndex);
        if (!targetGroup || targetGroup.matchName !== "ADBE Vector Group") {
            return encodePayload({ status: "error", message: "Shape group not found at groupIndex " + groupIndex + "." });
        }

        var contents = targetGroup.property("ADBE Vectors Group");
        if (!contents) {
            return encodePayload({ status: "error", message: "Shape group contents not found." });
        }

        var repeater = contents.addProperty("ADBE Vector Filter - Repeater");
        if (!repeater) {
            return encodePayload({ status: "error", message: "Failed to add Repeater." });
        }

        if (options.name && String(options.name).length > 0) {
            repeater.name = String(options.name);
        }

        var copies = toNumberOrNull(options.copies);
        if (copies !== null) {
            if (copies < 0) {
                copies = 0;
            }
            repeater.property("ADBE Vector Repeater Copies").setValue(copies);
        }

        var offset = toNumberOrNull(options.offset);
        if (offset !== null) {
            repeater.property("ADBE Vector Repeater Offset").setValue(offset);
        }

        var transform = repeater.property("ADBE Vector Repeater Transform");
        if (transform) {
            var position = toVec2(options.position);
            if (position) {
                transform.property("ADBE Vector Repeater Position").setValue(position);
            }

            var scale = toVec2(options.scale);
            if (scale) {
                transform.property("ADBE Vector Repeater Scale").setValue(scale);
            }

            var rotation = toNumberOrNull(options.rotation);
            if (rotation !== null) {
                transform.property("ADBE Vector Repeater Rotation").setValue(rotation);
            }

            var startOpacity = toNumberOrNull(options.startOpacity);
            if (startOpacity !== null) {
                transform.property("ADBE Vector Repeater Opacity 1").setValue(clamp(startOpacity, 0, 100));
            }

            var endOpacity = toNumberOrNull(options.endOpacity);
            if (endOpacity !== null) {
                transform.property("ADBE Vector Repeater Opacity 2").setValue(clamp(endOpacity, 0, 100));
            }
        }

        return encodePayload({
            status: "success",
            layerId: layer.index,
            layerName: layer.name,
            groupIndex: groupIndex,
            repeaterName: repeater.name
        });
    } catch (e) {
        log("addShapeRepeater() threw: " + e.toString());
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

        function clamp(value, minValue, maxValue) {
            if (value < minValue) {
                return minValue;
            }
            if (value > maxValue) {
                return maxValue;
            }
            return value;
        }

        function toVec2(value, fallback) {
            if (!(value instanceof Array) || value.length !== 2) {
                return fallback;
            }
            var first = Number(value[0]);
            var second = Number(value[1]);
            if (isNaN(first) || isNaN(second)) {
                return fallback;
            }
            return [first, second];
        }

        function toLineCapValue(value) {
            var normalized = value === null || value === undefined ? "" : String(value).toLowerCase();
            if (normalized === "round") {
                return 2;
            }
            if (normalized === "projecting") {
                return 3;
            }
            return 1;
        }

        var layer = null;
        var name = options.name && options.name.length > 0 ? options.name : null;
        var createdShapeType = null;

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
            var rootVectors = layer.property("ADBE Root Vectors Group");
            if (!rootVectors) {
                return encodePayload({ status: "error", message: "Shape root vectors not found." });
            }

            var vectorGroup = rootVectors.addProperty("ADBE Vector Group");
            if (!vectorGroup) {
                return encodePayload({ status: "error", message: "Failed to create shape vector group." });
            }

            var groupContents = vectorGroup.property("ADBE Vectors Group");
            if (!groupContents) {
                return encodePayload({ status: "error", message: "Failed to access shape group contents." });
            }

            var shapeType = options.shapeType ? String(options.shapeType).toLowerCase() : "ellipse";
            if (shapeType !== "ellipse" && shapeType !== "rect") {
                shapeType = "ellipse";
            }
            createdShapeType = shapeType;

            var shapeSize = toVec2(options.shapeSize, [Math.round(comp.width * 0.25), Math.round(comp.width * 0.25)]);
            if (shapeSize[0] <= 0) {
                shapeSize[0] = 1;
            }
            if (shapeSize[1] <= 0) {
                shapeSize[1] = 1;
            }
            var shapePosition = toVec2(options.shapePosition, [0, 0]);

            if (shapeType === "rect") {
                vectorGroup.name = "Rect";
                var rectPath = groupContents.addProperty("ADBE Vector Shape - Rect");
                if (!rectPath) {
                    return encodePayload({ status: "error", message: "Failed to create rectangle shape." });
                }
                rectPath.property("ADBE Vector Rect Size").setValue(shapeSize);
                rectPath.property("ADBE Vector Rect Position").setValue(shapePosition);
                var roundness = getNumber(options.shapeRoundness, 0);
                if (roundness < 0) {
                    roundness = 0;
                }
                rectPath.property("ADBE Vector Rect Roundness").setValue(roundness);
            } else {
                vectorGroup.name = "Ellipse";
                var ellipsePath = groupContents.addProperty("ADBE Vector Shape - Ellipse");
                if (!ellipsePath) {
                    return encodePayload({ status: "error", message: "Failed to create ellipse shape." });
                }
                ellipsePath.property("ADBE Vector Ellipse Size").setValue(shapeSize);
                ellipsePath.property("ADBE Vector Ellipse Position").setValue(shapePosition);
            }

            var fill = groupContents.addProperty("ADBE Vector Graphic - Fill");
            if (fill) {
                var fillColor = toColor01(options.shapeFillColor, [1, 1, 1]);
                var fillOpacity = clamp(getNumber(options.shapeFillOpacity, 100), 0, 100);
                fill.property("ADBE Vector Fill Color").setValue(fillColor);
                fill.property("ADBE Vector Fill Opacity").setValue(fillOpacity);
            }

            var shouldAddStroke =
                options.shapeStrokeColor !== undefined ||
                options.shapeStrokeOpacity !== undefined ||
                options.shapeStrokeWidth !== undefined ||
                options.shapeStrokeLineCap !== undefined;
            if (shouldAddStroke) {
                var stroke = groupContents.addProperty("ADBE Vector Graphic - Stroke");
                if (stroke) {
                    var strokeColor = toColor01(options.shapeStrokeColor, [1, 1, 1]);
                    var strokeOpacity = clamp(getNumber(options.shapeStrokeOpacity, 100), 0, 100);
                    var strokeWidth = getNumber(options.shapeStrokeWidth, 4);
                    if (strokeWidth < 0) {
                        strokeWidth = 0;
                    }
                    stroke.property("ADBE Vector Stroke Color").setValue(strokeColor);
                    stroke.property("ADBE Vector Stroke Opacity").setValue(strokeOpacity);
                    stroke.property("ADBE Vector Stroke Width").setValue(strokeWidth);
                    stroke.property("ADBE Vector Stroke Line Cap").setValue(toLineCapValue(options.shapeStrokeLineCap));
                }
            }
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
            layerType: getLayerTypeName(layer),
            shapeType: createdShapeType
        });
    } catch (e) {
        log("addLayer() threw: " + e.toString());
        return encodePayload({ status: "error", message: e.toString() });
    }
}
