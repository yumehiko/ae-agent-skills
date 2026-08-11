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

var AE_TEXT_ANIMATOR_PREFIX = "aeSceneTextAnimator:";

function aeValidateTextRangeStyle(style) {
    aeValidateTextStyle(style);
    if (style.leading !== undefined || style.autoLeading !== undefined || style.justification !== undefined) {
        throw new Error("Range styles support character settings only; leading, autoLeading, and justification are not allowed.");
    }
}

function aeValidateTextStyleRanges(ranges) {
    if (!(ranges instanceof Array)) {
        throw new Error("textStyleRanges must be an array.");
    }
    for (var i = 0; i < ranges.length; i++) {
        var range = ranges[i];
        var prefix = "textStyleRanges[" + i + "]";
        if (!range || typeof range !== "object" || range instanceof Array) {
            throw new Error(prefix + " must be an object.");
        }
        var allowed = { start: true, end: true, style: true };
        for (var key in range) {
            if (range.hasOwnProperty(key) && !allowed[key]) {
                throw new Error("Unknown " + prefix + " setting: " + key);
            }
        }
        if (!aeTextIsFiniteNumber(range.start) || Math.floor(range.start) !== range.start || range.start < 0) {
            throw new Error(prefix + ".start must be a non-negative integer.");
        }
        if (!aeTextIsFiniteNumber(range.end) || Math.floor(range.end) !== range.end || range.end <= range.start) {
            throw new Error(prefix + ".end must be an integer greater than start.");
        }
        aeValidateTextRangeStyle(range.style);
    }
}

function aeApplyTextRangeStyleToAccessor(accessor, style) {
    if (style.font !== undefined) {
        if (aeTextInstalledFontExists(style.font) === false) {
            throw new Error("Font '" + style.font + "' is not installed. Use list-fonts first.");
        }
        accessor.font = style.font;
    }
    if (style.fontSize !== undefined) accessor.fontSize = Number(style.fontSize);
    if (style.fillColor !== undefined) accessor.fillColor = aeTextNormalizeColor(style.fillColor, "fillColor");
    if (style.strokeColor !== undefined) accessor.strokeColor = aeTextNormalizeColor(style.strokeColor, "strokeColor");
    if (style.strokeWidth !== undefined) accessor.strokeWidth = Number(style.strokeWidth);
    if (style.strokeOverFill !== undefined) accessor.strokeOverFill = style.strokeOverFill;
    if (style.tracking !== undefined) accessor.tracking = Number(style.tracking);
    if (style.fillEnabled !== undefined) accessor.applyFill = style.fillEnabled;
    if (style.strokeEnabled !== undefined) accessor.applyStroke = style.strokeEnabled;
}

function aeApplyTextStyleRanges(layer, ranges) {
    aeValidateTextStyleRanges(ranges);
    var sourceText = aeGetSourceTextProperty(layer);
    var textDocument = sourceText.value;
    if (typeof textDocument.characterRange !== "function") {
        throw new Error("textStyleRanges require After Effects 24.3 or newer (TextDocument.characterRange)." );
    }
    var textLength = String(textDocument.text).length;
    var summaries = [];
    for (var i = 0; i < ranges.length; i++) {
        var spec = ranges[i];
        if (spec.end > textLength) {
            throw new Error("textStyleRanges[" + i + "].end exceeds the text length (" + textLength + ").");
        }
        var accessor = textDocument.characterRange(spec.start, spec.end);
        aeApplyTextRangeStyleToAccessor(accessor, spec.style);
        summaries.push({ start: spec.start, end: spec.end, style: spec.style });
    }
    sourceText.setValue(textDocument);
    return summaries;
}

