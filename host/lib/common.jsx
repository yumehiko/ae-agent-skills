function log(message) {
    try {
        $.writeln("[ae-agent-skill] " + message);
    } catch (err) {}
}

function encodePayload(data) {
    try {
        var encoded = "__ENC__" + encodeURIComponent(JSON.stringify(data));
        return encoded;
    } catch (e) {
        log("encodePayload() failed: " + e.toString());
        return JSON.stringify({ status: "Error", message: "encodePayload failed: " + e.toString() });
    }
}

function getLayerTypeName(layer) {
    if (layer instanceof TextLayer) {
        return "Text";
    } else if (layer instanceof ShapeLayer) {
        return "Shape";
    } else if (layer instanceof AVLayer) {
        if (layer.source instanceof CompItem) {
            return "PreComp";
        } else if (layer.hasVideo && !layer.hasAudio) {
            return "Video";
        } else if (!layer.hasVideo && layer.hasAudio) {
            return "Audio";
        } else if (layer.source && layer.source.mainSource instanceof SolidSource) {
            return "Solid";
        } else {
            return "AVLayer";
        }
    } else if (layer instanceof CameraLayer) {
        return "Camera";
    } else if (layer instanceof LightLayer) {
        return "Light";
    }
    return "Unknown";
}

function ensureJSON() {
    if (typeof JSON === "undefined" || typeof JSON.stringify !== "function") {
        try {
            $.evalFile(File(Folder(app.path).fsName + "/Scripts/json2.js"));
            return;
        } catch (e) {
            // Fall through to local copy.
        }
        var hostRoot = __AE_AGENT_HOST_ROOT;
        if (!hostRoot || hostRoot.length === 0) {
            hostRoot = File($.fileName).parent.fsName;
        }
        var localJson = File(hostRoot + "/json2.js");
        if (!localJson.exists) {
            throw new Error("json2.js not found at " + localJson.fsName);
        }
        $.evalFile(localJson);
    }
}

function aeNormalizeLayerId(layerId) {
    if (layerId === null || layerId === undefined || layerId === "") {
        return null;
    }
    var parsed = parseInt(layerId, 10);
    if (isNaN(parsed) || parsed <= 0) {
        return null;
    }
    return parsed;
}

function aeTryGetLayerUid(layer) {
    if (!layer) {
        return null;
    }
    try {
        if (layer.id !== null && layer.id !== undefined) {
            return String(layer.id);
        }
    } catch (e) {}
    return null;
}

function aeResolveLayer(comp, layerId, layerName) {
    if (!comp || !(comp instanceof CompItem)) {
        return { layer: null, error: "Active composition not found." };
    }

    var normalizedId = aeNormalizeLayerId(layerId);
    var hasLayerId = normalizedId !== null;
    var hasLayerName = layerName !== null && layerName !== undefined && String(layerName).length > 0;
    if ((hasLayerId && hasLayerName) || (!hasLayerId && !hasLayerName)) {
        return { layer: null, error: "Provide exactly one of layerId or layerName." };
    }

    if (hasLayerId) {
        var layerById = comp.layer(normalizedId);
        if (!layerById) {
            return { layer: null, error: "Layer with id " + normalizedId + " not found." };
        }
        return { layer: layerById, error: null };
    }

    var targetName = String(layerName);
    var matched = null;
    var matchCount = 0;
    for (var i = 1; i <= comp.numLayers; i++) {
        var candidate = comp.layer(i);
        if (!candidate) {
            continue;
        }
        if (candidate.name === targetName) {
            matched = candidate;
            matchCount += 1;
        }
    }
    if (matchCount === 0 || !matched) {
        return { layer: null, error: "Layer with name '" + targetName + "' not found." };
    }
    if (matchCount > 1) {
        return {
            layer: null,
            error: "Layer name '" + targetName + "' is ambiguous (" + matchCount + " matches). Use layerId."
        };
    }
    return { layer: matched, error: null };
}
