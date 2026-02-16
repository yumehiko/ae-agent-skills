function getEffects(layerId, optionsJSON) {
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
        var effectParade = layer.property("ADBE Effect Parade");
        if (!effectParade) {
            return encodePayload([]);
        }

        var effects = [];
        for (var i = 1; i <= effectParade.numProperties; i++) {
            var effect = effectParade.property(i);
            if (!effect) {
                continue;
            }
            var effectItem = {
                layerId: layer.index,
                layerUid: aeTryGetLayerUid(layer),
                layerName: layer.name,
                effectIndex: i,
                matchName: effect.matchName,
                name: effect.name,
                params: []
            };
            for (var p = 1; p <= effect.numProperties; p++) {
                var param = effect.property(p);
                if (!param || !aeIsPropertyNode(param) || !aeCanExposeProperty(param)) {
                    continue;
                }
                var paramMatchName = null;
                try {
                    paramMatchName = param.matchName;
                } catch (eMatch) {
                    paramMatchName = null;
                }
                effectItem.params.push({
                    propertyIndex: p,
                    name: param.name,
                    matchName: paramMatchName,
                    propertyPath: aeBuildPropertyPath(param),
                    value: aeSerializeKeyValue(param.value)
                });
            }
            effects.push(effectItem);
        }
        return encodePayload(effects);
    } catch (e) {
        log("getEffects() threw: " + e.toString());
        return encodePayload({ status: "Error", message: e.toString() });
    }
}