function aeValidateTextAnimatorKeyframes(animation, prefix) {
    if (!animation || typeof animation !== "object" || animation instanceof Array) {
        throw new Error(prefix + " must be an object.");
    }
    var allowed = { property: true, keyframes: true };
    for (var key in animation) {
        if (animation.hasOwnProperty(key) && !allowed[key]) throw new Error("Unknown " + prefix + " setting: " + key);
    }
    if (animation.property !== "start" && animation.property !== "end"
        && animation.property !== "offset" && animation.property !== "amount") {
        throw new Error(prefix + ".property must be one of: start, end, offset, amount.");
    }
    if (!(animation.keyframes instanceof Array)) throw new Error(prefix + ".keyframes must be an array.");
    for (var i = 0; i < animation.keyframes.length; i++) {
        var keyframe = animation.keyframes[i];
        if (!keyframe || !aeTextIsFiniteNumber(keyframe.time) || !aeTextIsFiniteNumber(keyframe.value)) {
            throw new Error(prefix + ".keyframes[" + i + "] requires finite numeric time and value.");
        }
        var keyPrefix = prefix + ".keyframes[" + i + "]";
        var keyAllowed = {
            time: true,
            value: true,
            inInterp: true,
            outInterp: true,
            easeIn: true,
            easeOut: true
        };
        for (var keyName in keyframe) {
            if (keyframe.hasOwnProperty(keyName) && !keyAllowed[keyName]) {
                throw new Error("Unknown " + keyPrefix + " setting: " + keyName);
            }
        }
        var interpNames = ["inInterp", "outInterp"];
        for (var p = 0; p < interpNames.length; p++) {
            var interp = keyframe[interpNames[p]];
            if (interp !== undefined && interp !== "linear" && interp !== "bezier" && interp !== "hold") {
                throw new Error(keyPrefix + "." + interpNames[p] + " must be linear, bezier, or hold.");
            }
        }
    }
}

function aeValidateTextAnimators(animators) {
    if (!(animators instanceof Array)) throw new Error("textAnimators must be an array.");
    var ids = {};
    for (var i = 0; i < animators.length; i++) {
        var spec = animators[i];
        var prefix = "textAnimators[" + i + "]";
        if (!spec || typeof spec !== "object" || spec instanceof Array) throw new Error(prefix + " must be an object.");
        var allowed = { id: true, properties: true, selector: true };
        for (var key in spec) {
            if (spec.hasOwnProperty(key) && !allowed[key]) throw new Error("Unknown " + prefix + " setting: " + key);
        }
        if (typeof spec.id !== "string" || spec.id.length === 0) throw new Error(prefix + ".id must be a non-empty string.");
        if (ids[spec.id]) throw new Error(prefix + ".id is duplicated: " + spec.id);
        ids[spec.id] = true;
        var props = spec.properties;
        if (!props || typeof props !== "object" || props instanceof Array) throw new Error(prefix + ".properties must be an object.");
        var propertyCount = 0;
        for (var propName in props) {
            if (!props.hasOwnProperty(propName)) continue;
            propertyCount += 1;
            var value = props[propName];
            if (propName === "position" || propName === "scale") {
                if (!(value instanceof Array) || (value.length !== 2 && value.length !== 3)) {
                    throw new Error(prefix + ".properties." + propName + " must be a 2D or 3D array.");
                }
                for (var d = 0; d < value.length; d++) {
                    if (!aeTextIsFiniteNumber(value[d])) throw new Error(prefix + ".properties." + propName + " must contain finite numbers.");
                }
            } else if (propName === "opacity" || propName === "rotation") {
                if (!aeTextIsFiniteNumber(value)) throw new Error(prefix + ".properties." + propName + " must be a finite number.");
            } else {
                throw new Error("Unknown " + prefix + ".properties setting: " + propName);
            }
        }
        if (propertyCount === 0) throw new Error(prefix + ".properties must contain at least one setting.");
        var selector = spec.selector || {};
        var selectorAllowed = { start: true, end: true, offset: true, amount: true, animations: true };
        for (var selectorKey in selector) {
            if (selector.hasOwnProperty(selectorKey) && !selectorAllowed[selectorKey]) {
                throw new Error("Unknown " + prefix + ".selector setting: " + selectorKey);
            }
        }
        var numericKeys = ["start", "end", "offset", "amount"];
        for (var n = 0; n < numericKeys.length; n++) {
            var numericKey = numericKeys[n];
            if (selector[numericKey] !== undefined && !aeTextIsFiniteNumber(selector[numericKey])) {
                throw new Error(prefix + ".selector." + numericKey + " must be a finite number.");
            }
        }
        var animations = selector.animations || [];
        if (!(animations instanceof Array)) throw new Error(prefix + ".selector.animations must be an array.");
        var animatedProperties = {};
        for (var a = 0; a < animations.length; a++) {
            aeValidateTextAnimatorKeyframes(animations[a], prefix + ".selector.animations[" + a + "]");
            if (animatedProperties[animations[a].property]) {
                throw new Error(prefix + ".selector.animations property is duplicated: " + animations[a].property);
            }
            animatedProperties[animations[a].property] = true;
        }
    }
}

function aeTextChildByMatchName(group, matchName) {
    if (!group) return null;
    for (var i = 1; i <= group.numProperties; i++) {
        var child = group.property(i);
        if (child && child.matchName === matchName) return child;
    }
    return null;
}

