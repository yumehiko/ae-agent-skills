function getPropertyValueDimensions(prop) {
    try {
        var valueType = prop.propertyValueType;
        if (valueType === PropertyValueType.ThreeD || valueType === PropertyValueType.ThreeD_SPATIAL) {
            return 3;
        }
        if (valueType === PropertyValueType.TwoD || valueType === PropertyValueType.TwoD_SPATIAL) {
            return 2;
        }
        if (valueType === PropertyValueType.COLOR) {
            return 4;
        }
    } catch (eType) {}
    try {
        var currentValue = prop.value;
        if (currentValue instanceof Array) {
            return currentValue.length;
        }
    } catch (eValue) {}
    return 1;
}

function getValueDimensions(value) {
    if (value instanceof Array) {
        return value.length;
    }
    return 1;
}

function normalizeValueDimensions(value, expectedDimensions, gotDimensions) {
    if (expectedDimensions === gotDimensions) {
        return value;
    }
    // Allow natural 2D input for 3D vector properties by filling Z with 0.
    if (expectedDimensions === 3 && gotDimensions === 2 && value instanceof Array) {
        return [value[0], value[1], 0];
    }
    return null;
}

function getKeyInterpTypeByName(name) {
    if (!name || typeof name !== "string") {
        return null;
    }
    var normalized = name.toLowerCase();
    if (normalized === "linear") {
        return KeyframeInterpolationType.LINEAR;
    }
    if (normalized === "bezier") {
        return KeyframeInterpolationType.BEZIER;
    }
    if (normalized === "hold") {
        return KeyframeInterpolationType.HOLD;
    }
    return null;
}

function getPropertyTemporalDimensions(prop) {
    try {
        var valueType = prop.propertyValueType;
        if (
            valueType === PropertyValueType.TwoD_SPATIAL
            || valueType === PropertyValueType.ThreeD_SPATIAL
            || valueType === PropertyValueType.SHAPE
            || valueType === PropertyValueType.CUSTOM_VALUE
            || valueType === PropertyValueType.MARKER
            || valueType === PropertyValueType.NO_VALUE
        ) {
            return 1;
        }
        if (valueType === PropertyValueType.ThreeD) {
            return 3;
        }
        if (valueType === PropertyValueType.TwoD) {
            return 2;
        }
    } catch (eType) {}
    try {
        var currentValue = prop.value;
        if (currentValue instanceof Array && currentValue.length > 0) {
            return currentValue.length;
        }
    } catch (eValue) {}
    return 1;
}

function toTemporalEaseArray(spec, dimensions, label) {
    if (spec === null || spec === undefined) {
        return null;
    }
    var pairs = [];
    if (
        spec instanceof Array
        && spec.length === 2
        && typeof spec[0] === "number"
        && typeof spec[1] === "number"
    ) {
        for (var i = 0; i < dimensions; i += 1) {
            pairs.push([spec[0], spec[1]]);
        }
    } else if (spec instanceof Array && spec.length === dimensions) {
        for (var j = 0; j < spec.length; j += 1) {
            var part = spec[j];
            var validPart = (
                part instanceof Array
                && part.length === 2
                && typeof part[0] === "number"
                && typeof part[1] === "number"
            );
            if (!validPart) {
                throw new Error(label + " must be [speed,influence] or an array of [speed,influence] per dimension.");
            }
            pairs.push([part[0], part[1]]);
        }
    } else {
        throw new Error(label + " must be [speed,influence] or an array of [speed,influence] per dimension.");
    }

    var eases = [];
    for (var k = 0; k < pairs.length; k += 1) {
        var speed = Number(pairs[k][0]);
        var influence = Number(pairs[k][1]);
        if (isNaN(speed) || isNaN(influence)) {
            throw new Error(label + " includes a non-numeric value.");
        }
        if (influence < 0.1) influence = 0.1;
        if (influence > 100.0) influence = 100.0;
        eases.push(new KeyframeEase(speed, influence));
    }
    return eases;
}

