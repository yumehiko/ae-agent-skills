function splitPropertyPath(path) {
    if (!path || typeof path !== "string") {
        return [];
    }
    var normalized = path;
    if (normalized.indexOf(">") >= 0) {
        normalized = normalized.replace(/\s*>\s*/g, ".");
    }
    var rawParts = normalized.split(".");
    var parts = [];
    for (var i = 0; i < rawParts.length; i++) {
        var part = rawParts[i];
        if (part === null || part === undefined) {
            continue;
        }
        var trimmed = String(part).replace(/^\s+|\s+$/g, "");
        if (trimmed.length > 0) {
            parts.push(trimmed);
        }
    }
    return parts;
}

function resolveProperty(layer, path) {
    var parts = splitPropertyPath(path);
    if (parts.length === 0) {
        return null;
    }
    var prop = layer;
    for (var i = 0; i < parts.length; i += 1) {
        var segment = parts[i];
        var next = null;
        try {
            next = prop.property(segment);
        } catch (eByName) {
            next = null;
        }
        if (!next) {
            var asNumber = parseInt(segment, 10);
            if (!isNaN(asNumber)) {
                try {
                    next = prop.property(asNumber);
                } catch (eByIndex) {
                    next = null;
                }
            }
        }
        prop = next;
        if (!prop) {
            return null;
        }
    }
    return prop;
}

function findCompByIdOrName(compId, compName) {
    if (!app.project) {
        return null;
    }
    var targetId = null;
    if (compId !== null && compId !== undefined) {
        targetId = parseInt(compId, 10);
        if (isNaN(targetId)) {
            targetId = null;
        }
    }

    for (var i = 1; i <= app.project.numItems; i++) {
        var item = app.project.item(i);
        if (!item || !(item instanceof CompItem)) {
            continue;
        }
        if (targetId !== null && item.id === targetId) {
            return item;
        }
        if (compName && item.name === compName) {
            return item;
        }
    }
    return null;
}

function setExpression(layerId, layerName, propertyPath, expression) {
    try {
        ensureJSON();
        var comp = app.project.activeItem;
        var resolvedLayer = aeResolveLayer(comp, layerId, layerName);
        if (resolvedLayer.error) {
            return "Error: " + resolvedLayer.error;
        }
        var layer = resolvedLayer.layer;

        var prop = resolveProperty(layer, propertyPath);
        if (!prop) {
            return "Error: Property with path '" + propertyPath + "' not found.";
        }

        if (prop.canSetExpression) {
            prop.expression = expression;
            return "success";
        } else {
            return "Error: Cannot set expression on property '" + prop.name + "'.";
        }
    } catch (e) {
        return "Error: " + e.toString();
    }
}

function addEffect(layerId, layerName, effectMatchName, effectName) {
    try {
        ensureJSON();
        var comp = app.project.activeItem;
        var resolvedLayer = aeResolveLayer(comp, layerId, layerName);
        if (resolvedLayer.error) {
            return encodePayload({ status: "error", message: resolvedLayer.error });
        }
        var layer = resolvedLayer.layer;

        if (!effectMatchName || effectMatchName.length === 0) {
            return encodePayload({ status: "error", message: "effectMatchName is required." });
        }

        var effectGroup = layer.property("ADBE Effect Parade");
        if (!effectGroup) {
            return encodePayload({ status: "error", message: "Effects group not found on layer." });
        }

        var effect = effectGroup.addProperty(effectMatchName);
        if (!effect) {
            return encodePayload({ status: "error", message: "Failed to add effect: " + effectMatchName });
        }

        if (effectName && effectName.length > 0) {
            effect.name = effectName;
        }

        var payload = {
            status: "success",
            layerId: layer.index,
            layerUid: aeTryGetLayerUid(layer),
            layerName: layer.name,
            effectName: effect.name,
            effectMatchName: effect.matchName
        };
        return encodePayload(payload);
    } catch (e) {
        log("addEffect() threw: " + e.toString());
        return encodePayload({ status: "error", message: e.toString() });
    }
}

function createComp(name, width, height, pixelAspect, duration, frameRate) {
    try {
        ensureJSON();
        if (!name || name.length === 0) {
            return encodePayload({ status: "error", message: "name is required." });
        }
        if (!app.project) {
            app.newProject();
        }

        var compWidth = Math.max(1, Math.round(Number(width)));
        var compHeight = Math.max(1, Math.round(Number(height)));
        var compPixelAspect = Number(pixelAspect);
        var compDuration = Number(duration);
        var compFrameRate = Number(frameRate);

        if (isNaN(compPixelAspect) || compPixelAspect <= 0) compPixelAspect = 1.0;
        if (isNaN(compDuration) || compDuration <= 0) {
            return encodePayload({ status: "error", message: "duration must be a positive number." });
        }
        if (isNaN(compFrameRate) || compFrameRate <= 0) {
            return encodePayload({ status: "error", message: "frameRate must be a positive number." });
        }

        var comp = app.project.items.addComp(
            String(name),
            compWidth,
            compHeight,
            compPixelAspect,
            compDuration,
            compFrameRate
        );
        if (!comp) {
            return encodePayload({ status: "error", message: "Failed to create comp." });
        }
        comp.openInViewer();

        return encodePayload({
            status: "success",
            id: comp.id,
            name: comp.name,
            width: comp.width,
            height: comp.height,
            pixelAspect: comp.pixelAspect,
            duration: comp.duration,
            frameRate: comp.frameRate
        });
    } catch (e) {
        log("createComp() threw: " + e.toString());
        return encodePayload({ status: "error", message: e.toString() });
    }
}

function setActiveComp(compId, compName) {
    try {
        ensureJSON();
        var comp = findCompByIdOrName(compId, compName);
        if (!comp) {
            return encodePayload({ status: "error", message: "Composition not found." });
        }
        comp.openInViewer();
        return encodePayload({
            status: "success",
            id: comp.id,
            name: comp.name
        });
    } catch (e) {
        log("setActiveComp() threw: " + e.toString());
        return encodePayload({ status: "error", message: e.toString() });
    }
}

function setPropertyValue(layerId, layerName, propertyPath, valueJSON) {
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

        if (typeof prop.setValue !== "function") {
            return encodePayload({ status: "error", message: "Property does not support setValue()." });
        }

        var value = JSON.parse(valueJSON);
        prop.setValue(value);

        return encodePayload({
            status: "success",
            layerId: layer.index,
            layerUid: aeTryGetLayerUid(layer),
            layerName: layer.name,
            propertyPath: propertyPath
        });
    } catch (e) {
        log("setPropertyValue() threw: " + e.toString());
        return encodePayload({ status: "error", message: e.toString() });
    }
}

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
        if (expectedDimensions !== gotDimensions) {
            return encodePayload({
                status: "error",
                message: "Value dimension mismatch: expected " + expectedDimensions + "D, got " + gotDimensions + "D.",
                expectedDimensions: expectedDimensions,
                gotDimensions: gotDimensions
            });
        }
        prop.setValueAtTime(timeValue, value);

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