function aeTextSetAnimatorProperty(animatorGroup, animatorIndex, matchName, addName, value) {
    var animator = animatorGroup.property(animatorIndex);
    var properties = animator ? animator.property("ADBE Text Animator Properties") : null;
    if (!properties) throw new Error("Text Animator Properties group was not found.");
    // AE exposes supported-but-not-yet-added animator properties as hidden
    // placeholders. Looking up by match name can therefore return a property
    // that rejects setValue(). Always activate the requested property first.
    var added = properties.addProperty(addName || matchName);
    var propertyIndex = added ? added.propertyIndex : 0;
    // Text Animator Properties is an indexed group. After addProperty(), both
    // group and property references may be invalidated, so resolve by index.
    animator = animatorGroup.property(animatorIndex);
    properties = animator ? animator.property("ADBE Text Animator Properties") : null;
    var prop = properties && propertyIndex > 0 ? properties.property(propertyIndex) : null;
    if (prop && prop.matchName !== matchName) prop = aeTextChildByMatchName(properties, matchName);
    if (!prop) throw new Error("Could not add text animator property: " + matchName);
    var expected = getPropertyValueDimensions(prop);
    var normalized = normalizeValueDimensions(value, expected, getValueDimensions(value));
    if (normalized === null) throw new Error("Text animator property dimension mismatch: " + matchName);
    try {
        prop.setValue(normalized);
    } catch (eSetAnimatorProperty) {
        throw new Error("Could not set text animator property after selector " + matchName + ": " + eSetAnimatorProperty.toString());
    }
    return prop;
}

function aeTextDescendantByMatchName(group, matchName) {
    if (!group) return null;
    var direct = aeTextChildByMatchName(group, matchName);
    if (direct) return direct;
    for (var i = 1; i <= group.numProperties; i++) {
        var child = group.property(i);
        if (!child || typeof child.numProperties !== "number" || child.numProperties <= 0) continue;
        var nested = aeTextDescendantByMatchName(child, matchName);
        if (nested) return nested;
    }
    return null;
}

function aeTextSelectorProperty(selector, propertyName) {
    var matchNames = {
        start: "ADBE Text Percent Start",
        end: "ADBE Text Percent End",
        offset: "ADBE Text Percent Offset",
        amount: "ADBE Text Selector Max Amount"
    };
    return aeTextDescendantByMatchName(selector, matchNames[propertyName]);
}

function aeTextApplyKeyframes(prop, animation) {
    var removed = prop.numKeys;
    for (var i = prop.numKeys; i >= 1; i--) prop.removeKey(i);
    for (var j = 0; j < animation.keyframes.length; j++) {
        var keyframe = animation.keyframes[j];
        prop.setValueAtTime(Number(keyframe.time), Number(keyframe.value));
        var keyIndex = prop.nearestKeyIndex(Number(keyframe.time));
        applyKeyframeInterpolation(prop, keyIndex, keyframe.inInterp, keyframe.outInterp);
        applyKeyframeTemporalEase(prop, keyIndex, keyframe.easeIn, keyframe.easeOut);
    }
    return { removed: removed, added: animation.keyframes.length };
}

