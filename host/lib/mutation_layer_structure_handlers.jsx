function parentLayer(childLayerId, parentLayerId) {
    try {
        ensureJSON();
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return encodePayload({ status: "error", message: "Active composition not found." });
        }

        var child = comp.layer(childLayerId);
        if (!child) {
            return encodePayload({ status: "error", message: "Child layer with id " + childLayerId + " not found." });
        }

        var parent = null;
        if (parentLayerId !== null && parentLayerId !== undefined) {
            parent = comp.layer(parentLayerId);
            if (!parent) {
                return encodePayload({ status: "error", message: "Parent layer with id " + parentLayerId + " not found." });
            }
            if (parent.index === child.index) {
                return encodePayload({ status: "error", message: "A layer cannot be parented to itself." });
            }
        }

        child.parent = parent;

        return encodePayload({
            status: "success",
            childLayerId: child.index,
            childLayerName: child.name,
            parentLayerId: parent ? parent.index : null,
            parentLayerName: parent ? parent.name : null
        });
    } catch (e) {
        log("parentLayer() threw: " + e.toString());
        return encodePayload({ status: "error", message: e.toString() });
    }
}

function precomposeLayers(layerIdsJSON, name, moveAllAttributes) {
    try {
        ensureJSON();
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return encodePayload({ status: "error", message: "Active composition not found." });
        }
        if (!name || String(name).length === 0) {
            return encodePayload({ status: "error", message: "name is required." });
        }

        var layerIds = [];
        try {
            layerIds = JSON.parse(layerIdsJSON);
        } catch (eParse) {
            return encodePayload({ status: "error", message: "Invalid layerIds JSON: " + eParse.toString() });
        }
        if (!(layerIds instanceof Array) || layerIds.length === 0) {
            return encodePayload({ status: "error", message: "layerIds must be a non-empty array." });
        }

        var indices = [];
        for (var i = 0; i < layerIds.length; i++) {
            var layerIndex = Number(layerIds[i]);
            if (isNaN(layerIndex)) {
                return encodePayload({ status: "error", message: "layerIds must contain only numbers." });
            }
            var layer = comp.layer(layerIndex);
            if (!layer) {
                return encodePayload({ status: "error", message: "Layer with id " + layerIndex + " not found." });
            }
            indices.push(layerIndex);
        }

        var createdComp = comp.layers.precompose(indices, String(name), moveAllAttributes === true);
        if (!createdComp) {
            return encodePayload({ status: "error", message: "Failed to precompose layers." });
        }

        return encodePayload({
            status: "success",
            compId: createdComp.id,
            compName: createdComp.name,
            layerIds: indices
        });
    } catch (e) {
        log("precomposeLayers() threw: " + e.toString());
        return encodePayload({ status: "error", message: e.toString() });
    }
}

function duplicateLayer(layerId) {
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

        var duplicated = layer.duplicate();
        if (!duplicated) {
            return encodePayload({ status: "error", message: "Failed to duplicate layer." });
        }

        return encodePayload({
            status: "success",
            sourceLayerId: layer.index,
            sourceLayerName: layer.name,
            duplicatedLayerId: duplicated.index,
            duplicatedLayerName: duplicated.name
        });
    } catch (e) {
        log("duplicateLayer() threw: " + e.toString());
        return encodePayload({ status: "error", message: e.toString() });
    }
}

function moveLayerOrder(layerId, beforeLayerId, afterLayerId, toTop, toBottom) {
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

        var hasBefore = beforeLayerId !== null && beforeLayerId !== undefined;
        var hasAfter = afterLayerId !== null && afterLayerId !== undefined;
        var hasTop = toTop === true;
        var hasBottom = toBottom === true;
        var selectorCount = 0;
        if (hasBefore) selectorCount += 1;
        if (hasAfter) selectorCount += 1;
        if (hasTop) selectorCount += 1;
        if (hasBottom) selectorCount += 1;
        if (selectorCount !== 1) {
            return encodePayload({
                status: "error",
                message: "Specify exactly one of beforeLayerId, afterLayerId, toTop, toBottom."
            });
        }

        if (hasBefore) {
            var beforeLayer = comp.layer(beforeLayerId);
            if (!beforeLayer) {
                return encodePayload({ status: "error", message: "beforeLayerId target not found." });
            }
            if (beforeLayer.index === layer.index) {
                return encodePayload({ status: "error", message: "Cannot move layer relative to itself." });
            }
            layer.moveBefore(beforeLayer);
        } else if (hasAfter) {
            var afterLayer = comp.layer(afterLayerId);
            if (!afterLayer) {
                return encodePayload({ status: "error", message: "afterLayerId target not found." });
            }
            if (afterLayer.index === layer.index) {
                return encodePayload({ status: "error", message: "Cannot move layer relative to itself." });
            }
            layer.moveAfter(afterLayer);
        } else if (hasTop) {
            layer.moveToBeginning();
        } else if (hasBottom) {
            layer.moveToEnd();
        }

        return encodePayload({
            status: "success",
            layerId: layer.index,
            layerName: layer.name
        });
    } catch (e) {
        log("moveLayerOrder() threw: " + e.toString());
        return encodePayload({ status: "error", message: e.toString() });
    }
}

function deleteLayer(layerId) {
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

        var removedLayerId = layer.index;
        var removedLayerName = layer.name;
        layer.remove();

        return encodePayload({
            status: "success",
            layerId: removedLayerId,
            layerName: removedLayerName
        });
    } catch (e) {
        log("deleteLayer() threw: " + e.toString());
        return encodePayload({ status: "error", message: e.toString() });
    }
}

function deleteComp(compId, compName) {
    try {
        ensureJSON();
        var comp = findCompByIdOrName(compId, compName);
        if (!comp) {
            return encodePayload({ status: "error", message: "Composition not found." });
        }

        var removedCompId = comp.id;
        var removedCompName = comp.name;
        comp.remove();

        return encodePayload({
            status: "success",
            compId: removedCompId,
            compName: removedCompName
        });
    } catch (e) {
        log("deleteComp() threw: " + e.toString());
        return encodePayload({ status: "error", message: e.toString() });
    }
}
