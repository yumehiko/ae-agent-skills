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