function aeApplyTextAnimators(layer, animators) {
    aeValidateTextAnimators(animators);
    aeGetSourceTextProperty(layer);
    var textGroup = layer.property("ADBE Text Properties");
    var animatorGroup = textGroup ? textGroup.property("ADBE Text Animators") : null;
    if (!animatorGroup || typeof animatorGroup.addProperty !== "function") {
        throw new Error("Text Animators property group was not found.");
    }
    var removed = 0;
    for (var existingIndex = animatorGroup.numProperties; existingIndex >= 1; existingIndex--) {
        var existing = animatorGroup.property(existingIndex);
        if (existing && String(existing.name).indexOf(AE_TEXT_ANIMATOR_PREFIX) === 0) {
            existing.remove();
            removed += 1;
        }
    }
    var summaries = [];
    var keyframesRemoved = 0;
    var keyframesAdded = 0;
    for (var i = 0; i < animators.length; i++) {
        var spec = animators[i];
        var animator = animatorGroup.addProperty("ADBE Text Animator");
        animator.name = AE_TEXT_ANIMATOR_PREFIX + spec.id;
        var animatorIndex = animator.propertyIndex;
        // addProperty("ADBE Text Animator") creates an empty animator in the
        // scripting API. Add its selector first; animator properties remain
        // hidden and reject setValue() until the animator has a selector.
        var selectors = animator.property("ADBE Text Selectors");
        var selector = aeTextChildByMatchName(selectors, "ADBE Text Selector");
        if (!selector) selector = selectors.addProperty("ADBE Text Selector");
        // Adding to an indexed group may invalidate sibling references. Resolve
        // the animator and selector again before adding animator properties.
        animator = animatorGroup.property(animatorIndex);
        selectors = animator.property("ADBE Text Selectors");
        selector = aeTextChildByMatchName(selectors, "ADBE Text Selector");
        if (spec.properties.position !== undefined) {
            aeTextSetAnimatorProperty(animatorGroup, animatorIndex, "ADBE Text Position 3D", "ADBE Text Position 3D", spec.properties.position);
        }
        if (spec.properties.scale !== undefined) {
            aeTextSetAnimatorProperty(animatorGroup, animatorIndex, "ADBE Text Scale 3D", "ADBE Text Scale 3D", spec.properties.scale);
        }
        if (spec.properties.opacity !== undefined) {
            aeTextSetAnimatorProperty(animatorGroup, animatorIndex, "ADBE Text Opacity", "ADBE Text Opacity", spec.properties.opacity);
        }
        if (spec.properties.rotation !== undefined) {
            aeTextSetAnimatorProperty(animatorGroup, animatorIndex, "ADBE Text Rotation", "ADBE Text Rotation", spec.properties.rotation);
        }
        // Property additions above invalidate animator/selector references too.
        animator = animatorGroup.property(animatorIndex);
        selectors = animator.property("ADBE Text Selectors");
        selector = aeTextChildByMatchName(selectors, "ADBE Text Selector");
        var selectorSpec = spec.selector || {};
        var selectorNames = ["start", "end", "offset", "amount"];
        for (var selectorIndex = 0; selectorIndex < selectorNames.length; selectorIndex++) {
            var selectorName = selectorNames[selectorIndex];
            if (selectorSpec[selectorName] === undefined) continue;
            var selectorProp = aeTextSelectorProperty(selector, selectorName);
            if (!selectorProp) throw new Error("Range Selector property was not found: " + selectorName);
            try {
                selectorProp.setValue(Number(selectorSpec[selectorName]));
            } catch (eSetSelectorProperty) {
                throw new Error("Could not set Range Selector " + selectorName + ": " + eSetSelectorProperty.toString());
            }
        }
        var animations = selectorSpec.animations || [];
        for (var a = 0; a < animations.length; a++) {
            var animatedProp = aeTextSelectorProperty(selector, animations[a].property);
            if (!animatedProp) throw new Error("Animated Range Selector property was not found: " + animations[a].property);
            var keySummary = aeTextApplyKeyframes(animatedProp, animations[a]);
            keyframesRemoved += keySummary.removed;
            keyframesAdded += keySummary.added;
        }
        summaries.push({ id: spec.id, name: animator.name });
    }
    return {
        removedCount: removed,
        animatorCount: summaries.length,
        keyframesRemoved: keyframesRemoved,
        keyframesAdded: keyframesAdded,
        animators: summaries
    };
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

function setTextStyleRanges(layerId, layerName, rangesJSON) {
    try {
        ensureJSON();
        var ranges = JSON.parse(rangesJSON);
        var comp = app.project ? app.project.activeItem : null;
        var resolved = aeResolveLayer(comp, layerId, layerName);
        if (resolved.error) return encodePayload({ status: "error", message: resolved.error });
        return encodePayload({
            status: "success",
            layerId: resolved.layer.index,
            layerUid: aeTryGetLayerUid(resolved.layer),
            layerName: resolved.layer.name,
            textStyleRanges: aeApplyTextStyleRanges(resolved.layer, ranges)
        });
    } catch (e) {
        log("setTextStyleRanges() threw: " + e.toString());
        return encodePayload({ status: "error", message: e.toString() });
    }
}

function setTextAnimators(layerId, layerName, animatorsJSON) {
    try {
        ensureJSON();
        var animators = JSON.parse(animatorsJSON);
        var comp = app.project ? app.project.activeItem : null;
        var resolved = aeResolveLayer(comp, layerId, layerName);
        if (resolved.error) return encodePayload({ status: "error", message: resolved.error });
        var result = aeApplyTextAnimators(resolved.layer, animators);
        result.status = "success";
        result.layerId = resolved.layer.index;
        result.layerUid = aeTryGetLayerUid(resolved.layer);
        result.layerName = resolved.layer.name;
        return encodePayload(result);
    } catch (e) {
        log("setTextAnimators() threw: " + e.toString());
        return encodePayload({ status: "error", message: e.toString() });
    }
}
