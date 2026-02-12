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

function addEssentialProperty(layerId, layerName, propertyPath, essentialName) {
    try {
        ensureJSON();
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return encodePayload({ status: "error", message: "Active composition not found." });
        }

        var resolvedLayer = aeResolveLayer(comp, layerId, layerName);
        if (resolvedLayer.error) {
            return encodePayload({ status: "error", message: resolvedLayer.error });
        }
        var layer = resolvedLayer.layer;

        var prop = resolveProperty(layer, propertyPath);
        if (!prop) {
            return encodePayload({ status: "error", message: "Property with path '" + propertyPath + "' not found." });
        }

        if (typeof prop.addToMotionGraphicsTemplate !== "function"
            && typeof prop.addToMotionGraphicsTemplateAs !== "function") {
            return encodePayload({
                status: "error",
                message: "Property cannot be added to Essential Graphics in this AE version."
            });
        }

        if (typeof prop.canAddToMotionGraphicsTemplate === "function") {
            if (!prop.canAddToMotionGraphicsTemplate(comp)) {
                return encodePayload({
                    status: "error",
                    message: "Property cannot be added to Essential Graphics."
                });
            }
        }

        var requestedName = null;
        if (essentialName !== null && essentialName !== undefined) {
            requestedName = String(essentialName).replace(/^\s+|\s+$/g, "");
            if (requestedName.length === 0) {
                requestedName = null;
            }
        }

        var added = false;
        var finalName = null;
        if (requestedName !== null && typeof prop.addToMotionGraphicsTemplateAs === "function") {
            added = prop.addToMotionGraphicsTemplateAs(comp, requestedName);
            finalName = requestedName;
        } else if (typeof prop.addToMotionGraphicsTemplate === "function") {
            added = prop.addToMotionGraphicsTemplate(comp);
        } else if (typeof prop.addToMotionGraphicsTemplateAs === "function") {
            added = prop.addToMotionGraphicsTemplateAs(comp, prop.name);
            finalName = prop.name;
        }

        if (!added) {
            return encodePayload({ status: "error", message: "Failed to add property to Essential Graphics." });
        }

        var controllerCount = null;
        try {
            if (typeof comp.motionGraphicsTemplateControllerCount === "number") {
                controllerCount = comp.motionGraphicsTemplateControllerCount;
                if (finalName === null && controllerCount > 0
                    && typeof comp.getMotionGraphicsTemplateControllerName === "function") {
                    finalName = comp.getMotionGraphicsTemplateControllerName(controllerCount);
                }
            }
        } catch (eCount) {}

        return encodePayload({
            status: "success",
            compId: comp.id,
            compName: comp.name,
            layerId: layer.index,
            layerUid: aeTryGetLayerUid(layer),
            layerName: layer.name,
            propertyPath: propertyPath,
            essentialName: finalName,
            controllerCount: controllerCount
        });
    } catch (e) {
        log("addEssentialProperty() threw: " + e.toString());
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
        if (value instanceof Array) {
            try {
                var currentValue = prop.value;
                if (
                    currentValue instanceof Array
                    && currentValue.length === 3
                    && value.length === 2
                ) {
                    // Allow natural 2D input for 3D vector properties by filling Z with 0.
                    value = [value[0], value[1], 0];
                }
            } catch (eDim) {}
        }
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
