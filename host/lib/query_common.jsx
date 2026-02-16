function aeBuildPropertyPath(prop) {
    function getPathIdentifier(target) {
        return aeGetPropertyIdentifier(target, null);
    }
    var segments = [];
    var current = prop;
    var guard = 0;
    while (current && guard < 100) {
        var parent = null;
        try {
            parent = current.parentProperty;
        } catch (eParent) {
            parent = null;
        }
        if (!parent) {
            break;
        }
        segments.unshift(getPathIdentifier(current));
        current = parent;
        guard += 1;
    }
    if (segments.length === 0) {
        return "";
    }
    return segments.join(".");
}

function aeInterpolationTypeToName(interpType) {
    if (interpType === KeyframeInterpolationType.LINEAR) {
        return "linear";
    }
    if (interpType === KeyframeInterpolationType.BEZIER) {
        return "bezier";
    }
    if (interpType === KeyframeInterpolationType.HOLD) {
        return "hold";
    }
    return null;
}

function aeSerializeTemporalEaseList(eases) {
    if (!(eases instanceof Array)) {
        return null;
    }
    var pairs = [];
    for (var i = 0; i < eases.length; i++) {
        var ease = eases[i];
        if (!ease) {
            continue;
        }
        var speed = null;
        var influence = null;
        try {
            speed = ease.speed;
            influence = ease.influence;
        } catch (eEaseRead) {
            speed = null;
            influence = null;
        }
        if (speed === null || influence === null) {
            continue;
        }
        pairs.push([speed, influence]);
    }
    return pairs.length > 0 ? pairs : null;
}

function aeSerializeKeyValue(value) {
    if (value === null || value === undefined) {
        return null;
    }
    if (value instanceof Array) {
        return value;
    }
    var t = typeof value;
    if (t === "number" || t === "boolean" || t === "string") {
        return value;
    }
    return String(value);
}