function buildDefaultTemporalEase(dimensions) {
    var eases = [];
    for (var i = 0; i < dimensions; i += 1) {
        eases.push(new KeyframeEase(0, 33.333));
    }
    return eases;
}

function removePropertyKeyframes(layer, propertyPath) {
    var prop = resolveProperty(layer, propertyPath);
    if (!prop) {
        throw new Error("Property with path '" + propertyPath + "' not found.");
    }
    if (typeof prop.numKeys !== "number" || typeof prop.removeKey !== "function") {
        throw new Error("Property does not expose removable keyframes: " + propertyPath);
    }
    var removed = prop.numKeys;
    for (var i = prop.numKeys; i >= 1; i--) {
        prop.removeKey(i);
    }
    return removed;
}

function applyKeyframeInterpolation(prop, keyIndex, inInterpName, outInterpName) {
    if (!inInterpName && !outInterpName) {
        return;
    }
    var currentInType = KeyframeInterpolationType.LINEAR;
    var currentOutType = KeyframeInterpolationType.LINEAR;
    try {
        currentInType = prop.keyInInterpolationType(keyIndex);
    } catch (eInType) {}
    try {
        currentOutType = prop.keyOutInterpolationType(keyIndex);
    } catch (eOutType) {}

    var inType = inInterpName ? getKeyInterpTypeByName(inInterpName) : currentInType;
    var outType = outInterpName ? getKeyInterpTypeByName(outInterpName) : currentOutType;
    if (!inType || !outType) {
        throw new Error("Invalid interpolation type. Use linear, bezier, or hold.");
    }
    prop.setInterpolationTypeAtKey(keyIndex, inType, outType);
}

function applyKeyframeTemporalEase(prop, keyIndex, easeInSpec, easeOutSpec) {
    if (easeInSpec === undefined && easeOutSpec === undefined) {
        return;
    }
    var dimensions = getPropertyTemporalDimensions(prop);
    var currentIn = null;
    var currentOut = null;
    try {
        currentIn = prop.keyInTemporalEase(keyIndex);
    } catch (eInEase) {}
    try {
        currentOut = prop.keyOutTemporalEase(keyIndex);
    } catch (eOutEase) {}

    var inEase = toTemporalEaseArray(easeInSpec, dimensions, "easeIn");
    var outEase = toTemporalEaseArray(easeOutSpec, dimensions, "easeOut");
    if (!inEase) {
        inEase = currentIn || buildDefaultTemporalEase(dimensions);
    }
    if (!outEase) {
        outEase = currentOut || buildDefaultTemporalEase(dimensions);
    }
    prop.setTemporalEaseAtKey(keyIndex, inEase, outEase);
}

