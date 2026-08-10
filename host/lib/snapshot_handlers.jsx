function aeSnapshotValidateTime(comp, time) {
    var parsed = Number(time);
    if (!isFinite(parsed)) {
        return { value: null, error: "time must be a finite number." };
    }
    var start = 0;
    try {
        start = Number(comp.displayStartTime) || 0;
    } catch (eStart) {}
    var end = start + Number(comp.duration);
    if (parsed < start || parsed > end) {
        return {
            value: null,
            error: "time must be within the composition range [" + start + ", " + end + "]."
        };
    }
    return { value: parsed, error: null };
}

function aeSnapshotValidateScale(scale) {
    var parsed = Number(scale);
    if (!isFinite(parsed) || parsed <= 0 || parsed > 1) {
        return { value: null, error: "scale must be greater than 0 and at most 1." };
    }
    return { value: parsed, error: null };
}

function aeSnapshotCreateScaledComp(sourceComp, scale) {
    var width = Math.max(1, Math.round(Number(sourceComp.width) * scale));
    var height = Math.max(1, Math.round(Number(sourceComp.height) * scale));
    var name = "__ae_snapshot_" + String(new Date().getTime());
    var snapshotComp = app.project.items.addComp(
        name,
        width,
        height,
        sourceComp.pixelAspect,
        sourceComp.duration,
        sourceComp.frameRate
    );
    try {
        snapshotComp.displayStartTime = sourceComp.displayStartTime;
    } catch (eDisplayStart) {}
    var sourceLayer = snapshotComp.layers.add(sourceComp);
    var transform = sourceLayer.property("ADBE Transform Group");
    transform.property("ADBE Anchor Point").setValue([
        Number(sourceComp.width) / 2,
        Number(sourceComp.height) / 2
    ]);
    transform.property("ADBE Position").setValue([width / 2, height / 2]);
    transform.property("ADBE Scale").setValue([scale * 100, scale * 100]);
    return snapshotComp;
}

function saveCompSnapshot(compId, compName, time, tempPath, scale) {
    var temporaryComp = null;
    var keepTemporaryComp = false;
    try {
        ensureJSON();
        if (!app.project) {
            return encodePayload({ status: "error", message: "Project not found." });
        }
        var resolvedComp = aeResolveCompByIdOrName(compId, compName);
        if (resolvedComp.error) {
            return encodePayload({ status: "error", message: resolvedComp.error });
        }
        if (typeof tempPath !== "string" || tempPath.length === 0) {
            return encodePayload({ status: "error", message: "tempPath is required." });
        }
        var comp = resolvedComp.item;
        var validatedTime = aeSnapshotValidateTime(comp, time);
        if (validatedTime.error) {
            return encodePayload({ status: "error", message: validatedTime.error });
        }
        var validatedScale = aeSnapshotValidateScale(scale);
        if (validatedScale.error) {
            return encodePayload({ status: "error", message: validatedScale.error });
        }
        var outputFile = new File(tempPath);
        if (!outputFile.parent || !outputFile.parent.exists) {
            return encodePayload({ status: "error", message: "Snapshot output directory not found." });
        }
        if (outputFile.exists) {
            try {
                outputFile.remove();
            } catch (eRemoveExisting) {}
        }

        var renderComp = comp;
        if (Math.abs(validatedScale.value - 1) > 0.000001) {
            temporaryComp = aeSnapshotCreateScaledComp(comp, validatedScale.value);
            renderComp = temporaryComp;
        }
        if (typeof renderComp.saveFrameToPng !== "function") {
            return encodePayload({
                status: "error",
                message: "This After Effects version does not expose CompItem.saveFrameToPng()."
            });
        }

        renderComp.saveFrameToPng(validatedTime.value, outputFile);
        keepTemporaryComp = temporaryComp !== null;
        return encodePayload({
            status: "success",
            compId: comp.id,
            compName: comp.name,
            time: validatedTime.value,
            scale: validatedScale.value,
            width: renderComp.width,
            height: renderComp.height,
            tempPath: outputFile.fsName,
            temporaryCompId: temporaryComp ? temporaryComp.id : null
        });
    } catch (e) {
        log("saveCompSnapshot() threw: " + e.toString());
        return encodePayload({ status: "error", message: e.toString() });
    } finally {
        if (temporaryComp && !keepTemporaryComp) {
            try {
                temporaryComp.remove();
            } catch (eRemoveComp) {
                log("saveCompSnapshot(): Failed to remove temporary comp - " + eRemoveComp.toString());
            }
        }
    }
}

function cleanupCompSnapshot(temporaryCompId) {
    try {
        ensureJSON();
        if (temporaryCompId === null || temporaryCompId === undefined) {
            return encodePayload({ status: "success", removed: false });
        }
        var parsedId = parseInt(temporaryCompId, 10);
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (!item || !(item instanceof CompItem) || item.id !== parsedId) {
                continue;
            }
            if (String(item.name).indexOf("__ae_snapshot_") !== 0) {
                return encodePayload({
                    status: "error",
                    message: "Refusing to remove a non-snapshot composition."
                });
            }
            item.remove();
            return encodePayload({ status: "success", removed: true });
        }
        return encodePayload({ status: "success", removed: false });
    } catch (e) {
        log("cleanupCompSnapshot() threw: " + e.toString());
        return encodePayload({ status: "error", message: e.toString() });
    }
}
