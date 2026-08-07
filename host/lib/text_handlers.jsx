function aeTextIsFiniteNumber(value) {
    return typeof value === "number" && !isNaN(value) && isFinite(value);
}

function aeGetSourceTextProperty(layer) {
    if (!layer || !(layer instanceof TextLayer)) {
        throw new Error("Target layer must be a text layer.");
    }
    var textGroup = layer.property("ADBE Text Properties");
    var sourceText = textGroup ? textGroup.property("ADBE Text Document") : null;
    if (!sourceText) {
        throw new Error("Source Text property was not found on the target layer.");
    }
    return sourceText;
}

function aeTextNormalizeColor(value, label) {
    if (!(value instanceof Array) || value.length !== 3) {
        throw new Error(label + " must be an RGB array with exactly 3 numbers.");
    }
    var normalized = [];
    var usesByteRange = false;
    for (var i = 0; i < 3; i++) {
        if (!aeTextIsFiniteNumber(value[i]) || value[i] < 0 || value[i] > 255) {
            throw new Error(label + " values must be finite numbers between 0 and 255.");
        }
        if (value[i] > 1) {
            usesByteRange = true;
        }
    }
    for (var j = 0; j < 3; j++) {
        normalized.push(usesByteRange ? Number(value[j]) / 255 : Number(value[j]));
    }
    return normalized;
}

function aeTextJustificationValue(name) {
    var map = {
        "left": ParagraphJustification.LEFT_JUSTIFY,
        "center": ParagraphJustification.CENTER_JUSTIFY,
        "right": ParagraphJustification.RIGHT_JUSTIFY,
        "full-left": ParagraphJustification.FULL_JUSTIFY_LASTLINE_LEFT,
        "full-center": ParagraphJustification.FULL_JUSTIFY_LASTLINE_CENTER,
        "full-right": ParagraphJustification.FULL_JUSTIFY_LASTLINE_RIGHT,
        "full": ParagraphJustification.FULL_JUSTIFY_LASTLINE_FULL
    };
    return map[name];
}

function aeTextJustificationName(value) {
    var names = ["left", "center", "right", "full-left", "full-center", "full-right", "full"];
    for (var i = 0; i < names.length; i++) {
        var name = names[i];
        try {
            if (value === aeTextJustificationValue(name)) {
                return name;
            }
        } catch (e) {}
    }
    return "unknown";
}

function aeValidateTextStyle(style) {
    if (!style || typeof style !== "object" || style instanceof Array) {
        throw new Error("textStyle must be an object.");
    }
    var allowed = {
        font: true,
        fontSize: true,
        fillEnabled: true,
        fillColor: true,
        strokeEnabled: true,
        strokeColor: true,
        strokeWidth: true,
        strokeOverFill: true,
        tracking: true,
        leading: true,
        autoLeading: true,
        justification: true
    };
    var hasSetting = false;
    for (var key in style) {
        if (!style.hasOwnProperty(key)) {
            continue;
        }
        if (!allowed[key]) {
            throw new Error("Unknown textStyle setting: " + key);
        }
        hasSetting = true;
    }
    if (!hasSetting) {
        throw new Error("textStyle must contain at least one setting.");
    }
    if (style.font !== undefined && (typeof style.font !== "string" || style.font.length === 0)) {
        throw new Error("font must be a non-empty PostScript font name when specified.");
    }
    if (style.fontSize !== undefined
        && (!aeTextIsFiniteNumber(style.fontSize) || style.fontSize < 0.1 || style.fontSize > 1296)) {
        throw new Error("fontSize must be between 0.1 and 1296 when specified.");
    }
    if (style.fillEnabled !== undefined && typeof style.fillEnabled !== "boolean") {
        throw new Error("fillEnabled must be a boolean when specified.");
    }
    if (style.fillColor !== undefined) {
        aeTextNormalizeColor(style.fillColor, "fillColor");
    }
    if (style.strokeEnabled !== undefined && typeof style.strokeEnabled !== "boolean") {
        throw new Error("strokeEnabled must be a boolean when specified.");
    }
    if (style.strokeColor !== undefined) {
        aeTextNormalizeColor(style.strokeColor, "strokeColor");
    }
    if (style.strokeWidth !== undefined
        && (!aeTextIsFiniteNumber(style.strokeWidth) || style.strokeWidth < 0 || style.strokeWidth > 1000)) {
        throw new Error("strokeWidth must be between 0 and 1000 when specified.");
    }
    if (style.strokeOverFill !== undefined && typeof style.strokeOverFill !== "boolean") {
        throw new Error("strokeOverFill must be a boolean when specified.");
    }
    if (style.tracking !== undefined && !aeTextIsFiniteNumber(style.tracking)) {
        throw new Error("tracking must be a finite number when specified.");
    }
    if (style.leading !== undefined
        && (!aeTextIsFiniteNumber(style.leading) || style.leading < 0.1 || style.leading > 1296)) {
        throw new Error("leading must be between 0.1 and 1296 when specified.");
    }
    if (style.autoLeading !== undefined && typeof style.autoLeading !== "boolean") {
        throw new Error("autoLeading must be a boolean when specified.");
    }
    if (style.leading !== undefined && style.autoLeading === true) {
        throw new Error("leading cannot be combined with autoLeading: true.");
    }
    if (style.justification !== undefined) {
        if (typeof style.justification !== "string"
            || aeTextJustificationValue(style.justification) === undefined) {
            throw new Error(
                "justification must be one of: left, center, right, full-left, "
                + "full-center, full-right, full."
            );
        }
    }
}