function setKeyframe(layerId, layerName, propertyPath, time, valueJSON, optionsJSON) {
    try {
        ensureJSON();
        var comp = app.project.activeItem;
        var resolvedLayer = aeResolveLayer(comp, layerId, layerName);
        if (resolvedLayer.error) {
            return encodePayload({ status: "error", message: resolvedLayer.error });
        }
        var layer = resolvedLayer.layer;

        var prop = resolveProperty(layer, propertyPath);
        if (!prop) {
            return encodePayload({ status: "error", message: "Property with path '" + propertyPath + "' not found." });
        }

        if (typeof prop.canVaryOverTime === "boolean" && !prop.canVaryOverTime) {
            return encodePayload({ status: "error", message: "Property cannot be keyframed." });
        }
        if (typeof prop.setValueAtTime !== "function") {
            return encodePayload({ status: "error", message: "Property does not support setValueAtTime()." });
        }

        var timeValue = Number(time);
        if (isNaN(timeValue)) {
            return encodePayload({ status: "error", message: "time must be a number." });
        }

        var value = JSON.parse(valueJSON);
        var expectedDimensions = getPropertyValueDimensions(prop);
        var gotDimensions = getValueDimensions(value);
        var normalizedValue = normalizeValueDimensions(value, expectedDimensions, gotDimensions);
        if (normalizedValue === null) {
            return encodePayload({
                status: "error",
                message: "Value dimension mismatch: expected " + expectedDimensions + "D, got " + gotDimensions + "D.",
                expectedDimensions: expectedDimensions,
                gotDimensions: gotDimensions
            });
        }
        prop.setValueAtTime(timeValue, normalizedValue);

        var options = {};
        if (optionsJSON && optionsJSON !== "null") {
            try {
                options = JSON.parse(optionsJSON);
            } catch (eParse) {
                return encodePayload({ status: "error", message: "Invalid options JSON: " + eParse.toString() });
            }
        }

        var keyIndex = null;
        try {
            keyIndex = prop.nearestKeyIndex(timeValue);
        } catch (eKey) {}
        if (!keyIndex) {
            return encodePayload({ status: "error", message: "Failed to resolve inserted keyframe index." });
        }

        applyKeyframeInterpolation(prop, keyIndex, options.inInterp, options.outInterp);
        applyKeyframeTemporalEase(prop, keyIndex, options.easeIn, options.easeOut);

        return encodePayload({
            status: "success",
            layerId: layer.index,
            layerUid: aeTryGetLayerUid(layer),
            layerName: layer.name,
            propertyPath: propertyPath,
            time: timeValue,
            keyIndex: keyIndex,
            inInterp: options.inInterp || null,
            outInterp: options.outInterp || null,
            easeIn: options.easeIn === undefined ? null : options.easeIn,
            easeOut: options.easeOut === undefined ? null : options.easeOut
        });
    } catch (e) {
        log("setKeyframe() threw: " + e.toString());
        return encodePayload({ status: "error", message: e.toString() });
    }
}

// Single-key edits deliberately avoid removePropertyKeyframes / JSON value conversion.
// AE has no native moveKey: prepare the replacement fully before removing the source.
function aeSingleKeySnapshot(prop, index) {
    var state = {
        time: prop.keyTime(index), value: prop.keyValue(index),
        inType: prop.keyInInterpolationType(index), outType: prop.keyOutInterpolationType(index),
        inEase: prop.keyInTemporalEase(index), outEase: prop.keyOutTemporalEase(index),
        temporalContinuous: prop.keyTemporalContinuous(index),
        temporalAutoBezier: prop.keyTemporalAutoBezier(index),
        selected: prop.keySelected(index), spatial: prop.isSpatial === true
    };
    if (state.spatial) {
        state.inTangent = prop.keyInSpatialTangent(index);
        state.outTangent = prop.keyOutSpatialTangent(index);
        state.spatialContinuous = prop.keySpatialContinuous(index);
        state.spatialAutoBezier = prop.keySpatialAutoBezier(index);
        state.roving = prop.keyRoving(index);
    }
    // Key labels were added in AE 22.6. Older hosts have neither API.
    if (typeof prop.keyLabel === "function" || typeof prop.setLabelAtKey === "function") {
        if (typeof prop.keyLabel !== "function" || typeof prop.setLabelAtKey !== "function") {
            throw new Error("Key label preservation is not supported by this host.");
        }
        state.label = prop.keyLabel(index);
    }
    return state;
}

function aeRestoreSingleKeyMetadata(prop, index, state) {
    prop.setInterpolationTypeAtKey(index, state.inType, state.outType);
    // LINEAR/HOLD ease speeds are derived from the new segment, not stored
    // settings. Only BEZIER sides have authored temporal ease to restore.
    if (state.inType === KeyframeInterpolationType.BEZIER || state.outType === KeyframeInterpolationType.BEZIER) {
        prop.setTemporalEaseAtKey(index, state.inEase, state.outEase);
    }
    prop.setTemporalContinuousAtKey(index, state.temporalContinuous);
    prop.setTemporalAutoBezierAtKey(index, state.temporalAutoBezier);
    if (state.spatial) {
        prop.setSpatialTangentsAtKey(index, state.inTangent, state.outTangent);
        prop.setSpatialContinuousAtKey(index, state.spatialContinuous);
        prop.setSpatialAutoBezierAtKey(index, state.spatialAutoBezier);
        prop.setRovingAtKey(index, state.roving);
    }
    if (state.label !== undefined) prop.setLabelAtKey(index, state.label);
    prop.setSelectedAtKey(index, state.selected);
}

