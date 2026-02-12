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
