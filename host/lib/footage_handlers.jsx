function aeIsFileFootageItem(item) {
    if (!item || !(item instanceof FootageItem)) {
        return false;
    }
    try {
        if (item.mainSource instanceof SolidSource) {
            return false;
        }
    } catch (eSource) {}
    try {
        return item.file !== null && item.file !== undefined;
    } catch (eFile) {
        return false;
    }
}

function aeNormalizeFootagePath(pathValue) {
    if (pathValue === null || pathValue === undefined || String(pathValue).length === 0) {
        return null;
    }
    var file = new File(String(pathValue));
    var normalized = file.fsName;
    try {
        if ($.os && String($.os).toLowerCase().indexOf("windows") >= 0) {
            normalized = normalized.toLowerCase();
        }
    } catch (eOs) {}
    return normalized;
}

function aeFootageItemSummary(item, reused) {
    var itemPath = null;
    var missing = null;
    try {
        if (item.file) {
            itemPath = item.file.fsName;
            missing = !item.file.exists;
        }
    } catch (eFile) {}
    return {
        id: item.id,
        name: item.name,
        path: itemPath,
        duration: item.duration,
        width: item.width,
        height: item.height,
        frameRate: item.frameRate,
        hasVideo: item.hasVideo,
        hasAudio: item.hasAudio,
        missing: missing,
        reused: reused === true
    };
}

function aeFindFootageByPath(pathValue) {
    if (!app.project) {
        return null;
    }
    var targetPath = aeNormalizeFootagePath(pathValue);
    if (!targetPath) {
        return null;
    }
    for (var i = 1; i <= app.project.numItems; i++) {
        var item = app.project.item(i);
        if (!aeIsFileFootageItem(item)) {
            continue;
        }
        var itemPath = null;
        try {
            itemPath = aeNormalizeFootagePath(item.file.fsName);
        } catch (ePath) {}
        if (itemPath === targetPath) {
            return item;
        }
    }
    return null;
}

function aeFindFootageByIdOrName(itemId, itemName) {
    if (!app.project) {
        return { item: null, error: "Project not found." };
    }
    var hasId = itemId !== null && itemId !== undefined && itemId !== "";
    var hasName = itemName !== null && itemName !== undefined && String(itemName).length > 0;
    if ((hasId && hasName) || (!hasId && !hasName)) {
        return { item: null, error: "Provide exactly one of footageId or footageName." };
    }
    if (hasId) {
        var parsedId = parseInt(itemId, 10);
        for (var i = 1; i <= app.project.numItems; i++) {
            var itemById = app.project.item(i);
            if (itemById && itemById.id === parsedId && aeIsFileFootageItem(itemById)) {
                return { item: itemById, error: null };
            }
        }
        return { item: null, error: "Footage item with id " + parsedId + " not found." };
    }

    var targetName = String(itemName);
    var matched = null;
    var matchCount = 0;
    for (var j = 1; j <= app.project.numItems; j++) {
        var itemByName = app.project.item(j);
        if (aeIsFileFootageItem(itemByName) && itemByName.name === targetName) {
            matched = itemByName;
            matchCount += 1;
        }
    }
    if (matchCount === 0 || !matched) {
        return { item: null, error: "Footage item with name '" + targetName + "' not found." };
    }
    if (matchCount > 1) {
        return { item: null, error: "Multiple footage items share the name '" + targetName + "'. Use footageId." };
    }
    return { item: matched, error: null };
}

function aeResolveOrImportFootage(pathValue, itemName) {
    if (!app.project) {
        app.newProject();
    }
    var file = new File(String(pathValue));
    if (!file.exists) {
        throw new Error("Footage file not found: " + file.fsName);
    }
    var existing = aeFindFootageByPath(file.fsName);
    if (existing) {
        if (itemName !== null && itemName !== undefined && String(itemName).length > 0) {
            existing.name = String(itemName);
        }
        return { item: existing, reused: true };
    }

    var importOptions = new ImportOptions(file);
    try {
        if (importOptions.canImportAs(ImportAsType.FOOTAGE)) {
            importOptions.importAs = ImportAsType.FOOTAGE;
        }
    } catch (eImportAs) {}
    var imported = app.project.importFile(importOptions);
    if (!imported || !(imported instanceof FootageItem)) {
        throw new Error("Failed to import footage: " + file.fsName);
    }
    if (itemName !== null && itemName !== undefined && String(itemName).length > 0) {
        imported.name = String(itemName);
    }
    return { item: imported, reused: false };
}

function listFootageItems() {
    try {
        ensureJSON();
        var items = [];
        if (!app.project) {
            return encodePayload(items);
        }
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (aeIsFileFootageItem(item)) {
                items.push(aeFootageItemSummary(item, false));
            }
        }
        return encodePayload(items);
    } catch (e) {
        log("listFootageItems() threw: " + e.toString());
        return encodePayload({ status: "error", message: e.toString() });
    }
}

function importFootage(pathValue, itemName) {
    try {
        ensureJSON();
        var resolved = aeResolveOrImportFootage(pathValue, itemName);
        var summary = aeFootageItemSummary(resolved.item, resolved.reused);
        summary.status = "success";
        return encodePayload(summary);
    } catch (e) {
        log("importFootage() threw: " + e.toString());
        return encodePayload({ status: "error", message: e.toString() });
    }
}

