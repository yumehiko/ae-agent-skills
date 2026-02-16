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