function aeTextStyleSummaryFromDocument(textDocument) {
    var fillEnabled = textDocument.applyFill === true;
    var strokeEnabled = textDocument.applyStroke === true;
    return {
        font: String(textDocument.font),
        fontFamily: String(textDocument.fontFamily),
        fontStyle: String(textDocument.fontStyle),
        fontSize: Number(textDocument.fontSize),
        fillEnabled: fillEnabled,
        fillColor: fillEnabled ? textDocument.fillColor : null,
        strokeEnabled: strokeEnabled,
        strokeColor: strokeEnabled ? textDocument.strokeColor : null,
        strokeWidth: Number(textDocument.strokeWidth),
        strokeOverFill: textDocument.strokeOverFill === true,
        tracking: Number(textDocument.tracking),
        leading: Number(textDocument.leading),
        autoLeading: textDocument.autoLeading === true,
        justification: aeTextJustificationName(textDocument.justification)
    };
}

function aeTextStyleSummary(layer) {
    var sourceText = aeGetSourceTextProperty(layer);
    return aeTextStyleSummaryFromDocument(sourceText.value);
}

function aeTextInstalledFontExists(postScriptName) {
    if (!app.fonts || !app.fonts.allFonts) {
        return null;
    }
    var families = app.fonts.allFonts;
    for (var i = 0; i < families.length; i++) {
        var family = families[i];
        for (var j = 0; j < family.length; j++) {
            if (String(family[j].postScriptName) === postScriptName) {
                return true;
            }
        }
    }
    return false;
}

function aeApplyTextStyle(layer, style) {
    aeValidateTextStyle(style);
    var sourceText = aeGetSourceTextProperty(layer);
    var textDocument = sourceText.value;

    if (style.font !== undefined) {
        if (aeTextInstalledFontExists(style.font) === false) {
            throw new Error(
                "Font '" + style.font
                + "' is not installed. Use list-fonts to get a PostScript font name."
            );
        }
        textDocument.font = style.font;
        if (String(textDocument.font) !== style.font) {
            throw new Error(
                "Font '" + style.font
                + "' is not available. Use list-fonts to get a PostScript font name."
            );
        }
    }
    if (style.fontSize !== undefined) textDocument.fontSize = Number(style.fontSize);
    if (style.fillColor !== undefined) {
        textDocument.fillColor = aeTextNormalizeColor(style.fillColor, "fillColor");
        if (style.fillEnabled === undefined) textDocument.applyFill = true;
    }
    if (style.strokeColor !== undefined) {
        textDocument.strokeColor = aeTextNormalizeColor(style.strokeColor, "strokeColor");
        if (style.strokeEnabled === undefined) textDocument.applyStroke = true;
    }
    if (style.strokeWidth !== undefined) textDocument.strokeWidth = Number(style.strokeWidth);
    if (style.strokeOverFill !== undefined) textDocument.strokeOverFill = style.strokeOverFill;
    if (style.tracking !== undefined) textDocument.tracking = Number(style.tracking);
    if (style.leading !== undefined) {
        textDocument.leading = Number(style.leading);
        textDocument.autoLeading = false;
    }
    if (style.autoLeading !== undefined) textDocument.autoLeading = style.autoLeading;
    if (style.justification !== undefined) {
        textDocument.justification = aeTextJustificationValue(style.justification);
    }
    if (style.fillEnabled !== undefined) textDocument.applyFill = style.fillEnabled;
    if (style.strokeEnabled !== undefined) textDocument.applyStroke = style.strokeEnabled;

    sourceText.setValue(textDocument);
    var applied = sourceText.value;
    return aeTextStyleSummaryFromDocument(applied);
}

