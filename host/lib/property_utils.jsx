var AE_PROPERTY_TYPE_PROPERTY = 6212;
var AE_PROPERTY_TYPE_GROUP = 6213;

function aePropertyValueToString(prop) {
    try {
        var value = prop.value;
        if (value === null || value === undefined) {
            return "";
        }
        if (value instanceof Array) {
            return value.join(", ");
        }
        if (typeof value === "boolean") {
            return value ? "true" : "false";
        }
        return value.toString();
    } catch (e) {
        return "";
    }
}

function aeCanTraverseProperty(prop) {
    if (!prop) {
        return false;
    }
    try {
        if (prop.propertyType === AE_PROPERTY_TYPE_GROUP) {
            return true;
        }
    } catch (e) {}
    return typeof prop.numProperties === "number" && prop.numProperties > 0;
}

function aeIsPropertyNode(prop) {
    if (!prop) {
        return false;
    }
    try {
        if (prop.propertyType === AE_PROPERTY_TYPE_PROPERTY) {
            return true;
        }
    } catch (e) {}
    return !aeCanTraverseProperty(prop);
}

function aeIsEnabledProperty(prop) {
    if (!prop) {
        return false;
    }
    try {
        if (typeof prop.enabled === "boolean") {
            return prop.enabled;
        }
    } catch (e) {}
    return true;
}

function aeCanExposeProperty(prop) {
    if (!aeIsEnabledProperty(prop)) {
        return false;
    }
    var canSetValue = null;
    try {
        if (typeof prop.canSetValue === "boolean") {
            canSetValue = prop.canSetValue;
            if (canSetValue) {
                return true;
            }
        }
    } catch (eValue) {}
    var canSetExpression = null;
    try {
        if (typeof prop.canSetExpression === "boolean") {
            canSetExpression = prop.canSetExpression;
        }
        if (canSetExpression) {
            return true;
        }
    } catch (eExpression) {}
    if (canSetValue === false || canSetExpression === false) {
        return false;
    }
    return true;
}

function aeArrayContains(arr, value) {
    if (!arr || !value) {
        return false;
    }
    for (var i = 0; i < arr.length; i++) {
        if (arr[i] === value) {
            return true;
        }
    }
    return false;
}

function aeGetPropertyIdentifier(prop, fallbackIndex) {
    try {
        if (prop.matchName && prop.matchName.length > 0) {
            return prop.matchName;
        }
    } catch (e) {}
    try {
        if (prop.name && prop.name.length > 0) {
            return prop.name;
        }
    } catch (e2) {}
    if (typeof fallbackIndex === "number") {
        return "Property_" + fallbackIndex;
    }
    return "Property";
}
