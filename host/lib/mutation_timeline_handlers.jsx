function setInOutPoint(layerId, inPoint, outPoint) {
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

        var hasIn = inPoint !== null && inPoint !== undefined;
        var hasOut = outPoint !== null && outPoint !== undefined;
        if (!hasIn && !hasOut) {
            return encodePayload({ status: "error", message: "At least one of inPoint/outPoint is required." });
        }

        var nextIn = hasIn ? Number(inPoint) : Number(layer.inPoint);
        var nextOut = hasOut ? Number(outPoint) : Number(layer.outPoint);
        if (isNaN(nextIn) || isNaN(nextOut)) {
            return encodePayload({ status: "error", message: "inPoint/outPoint must be numeric." });
        }
        if (nextOut < nextIn) {
            return encodePayload({ status: "error", message: "outPoint must be greater than or equal to inPoint." });
        }

        if (hasIn) {
            layer.inPoint = nextIn;
        }
        if (hasOut) {
            layer.outPoint = nextOut;
        }

        return encodePayload({
            status: "success",
            layerId: layer.index,
            layerName: layer.name,
            inPoint: layer.inPoint,
            outPoint: layer.outPoint
        });
    } catch (e) {
        log("setInOutPoint() threw: " + e.toString());
        return encodePayload({ status: "error", message: e.toString() });
    }
}

function moveLayerTime(layerId, delta) {
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

        var deltaValue = Number(delta);
        if (isNaN(deltaValue)) {
            return encodePayload({ status: "error", message: "delta must be a number." });
        }

        layer.startTime = layer.startTime + deltaValue;

        return encodePayload({
            status: "success",
            layerId: layer.index,
            layerName: layer.name,
            startTime: layer.startTime,
            inPoint: layer.inPoint,
            outPoint: layer.outPoint
        });
    } catch (e) {
        log("moveLayerTime() threw: " + e.toString());
        return encodePayload({ status: "error", message: e.toString() });
    }
}

function setCTI(time) {
    try {
        ensureJSON();
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return encodePayload({ status: "error", message: "Active composition not found." });
        }

        var timeValue = Number(time);
        if (isNaN(timeValue)) {
            return encodePayload({ status: "error", message: "time must be a number." });
        }

        comp.time = timeValue;

        return encodePayload({
            status: "success",
            compId: comp.id,
            compName: comp.name,
            time: comp.time
        });
    } catch (e) {
        log("setCTI() threw: " + e.toString());
        return encodePayload({ status: "error", message: e.toString() });
    }
}

function setWorkArea(start, duration) {
    try {
        ensureJSON();
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return encodePayload({ status: "error", message: "Active composition not found." });
        }

        var startValue = Number(start);
        var durationValue = Number(duration);
        if (isNaN(startValue) || isNaN(durationValue)) {
            return encodePayload({ status: "error", message: "start and duration must be numbers." });
        }
        if (durationValue < 0) {
            return encodePayload({ status: "error", message: "duration must be greater than or equal to 0." });
        }

        comp.workAreaStart = startValue;
        comp.workAreaDuration = durationValue;

        return encodePayload({
            status: "success",
            compId: comp.id,
            compName: comp.name,
            start: comp.workAreaStart,
            duration: comp.workAreaDuration
        });
    } catch (e) {
        log("setWorkArea() threw: " + e.toString());
        return encodePayload({ status: "error", message: e.toString() });
    }
}
