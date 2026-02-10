function log(message) {
    try {
        $.writeln("[LLM Video Agent] " + message);
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