function aeRestoreSingleKeySelection(prop, index, state) {
    // AE may clear selection on surviving keys when removeKey runs, including
    // the prepared replacement. Restore only selection, only if it changed,
    // and only after confirming this is still the expected key.
    if (Math.abs(prop.keyTime(index) - state.time) <= 0.00000001
        && prop.keySelected(index) !== state.selected) {
        prop.setSelectedAtKey(index, state.selected);
    }
}

function aeFindSingleKeyIndex(prop, time, tolerance, errorMessage) {
    // nearestKeyIndex can resolve the wrong key on negative-stretch layers.
    // Read native times directly and refuse missing or ambiguous matches.
    var match = null;
    for (var i = 1; i <= prop.numKeys; i++) {
        if (Math.abs(prop.keyTime(i) - time) <= tolerance) {
            if (match !== null) throw new Error(errorMessage);
            match = i;
        }
    }
    if (match === null) throw new Error(errorMessage);
    return match;
}

function aeMatchSingleKeyIndices(prop, expected, errorMessage) {
    // Native indices can run backwards in composition time. Match every
    // expected key by time, without reusing a native key.
    var indices = [], used = {};
    for (var i = 0; i < expected.length; i++) {
        var index = aeFindSingleKeyIndex(prop, expected[i].time, 0.00000001, errorMessage);
        if (used[index]) throw new Error(errorMessage);
        used[index] = true;
        indices.push(index);
    }
    return indices;
}

function aeValidateSingleKeyProperty(prop) {
    var type = prop.propertyValueType;
    if (type !== PropertyValueType.OneD && type !== PropertyValueType.TwoD
        && type !== PropertyValueType.ThreeD && type !== PropertyValueType.TwoD_SPATIAL
        && type !== PropertyValueType.ThreeD_SPATIAL && type !== PropertyValueType.COLOR) {
        throw new Error("Single-key edits support numeric properties only (not text, shape, marker, or custom values).");
    }
    // These modes may recalculate other key times/eases/tangents when a key is inserted
    // or removed. Reject the entire property rather than silently alter neighboring keys.
    for (var i = 1; i <= prop.numKeys; i++) {
        if (prop.keyTemporalAutoBezier(i)
            || (prop.isSpatial && (prop.keySpatialAutoBezier(i) || prop.keyRoving(i)))) {
            throw new Error("Single-key edits cannot safely preserve properties containing auto-Bezier or roving keys.");
        }
    }
}

// Compare native numeric values/eases explicitly; ExtendScript host objects do not
// reliably serialize their fields through JSON.stringify.
function aeSingleKeyValueEqual(a, b) {
    if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) <= 0.00000001 * Math.max(1, Math.abs(a), Math.abs(b));
    if (a instanceof Array && b instanceof Array) {
        if (a.length !== b.length) return false;
        for (var i = 0; i < a.length; i++) if (!aeSingleKeyValueEqual(a[i], b[i])) return false;
        return true;
    }
    return a === b;
}

function aeSingleKeyStateEqual(a, b, timeTolerance) {
    // Time tolerances are absolute seconds, independent of composition duration.
    if (Math.abs(a.time - b.time) > (timeTolerance === undefined ? 0.00000001 : timeTolerance)) return false;
    var fields = [ "value", "inType", "outType", "temporalContinuous", "temporalAutoBezier", "selected", "spatial", "label"];
    if (a.spatial) fields = fields.concat(["inTangent", "outTangent", "spatialContinuous", "spatialAutoBezier", "roving"]);
    for (var f = 0; f < fields.length; f++) {
        if (!aeSingleKeyValueEqual(a[fields[f]], b[fields[f]])) return false;
    }
    var directions = ["inEase", "outEase"];
    for (var d = 0; d < directions.length; d++) {
        var interpolation = d === 0 ? a.inType : a.outType;
        if (interpolation !== KeyframeInterpolationType.BEZIER) continue;
        var left = a[directions[d]], right = b[directions[d]];
        if (left.length !== right.length) return false;
        for (var i = 0; i < left.length; i++) {
            if (!aeSingleKeyValueEqual(left[i].speed, right[i].speed)
                || !aeSingleKeyValueEqual(left[i].influence, right[i].influence)) return false;
        }
    }
    return true;
}

