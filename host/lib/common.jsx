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
        } else if (layer.source && layer.source.mainSource instanceof SolidSource) {
            return "Solid";
        } else if (layer.hasVideo && !layer.hasAudio) {
            return "Video";
        } else if (!layer.hasVideo && layer.hasAudio) {
            return "Audio";
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

function aeGetProjectState() {
    var state = {
        path: null,
        name: null,
        dirty: null,
        saved: false
    };
    if (!app.project) {
        return state;
    }

    try {
        if (typeof app.project.dirty === "boolean") {
            state.dirty = app.project.dirty;
        }
    } catch (eDirty) {}

    try {
        if (app.project.file) {
            state.path = app.project.file.fsName;
            state.name = app.project.file.name;
            state.saved = true;
        } else if (app.project.name) {
            state.name = String(app.project.name);
        }
    } catch (eFile) {
        try {
            state.name = app.project.name ? String(app.project.name) : null;
        } catch (eName) {}
    }
    return state;
}

function getProjectState() {
    try {
        ensureJSON();
        return encodePayload(aeGetProjectState());
    } catch (e) {
        log("getProjectState() threw: " + e.toString());
        return encodePayload({ status: "error", message: e.toString() });
    }
}

function aeNormalizeProjectPath(pathValue) {
    if (pathValue === null || pathValue === undefined || String(pathValue).length === 0) {
        return null;
    }
    var normalized = File(String(pathValue)).fsName;
    try {
        if (Folder.fs === "Windows") {
            normalized = normalized.toLowerCase();
        }
    } catch (eFs) {}
    return normalized;
}

function aeProjectPathMatches(expectedPath, projectState) {
    var expected = aeNormalizeProjectPath(expectedPath);
    var actual = projectState && projectState.path
        ? aeNormalizeProjectPath(projectState.path)
        : null;
    return expected !== null && actual !== null && expected === actual;
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
            error: "Layer name '" + targetName + "' is ambiguous (" + matchCount
                + " matches). Use --layer-id (layerId in the bridge API)."
        };
    }
    return { layer: matched, error: null };
}
