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