function editSingleKeyframe(layerId, layerName, propertyPath, keyIndex, action, time) {
    var undoOpen = false;
    var prop = null;
    var inserted = false;
    var removalAttempted = false;
    var insertionAttempted = false;
    var originalCount = 0;
    var insertedTime = null;
    try {
        ensureJSON();
        if (action !== "move" && action !== "delete") throw new Error("Unsupported single-key action.");
        if (typeof keyIndex !== "number" || !isFinite(keyIndex) || keyIndex < 1 || Math.floor(keyIndex) !== keyIndex) {
            throw new Error("keyIndex must be an AE 1-based positive integer.");
        }
        if (action === "move" && (typeof time !== "number" || !isFinite(time))) {
            throw new Error("time must be finite seconds.");
        }
        var resolved = aeResolveLayer(app.project.activeItem, layerId, layerName);
        if (resolved.error) throw new Error(resolved.error);
        if (resolved.layer.locked) throw new Error("Cannot edit a key on a locked layer.");
        prop = resolveProperty(resolved.layer, propertyPath);
        if (!prop) throw new Error("Property not found: " + propertyPath);
        if (typeof prop.numKeys !== "number" || keyIndex > prop.numKeys) throw new Error("Key index out of range.");
        var oldTime = prop.keyTime(keyIndex);
        originalCount = prop.numKeys;
        if (action === "move" && time === oldTime) {
            return encodePayload({ status: "success", changed: false, keyIndex: keyIndex, time: oldTime });
        }
        aeValidateSingleKeyProperty(prop);
        var before = [];
        for (var b = 1; b <= prop.numKeys; b++) before.push(aeSingleKeySnapshot(prop, b));
        var state = before[keyIndex - 1];
        if (action === "move") {
            for (var i = 1; i <= prop.numKeys; i++) {
                if (Math.abs(prop.keyTime(i) - time) <= 0.000001) {
                    throw new Error("Destination collides with an existing key (within 0.000001 seconds).");
                }
            }
            var methods = ["addKey", "setValueAtKey", "setInterpolationTypeAtKey", "setTemporalEaseAtKey",
                "setTemporalContinuousAtKey", "setTemporalAutoBezierAtKey", "setSelectedAtKey", "removeKey"];
            if (state.spatial) methods = methods.concat(["setSpatialTangentsAtKey", "setSpatialContinuousAtKey", "setSpatialAutoBezierAtKey", "setRovingAtKey"]);
            for (var m = 0; m < methods.length; m++) {
                if (typeof prop[methods[m]] !== "function") throw new Error("Cannot preserve key: missing " + methods[m]);
            }
        }
        app.beginUndoGroup(action === "move" ? "Move single keyframe" : "Delete single keyframe");
        undoOpen = true;
        var newIndex = null;
        if (action === "move") {
            insertionAttempted = true;
            newIndex = prop.addKey(time);
            inserted = prop.numKeys === originalCount + 1;
            if (!inserted) throw new Error("AE did not create a distinct destination key; source was not removed.");
            insertedTime = prop.keyTime(newIndex);
            prop.setValueAtKey(newIndex, state.value);
            aeRestoreSingleKeyMetadata(prop, newIndex, state);
            var replacementExpected = {};
            for (var field in state) if (state.hasOwnProperty(field)) replacementExpected[field] = state[field];
            replacementExpected.time = time;
            if (!aeSingleKeyStateEqual(replacementExpected, aeSingleKeySnapshot(prop, newIndex), 0.000001)) {
                throw new Error("Replacement metadata verification failed; source was not removed.");
            }
            var sourceIndex = aeFindSingleKeyIndex(prop, oldTime, 0.00000001,
                "Cannot identify source key; source was not removed.");
            removalAttempted = true;
            prop.removeKey(sourceIndex);
            newIndex = aeFindSingleKeyIndex(prop, insertedTime, 0.00000001,
                "Cannot identify moved key after source removal.");
        } else {
            removalAttempted = true;
            prop.removeKey(keyIndex);
        }
        var expected = [];
        for (var k = 0; k < before.length; k++) {
            if (k === keyIndex - 1) {
                if (action === "delete") continue;
                before[k].time = insertedTime;
            }
            expected.push(before[k]);
        }
        if (prop.numKeys !== expected.length) throw new Error("Key count verification failed; use Undo to restore the previous track.");
        var expectedIndices = aeMatchSingleKeyIndices(prop, expected,
            "Key metadata verification failed: key times do not match; use Undo to restore the previous track.");
        for (var v = 0; v < expected.length; v++) {
            aeRestoreSingleKeySelection(prop, expectedIndices[v], expected[v]);
        }
        for (var v = 0; v < expected.length; v++) {
            if (!aeSingleKeyStateEqual(expected[v], aeSingleKeySnapshot(prop, expectedIndices[v]))) {
                throw new Error("Key metadata verification failed at index " + expectedIndices[v] + "; use Undo to restore the previous track.");
            }
        }
        if (action === "delete" && prop.numKeys === 0
            && !aeSingleKeyValueEqual(prop.valueAtTime(oldTime, true), state.value)) {
            throw new Error("Static value verification failed after deleting the last key; use Undo to restore.");
        }
        return encodePayload({ status: "success", changed: true, action: action,
            layerId: resolved.layer.index, layerUid: aeTryGetLayerUid(resolved.layer),
            layerName: resolved.layer.name, propertyPath: propertyPath,
            oldKeyIndex: keyIndex, oldTime: oldTime, keyIndex: newIndex,
            time: action === "move" ? prop.keyTime(newIndex) : null, numKeys: prop.numKeys });
    } catch (e) {
        var rollbackError = null;
        // Before source removal, only the new key needs rollback. Never rebuild the track.
        if (insertionAttempted && !removalAttempted && prop.numKeys === originalCount + 1) {
            try {
                var rollbackTime = insertedTime === null ? time : insertedTime;
                var rollbackIndex = aeFindSingleKeyIndex(prop, rollbackTime,
                    insertedTime === null ? 0.000001 : 0.00000001, "Cannot identify inserted key for rollback.");
                for (var original = 0; original < before.length; original++) {
                    if (prop.keyTime(rollbackIndex) === before[original].time) throw new Error("Rollback candidate is an original key.");
                }
                prop.removeKey(rollbackIndex);
            }
            catch (rollback) { rollbackError = rollback.toString(); }
        }
        if (insertionAttempted && !removalAttempted && rollbackError === null) {
            try {
                if (prop.numKeys !== before.length) throw new Error("Rollback key count mismatch.");
                var rollbackIndices = aeMatchSingleKeyIndices(prop, before, "Rollback metadata mismatch: key times do not match.");
                for (var r = 0; r < before.length; r++) {
                    aeRestoreSingleKeySelection(prop, rollbackIndices[r], before[r]);
                }
                for (var r = 0; r < before.length; r++) {
                    if (!aeSingleKeyStateEqual(before[r], aeSingleKeySnapshot(prop, rollbackIndices[r]))) {
                        throw new Error("Rollback metadata mismatch at key " + rollbackIndices[r]);
                    }
                }
            } catch (verification) { rollbackError = verification.toString(); }
        }
        return encodePayload({ status: "error", message: e.toString()
            + (removalAttempted || rollbackError !== null ? " The track may have changed; inspect it and use Undo before retrying." : ""),
            rollbackError: rollbackError, mayHaveChanged: removalAttempted || rollbackError !== null });
    } finally {
        if (undoOpen) app.endUndoGroup();
    }
}
