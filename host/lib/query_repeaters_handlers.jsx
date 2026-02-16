function getRepeaters(layerId, optionsJSON) {
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
        if (layer.matchName !== "ADBE Vector Layer") {
            return encodePayload([]);
        }
        var rootVectors = layer.property("ADBE Root Vectors Group");
        if (!rootVectors) {
            return encodePayload([]);
        }

        function readNumber(prop) {
            if (!prop) {
                return null;
            }
            try {
                var value = prop.value;
                if (typeof value === "number" && isFinite(value)) {
                    return value;
                }
            } catch (eRead) {}
            return null;
        }

        function readVec2(prop) {
            if (!prop) {
                return null;
            }
            try {
                var value = prop.value;
                if (value instanceof Array && value.length >= 2) {
                    var x = Number(value[0]);
                    var y = Number(value[1]);
                    if (!isNaN(x) && !isNaN(y)) {
                        return [x, y];
                    }
                }
            } catch (eRead) {}
            return null;
        }

        var repeaters = [];
        for (var gi = 1; gi <= rootVectors.numProperties; gi++) {
            var group = rootVectors.property(gi);
            if (!group || group.matchName !== "ADBE Vector Group") {
                continue;
            }
            var contents = group.property("ADBE Vectors Group");
            if (!contents) {
                continue;
            }
            for (var ci = 1; ci <= contents.numProperties; ci++) {
                var item = contents.property(ci);
                if (!item || item.matchName !== "ADBE Vector Filter - Repeater") {
                    continue;
                }
                var repeater = {
                    layerId: layer.index,
                    layerUid: aeTryGetLayerUid(layer),
                    layerName: layer.name,
                    groupIndex: gi,
                    name: item.name
                };
                var copies = readNumber(item.property("ADBE Vector Repeater Copies"));
                if (copies !== null) repeater.copies = copies;
                var offset = readNumber(item.property("ADBE Vector Repeater Offset"));
                if (offset !== null) repeater.offset = offset;

                var transform = item.property("ADBE Vector Repeater Transform");
                if (transform) {
                    var position = readVec2(transform.property("ADBE Vector Repeater Position"));
                    if (position) repeater.position = position;
                    var scale = readVec2(transform.property("ADBE Vector Repeater Scale"));
                    if (scale) repeater.scale = scale;
                    var rotation = readNumber(transform.property("ADBE Vector Repeater Rotation"));
                    if (rotation !== null) repeater.rotation = rotation;
                    var startOpacity = readNumber(transform.property("ADBE Vector Repeater Opacity 1"));
                    if (startOpacity !== null) repeater.startOpacity = startOpacity;
                    var endOpacity = readNumber(transform.property("ADBE Vector Repeater Opacity 2"));
                    if (endOpacity !== null) repeater.endOpacity = endOpacity;
                }
                repeaters.push(repeater);
            }
        }
        return encodePayload(repeaters);
    } catch (e) {
        log("getRepeaters() threw: " + e.toString());
        return encodePayload({ status: "Error", message: e.toString() });
    }
}