function aeApplyFootageCut(layer, sourceIn, sourceOut, timelineIn) {
    if (!layer || !(layer instanceof AVLayer) || !layer.source || !(layer.source instanceof FootageItem)) {
        throw new Error("Target layer is not a footage layer.");
    }
    var hasSourceIn = sourceIn !== null && sourceIn !== undefined;
    var hasSourceOut = sourceOut !== null && sourceOut !== undefined;
    if (hasSourceIn !== hasSourceOut) {
        throw new Error("sourceIn and sourceOut must be provided together.");
    }
    var targetTimelineIn = timelineIn === null || timelineIn === undefined ? 0 : Number(timelineIn);
    if (isNaN(targetTimelineIn) || !isFinite(targetTimelineIn) || targetTimelineIn < 0) {
        throw new Error("timelineIn must be a finite number greater than or equal to 0.");
    }
    var compDuration = Number(layer.containingComp.duration);
    if (targetTimelineIn > compDuration) {
        throw new Error("timelineIn exceeds composition duration (" + compDuration + ").");
    }

    if (!hasSourceIn) {
        layer.startTime = targetTimelineIn;
        layer.inPoint = targetTimelineIn;
        if (layer.source.duration > 0) {
            layer.outPoint = Math.min(targetTimelineIn + layer.source.duration, compDuration);
        }
        return {
            sourceIn: 0,
            sourceOut: layer.source.duration,
            timelineIn: targetTimelineIn,
            timelineOut: layer.outPoint
        };
    }

    var sourceStart = Number(sourceIn);
    var sourceEnd = Number(sourceOut);
    if (isNaN(sourceStart) || !isFinite(sourceStart) || sourceStart < 0) {
        throw new Error("sourceIn must be a finite number greater than or equal to 0.");
    }
    if (isNaN(sourceEnd) || !isFinite(sourceEnd) || sourceEnd <= sourceStart) {
        throw new Error("sourceOut must be a finite number greater than sourceIn.");
    }
    var sourceDuration = Number(layer.source.duration);
    if (sourceDuration > 0 && sourceEnd > sourceDuration + 0.0001) {
        throw new Error("sourceOut exceeds footage duration (" + sourceDuration + ").");
    }
    if (sourceDuration > 0 && sourceEnd > sourceDuration) {
        sourceEnd = sourceDuration;
    }

    var timelineOut = targetTimelineIn + (sourceEnd - sourceStart);
    if (timelineOut > compDuration + 0.0001) {
        throw new Error("Cut exceeds composition duration (" + compDuration + ").");
    }
    if (timelineOut > compDuration) {
        timelineOut = compDuration;
    }
    layer.startTime = targetTimelineIn - sourceStart;
    layer.inPoint = targetTimelineIn;
    layer.outPoint = timelineOut;
    return {
        sourceIn: sourceStart,
        sourceOut: sourceEnd,
        timelineIn: targetTimelineIn,
        timelineOut: timelineOut
    };
}

function addFootageLayer(footageId, footageName, pathValue, layerName, sourceIn, sourceOut, timelineIn) {
    try {
        ensureJSON();
        var comp = app.project ? app.project.activeItem : null;
        if (!comp || !(comp instanceof CompItem)) {
            return encodePayload({ status: "error", message: "Active composition not found." });
        }

        var selectorCount = 0;
        if (footageId !== null && footageId !== undefined) selectorCount += 1;
        if (footageName !== null && footageName !== undefined && String(footageName).length > 0) selectorCount += 1;
        if (pathValue !== null && pathValue !== undefined && String(pathValue).length > 0) selectorCount += 1;
        if (selectorCount !== 1) {
            return encodePayload({
                status: "error",
                message: "Provide exactly one of footageId, footageName, or path."
            });
        }

        var item = null;
        var reused = true;
        if (pathValue !== null && pathValue !== undefined && String(pathValue).length > 0) {
            var imported = aeResolveOrImportFootage(pathValue, null);
            item = imported.item;
            reused = imported.reused;
        } else {
            var resolved = aeFindFootageByIdOrName(footageId, footageName);
            if (resolved.error) {
                return encodePayload({ status: "error", message: resolved.error });
            }
            item = resolved.item;
        }

        var layer = comp.layers.add(item);
        if (!layer) {
            return encodePayload({ status: "error", message: "Failed to add footage layer." });
        }
        if (layerName !== null && layerName !== undefined && String(layerName).length > 0) {
            layer.name = String(layerName);
        }
        var timing = aeApplyFootageCut(layer, sourceIn, sourceOut, timelineIn);
        return encodePayload({
            status: "success",
            layerId: layer.index,
            layerUid: aeTryGetLayerUid(layer),
            layerName: layer.name,
            layerType: "Footage",
            footage: aeFootageItemSummary(item, reused),
            timing: timing
        });
    } catch (e) {
        log("addFootageLayer() threw: " + e.toString());
        return encodePayload({ status: "error", message: e.toString() });
    }
}

function setFootageLayerCut(layerId, layerName, sourceIn, sourceOut, timelineIn) {
    try {
        ensureJSON();
        var comp = app.project ? app.project.activeItem : null;
        var resolved = aeResolveLayer(comp, layerId, layerName);
        if (resolved.error) {
            return encodePayload({ status: "error", message: resolved.error });
        }
        var timing = aeApplyFootageCut(resolved.layer, sourceIn, sourceOut, timelineIn);
        return encodePayload({
            status: "success",
            layerId: resolved.layer.index,
            layerUid: aeTryGetLayerUid(resolved.layer),
            layerName: resolved.layer.name,
            footage: aeFootageItemSummary(resolved.layer.source, true),
            timing: timing
        });
    } catch (e) {
        log("setFootageLayerCut() threw: " + e.toString());
        return encodePayload({ status: "error", message: e.toString() });
    }
}