function aeListInstalledFonts(query, limit) {
    if (!app.fonts || !app.fonts.allFonts) {
        throw new Error("Font listing requires After Effects 24.0 or newer.");
    }
    var normalizedQuery = query ? String(query).toLowerCase() : "";
    var maxResults = limit === null || limit === undefined ? 200 : Number(limit);
    if (!aeTextIsFiniteNumber(maxResults) || maxResults <= 0 || Math.floor(maxResults) !== maxResults) {
        throw new Error("limit must be a positive integer.");
    }
    var families = app.fonts.allFonts;
    var fonts = [];
    for (var i = 0; i < families.length && fonts.length < maxResults; i++) {
        var family = families[i];
        for (var j = 0; j < family.length && fonts.length < maxResults; j++) {
            var font = family[j];
            var summary = {
                postScriptName: String(font.postScriptName),
                familyName: String(font.familyName),
                styleName: String(font.styleName)
            };
            var searchable = (
                summary.postScriptName + " " + summary.familyName + " " + summary.styleName
            ).toLowerCase();
            if (!normalizedQuery || searchable.indexOf(normalizedQuery) !== -1) {
                fonts.push(summary);
            }
        }
    }
    return fonts;
}

function listFonts(query, limit) {
    try {
        ensureJSON();
        return encodePayload({
            status: "success",
            query: query || "",
            fonts: aeListInstalledFonts(query, limit)
        });
    } catch (e) {
        log("listFonts() threw: " + e.toString());
        return encodePayload({ status: "error", message: e.toString() });
    }
}

function getTextStyle(layerId, layerName) {
    try {
        ensureJSON();
        var comp = app.project ? app.project.activeItem : null;
        var resolved = aeResolveLayer(comp, layerId, layerName);
        if (resolved.error) {
            return encodePayload({ status: "error", message: resolved.error });
        }
        return encodePayload({
            status: "success",
            layerId: resolved.layer.index,
            layerUid: aeTryGetLayerUid(resolved.layer),
            layerName: resolved.layer.name,
            textStyle: aeTextStyleSummary(resolved.layer)
        });
    } catch (e) {
        log("getTextStyle() threw: " + e.toString());
        return encodePayload({ status: "error", message: e.toString() });
    }
}

function setTextStyle(layerId, layerName, styleJSON) {
    try {
        ensureJSON();
        var style = JSON.parse(styleJSON);
        var comp = app.project ? app.project.activeItem : null;
        var resolved = aeResolveLayer(comp, layerId, layerName);
        if (resolved.error) {
            return encodePayload({ status: "error", message: resolved.error });
        }
        var summary = aeApplyTextStyle(resolved.layer, style);
        return encodePayload({
            status: "success",
            layerId: resolved.layer.index,
            layerUid: aeTryGetLayerUid(resolved.layer),
            layerName: resolved.layer.name,
            operations: 1,
            textStyle: summary
        });
    } catch (e) {
        log("setTextStyle() threw: " + e.toString());
        return encodePayload({ status: "error", message: e.toString() });
    }
}
