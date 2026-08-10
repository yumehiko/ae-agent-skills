function aeResolveCompByIdOrName(compId, compName) {
    if (!app.project) {
        return { item: null, error: "Project not found." };
    }
    var hasId = compId !== null && compId !== undefined && compId !== "";
    var hasName = compName !== null && compName !== undefined && String(compName).length > 0;
    if ((hasId && hasName) || (!hasId && !hasName)) {
        return { item: null, error: "Provide exactly one of compId or compName." };
    }

    if (hasId) {
        var parsedId = parseInt(compId, 10);
        for (var i = 1; i <= app.project.numItems; i++) {
            var itemById = app.project.item(i);
            if (itemById && itemById instanceof CompItem && itemById.id === parsedId) {
                return { item: itemById, error: null };
            }
        }
        return { item: null, error: "Composition with id " + parsedId + " not found." };
    }

    var targetName = String(compName);
    var matched = null;
    var matchCount = 0;
    for (var j = 1; j <= app.project.numItems; j++) {
        var itemByName = app.project.item(j);
        if (itemByName && itemByName instanceof CompItem && itemByName.name === targetName) {
            matched = itemByName;
            matchCount += 1;
        }
    }
    if (matchCount === 0 || !matched) {
        return { item: null, error: "Composition with name '" + targetName + "' not found." };
    }
    if (matchCount > 1) {
        return {
            item: null,
            error: "Multiple compositions share the name '" + targetName + "'. Use compId."
        };
    }
    return { item: matched, error: null };
}

function aeCompItemSummary(item) {
    return {
        id: item.id,
        name: item.name,
        width: item.width,
        height: item.height,
        pixelAspect: item.pixelAspect,
        duration: item.duration,
        frameRate: item.frameRate
    };
}

function aeCompositionSettingEquals(field, actual, declared) {
    if (field === "width" || field === "height") {
        return Number(actual) === Number(declared);
    }
    return Math.abs(Number(actual) - Number(declared)) <= 0.0001;
}

function aePlanCompositionSettingChanges(comp, compSpec) {
    var changes = [];
    var fields = ["width", "height", "pixelAspect", "frameRate", "duration"];
    for (var i = 0; i < fields.length; i++) {
        var field = fields[i];
        if (compSpec[field] === undefined) {
            continue;
        }
        var declared = Number(compSpec[field]);
        var actual = Number(comp[field]);
        if (!aeCompositionSettingEquals(field, actual, declared)) {
            changes.push({
                field: field,
                before: actual,
                declared: declared
            });
        }
    }
    return changes;
}

function aeApplyCompositionSettingChanges(comp, changes) {
    var applied = [];
    for (var i = 0; i < changes.length; i++) {
        var change = changes[i];
        comp[change.field] = change.declared;
        var actual = Number(comp[change.field]);
        if (!aeCompositionSettingEquals(change.field, actual, change.declared)) {
            throw new Error(
                "Failed to apply composition." + change.field
                + ": declared=" + change.declared + ", actual=" + actual + "."
            );
        }
        applied.push({
            field: change.field,
            before: change.before,
            declared: change.declared,
            actual: actual
        });
    }
    return applied;
}

function aeApplyCompLayerTiming(layer, startTime, inPoint, outPoint) {
    var hasStartTime = startTime !== null && startTime !== undefined;
    var hasInPoint = inPoint !== null && inPoint !== undefined;
    var hasOutPoint = outPoint !== null && outPoint !== undefined;
    var targetStartTime = hasStartTime ? Number(startTime) : layer.startTime;
    var targetInPoint = hasInPoint ? Number(inPoint) : layer.inPoint;
    var targetOutPoint = hasOutPoint ? Number(outPoint) : layer.outPoint;

    if (!isFinite(targetStartTime)) {
        throw new Error("startTime must be a finite number when specified.");
    }
    if (!isFinite(targetInPoint)) {
        throw new Error("inPoint must be a finite number when specified.");
    }
    if (!isFinite(targetOutPoint)) {
        throw new Error("outPoint must be a finite number when specified.");
    }
    if (targetOutPoint <= targetInPoint) {
        throw new Error("outPoint must be greater than inPoint.");
    }

    if (hasStartTime) {
        layer.startTime = targetStartTime;
    }
    if (hasInPoint) {
        layer.inPoint = targetInPoint;
    }
    if (hasOutPoint) {
        layer.outPoint = targetOutPoint;
    }
    return {
        startTime: layer.startTime,
        inPoint: layer.inPoint,
        outPoint: layer.outPoint
    };
}

function addCompLayer(compId, compName, layerName, startTime, inPoint, outPoint) {
    try {
        ensureJSON();
        var targetComp = app.project ? app.project.activeItem : null;
        if (!targetComp || !(targetComp instanceof CompItem)) {
            return encodePayload({ status: "error", message: "Active composition not found." });
        }

        var resolved = aeResolveCompByIdOrName(compId, compName);
        if (resolved.error) {
            return encodePayload({ status: "error", message: resolved.error });
        }
        var sourceComp = resolved.item;
        if (sourceComp === targetComp) {
            return encodePayload({
                status: "error",
                message: "A composition cannot be added as a layer inside itself."
            });
        }

        var layer = targetComp.layers.add(sourceComp);
        if (!layer) {
            return encodePayload({ status: "error", message: "Failed to add composition layer." });
        }
        if (layerName !== null && layerName !== undefined && String(layerName).length > 0) {
            layer.name = String(layerName);
        }
        var timing = aeApplyCompLayerTiming(layer, startTime, inPoint, outPoint);
        return encodePayload({
            status: "success",
            layerId: layer.index,
            layerUid: aeTryGetLayerUid(layer),
            layerName: layer.name,
            layerType: "Comp",
            source: aeCompItemSummary(sourceComp),
            timing: timing
        });
    } catch (e) {
        log("addCompLayer() threw: " + e.toString());
        return encodePayload({ status: "error", message: e.toString() });
    }
}
