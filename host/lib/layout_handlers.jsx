function aeLayoutIsFiniteNumber(value) {
    return typeof value === "number" && !isNaN(value) && isFinite(value);
}

function aeLayoutValidateReference(reference) {
    return reference === "comp"
        || reference === "action-safe"
        || reference === "title-safe"
        || reference === "selection";
}

function aeLayoutValidateCommonOptions(comp, options) {
    if (!options || typeof options !== "object" || options instanceof Array) {
        throw new Error("layout options must be an object.");
    }
    var reference = options.reference === undefined ? "comp" : String(options.reference);
    if (!aeLayoutValidateReference(reference)) {
        throw new Error("reference must be one of: comp, action-safe, title-safe, selection.");
    }
    if (options.time !== undefined
        && (!aeLayoutIsFiniteNumber(options.time) || options.time < 0 || options.time > comp.duration)) {
        throw new Error("time must be between 0 and the composition duration.");
    }
    if (options.marginPercent !== undefined
        && (!aeLayoutIsFiniteNumber(options.marginPercent)
            || options.marginPercent < 0
            || options.marginPercent >= 50)) {
        throw new Error("marginPercent must be between 0 and 50 (exclusive).");
    }
    if (reference === "selection" && options.marginPercent !== undefined) {
        throw new Error("marginPercent is not allowed when reference is selection.");
    }
    return {
        reference: reference,
        time: options.time === undefined ? Number(comp.time) : Number(options.time),
        marginPercent: options.marginPercent === undefined ? null : Number(options.marginPercent)
    };
}

function aeLayoutValidateAlignOptions(comp, options) {
    var common = aeLayoutValidateCommonOptions(comp, options);
    var allowed = {
        reference: true,
        horizontal: true,
        vertical: true,
        offset: true,
        time: true,
        marginPercent: true
    };
    for (var key in options) {
        if (options.hasOwnProperty(key) && !allowed[key]) {
            throw new Error("Unknown align option: " + key);
        }
    }
    var horizontal = options.horizontal;
    var vertical = options.vertical;
    if (horizontal === undefined && vertical === undefined) {
        throw new Error("Provide horizontal, vertical, or both.");
    }
    if (horizontal !== undefined
        && horizontal !== "left"
        && horizontal !== "center"
        && horizontal !== "right") {
        throw new Error("horizontal must be one of: left, center, right.");
    }
    if (vertical !== undefined
        && vertical !== "top"
        && vertical !== "center"
        && vertical !== "bottom") {
        throw new Error("vertical must be one of: top, center, bottom.");
    }
    var offset = options.offset === undefined ? [0, 0] : options.offset;
    if (!(offset instanceof Array)
        || offset.length !== 2
        || !aeLayoutIsFiniteNumber(offset[0])
        || !aeLayoutIsFiniteNumber(offset[1])) {
        throw new Error("offset must be a finite [x, y] array.");
    }
    common.horizontal = horizontal;
    common.vertical = vertical;
    common.offset = [Number(offset[0]), Number(offset[1])];
    return common;
}

function aeLayoutValidateDistributeOptions(comp, options) {
    var common = aeLayoutValidateCommonOptions(comp, options);
    var allowed = {
        reference: true,
        axis: true,
        mode: true,
        time: true,
        marginPercent: true
    };
    for (var key in options) {
        if (options.hasOwnProperty(key) && !allowed[key]) {
            throw new Error("Unknown distribute option: " + key);
        }
    }
    if (options.axis !== "horizontal" && options.axis !== "vertical") {
        throw new Error("axis must be horizontal or vertical.");
    }
    var mode = options.mode === undefined ? "gaps" : String(options.mode);
    if (mode !== "gaps" && mode !== "centers") {
        throw new Error("mode must be gaps or centers.");
    }
    common.axis = options.axis;
    common.mode = mode;
    return common;
}

function aeLayoutResolveLayers(comp, selectors, minimumCount) {
    if (!selectors || typeof selectors !== "object" || selectors instanceof Array) {
        throw new Error("layer selectors must be an object.");
    }
    var hasIds = selectors.layerIds instanceof Array;
    var hasNames = selectors.layerNames instanceof Array;
    if (hasIds === hasNames) {
        throw new Error("Provide exactly one of layerIds or layerNames.");
    }
    var values = hasIds ? selectors.layerIds : selectors.layerNames;
    if (values.length < minimumCount) {
        throw new Error("At least " + minimumCount + " layer selector(s) are required.");
    }
    var layers = [];
    var seen = {};
    for (var i = 0; i < values.length; i++) {
        var resolved = hasIds
            ? aeResolveLayer(comp, values[i], null)
            : aeResolveLayer(comp, null, values[i]);
        if (resolved.error) {
            throw new Error(resolved.error);
        }
        var uid = aeTryGetLayerUid(resolved.layer);
        var identity = uid !== null ? "uid:" + uid : "index:" + resolved.layer.index;
        if (seen[identity]) {
            throw new Error("Layer selectors must not contain duplicates.");
        }
        seen[identity] = true;
        layers.push(resolved.layer);
    }
    return layers;
}

function aeLayoutEnsureLayerSupported(layer) {
    if (!layer
        || (!(layer instanceof TextLayer)
            && !(layer instanceof ShapeLayer)
            && !(layer instanceof AVLayer))) {
        throw new Error("Layout supports AV layers only.");
    }
    if (layer.hasVideo !== true) {
        throw new Error("Layer '" + layer.name + "' does not contain visible video content.");
    }
    var current = layer;
    while (current) {
        if (current.threeDLayer === true) {
            throw new Error("3D layers and 3D parent chains are not supported by layout.");
        }
        current = current.parent;
    }
    if (typeof layer.sourceRectAtTime !== "function"
        || typeof layer.sourcePointToComp !== "function") {
        throw new Error("Layer '" + layer.name + "' does not expose layout bounds conversion.");
    }
}

function aeLayoutLayerBounds(layer, time) {
    aeLayoutEnsureLayerSupported(layer);
    var rect = layer.sourceRectAtTime(time, true);
    if (!rect || !aeLayoutIsFiniteNumber(Number(rect.width)) || !aeLayoutIsFiniteNumber(Number(rect.height))) {
        throw new Error("Could not read bounds for layer '" + layer.name + "'.");
    }
    var left = Number(rect.left);
    var top = Number(rect.top);
    var right = left + Number(rect.width);
    var bottom = top + Number(rect.height);
    var points = [
        layer.sourcePointToComp([left, top]),
        layer.sourcePointToComp([right, top]),
        layer.sourcePointToComp([right, bottom]),
        layer.sourcePointToComp([left, bottom])
    ];
    var minX = Number(points[0][0]);
    var maxX = minX;
    var minY = Number(points[0][1]);
    var maxY = minY;
    for (var i = 1; i < points.length; i++) {
        minX = Math.min(minX, Number(points[i][0]));
        maxX = Math.max(maxX, Number(points[i][0]));
        minY = Math.min(minY, Number(points[i][1]));
        maxY = Math.max(maxY, Number(points[i][1]));
    }
    return {
        left: minX,
        top: minY,
        right: maxX,
        bottom: maxY,
        width: maxX - minX,
        height: maxY - minY,
        centerX: (minX + maxX) / 2,
        centerY: (minY + maxY) / 2
    };
}

function aeLayoutUnionBounds(items) {
    if (!items || items.length === 0) {
        throw new Error("Cannot calculate an empty layout reference.");
    }
    var left = items[0].bounds.left;
    var top = items[0].bounds.top;
    var right = items[0].bounds.right;
    var bottom = items[0].bounds.bottom;
    for (var i = 1; i < items.length; i++) {
        left = Math.min(left, items[i].bounds.left);
        top = Math.min(top, items[i].bounds.top);
        right = Math.max(right, items[i].bounds.right);
        bottom = Math.max(bottom, items[i].bounds.bottom);
    }
    return {
        left: left,
        top: top,
        right: right,
        bottom: bottom,
        width: right - left,
        height: bottom - top,
        centerX: (left + right) / 2,
        centerY: (top + bottom) / 2
    };
}

function aeLayoutReferenceBounds(comp, reference, marginPercent, items) {
    if (reference === "selection") {
        return aeLayoutUnionBounds(items);
    }
    var margin = marginPercent;
    if (margin === null || margin === undefined) {
        if (reference === "action-safe") margin = 10;
        else if (reference === "title-safe") margin = 20;
        else margin = 0;
    }
    var insetX = Number(comp.width) * Number(margin) / 100;
    var insetY = Number(comp.height) * Number(margin) / 100;
    return {
        left: insetX,
        top: insetY,
        right: Number(comp.width) - insetX,
        bottom: Number(comp.height) - insetY,
        width: Number(comp.width) - (insetX * 2),
        height: Number(comp.height) - (insetY * 2),
        centerX: Number(comp.width) / 2,
        centerY: Number(comp.height) / 2
    };
}

function aeLayoutGetTransformProperty(layer, matchName) {
    var transform = layer.property("ADBE Transform Group");
    return transform ? transform.property(matchName) : null;
}

function aeLayoutReadPosition(layer, time) {
    var position = aeLayoutGetTransformProperty(layer, "ADBE Position");
    if (!position) {
        throw new Error("Position property was not found for layer '" + layer.name + "'.");
    }
    if (position.dimensionsSeparated === true) {
        var x = aeLayoutGetTransformProperty(layer, "ADBE Position_0");
        var y = aeLayoutGetTransformProperty(layer, "ADBE Position_1");
        if (!x || !y) {
            throw new Error("Separated Position properties were not found.");
        }
        return [Number(x.valueAtTime(time, false)), Number(y.valueAtTime(time, false))];
    }
    var value = position.valueAtTime(time, false);
    return [Number(value[0]), Number(value[1])];
}

function aeLayoutSetPropertyValueAtTime(property, time, value) {
    if (property.expressionEnabled === true) {
        throw new Error("Layout cannot modify a Position property with an enabled expression.");
    }
    if (property.numKeys > 0) {
        property.setValueAtTime(time, value);
    } else {
        property.setValue(value);
    }
}

function aeLayoutSetPosition(layer, time, value) {
    var position = aeLayoutGetTransformProperty(layer, "ADBE Position");
    if (!position) {
        throw new Error("Position property was not found for layer '" + layer.name + "'.");
    }
    if (position.dimensionsSeparated === true) {
        var x = aeLayoutGetTransformProperty(layer, "ADBE Position_0");
        var y = aeLayoutGetTransformProperty(layer, "ADBE Position_1");
        aeLayoutSetPropertyValueAtTime(x, time, Number(value[0]));
        aeLayoutSetPropertyValueAtTime(y, time, Number(value[1]));
        return;
    }
    var current = position.valueAtTime(time, false);
    var next = current.length >= 3
        ? [Number(value[0]), Number(value[1]), Number(current[2])]
        : [Number(value[0]), Number(value[1])];
    aeLayoutSetPropertyValueAtTime(position, time, next);
}

function aeLayoutMoveLayerByCompDelta(layer, time, deltaX, deltaY) {
    var before = aeLayoutReadPosition(layer, time);
    if (Math.abs(deltaX) < 0.0001 && Math.abs(deltaY) < 0.0001) {
        return { moved: false, before: before, after: before, delta: [0, 0] };
    }
    var localDelta = [Number(deltaX), Number(deltaY)];
    if (layer.parent) {
        if (typeof layer.parent.compPointToSource !== "function") {
            throw new Error("Layer parent does not support comp-to-source conversion.");
        }
        var parentOrigin = layer.parent.compPointToSource([0, 0]);
        var parentDeltaPoint = layer.parent.compPointToSource([Number(deltaX), Number(deltaY)]);
        localDelta = [
            Number(parentDeltaPoint[0]) - Number(parentOrigin[0]),
            Number(parentDeltaPoint[1]) - Number(parentOrigin[1])
        ];
    }
    var after = [before[0] + localDelta[0], before[1] + localDelta[1]];
    aeLayoutSetPosition(layer, time, after);
    return { moved: true, before: before, after: after, delta: [deltaX, deltaY] };
}

function aeLayoutCollectItems(layers, time) {
    var items = [];
    for (var i = 0; i < layers.length; i++) {
        items.push({ layer: layers[i], bounds: aeLayoutLayerBounds(layers[i], time) });
    }
    return items;
}

function aeLayoutItemSummary(item, move, time) {
    return {
        layerId: item.layer.index,
        layerUid: aeTryGetLayerUid(item.layer),
        layerName: item.layer.name,
        positionBefore: move.before,
        positionAfter: move.after,
        deltaComp: move.delta,
        bounds: aeLayoutLayerBounds(item.layer, time)
    };
}

function aeAlignLayerRefs(comp, layers, rawOptions) {
    var options = aeLayoutValidateAlignOptions(comp, rawOptions);
    var previousTime = comp.time;
    var summaries = [];
    var movedCount = 0;
    try {
        comp.time = options.time;
        var items = aeLayoutCollectItems(layers, options.time);
        var referenceBounds = aeLayoutReferenceBounds(
            comp,
            options.reference,
            options.marginPercent,
            items
        );
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var deltaX = 0;
            var deltaY = 0;
            if (options.horizontal === "left") deltaX = referenceBounds.left - item.bounds.left;
            else if (options.horizontal === "center") deltaX = referenceBounds.centerX - item.bounds.centerX;
            else if (options.horizontal === "right") deltaX = referenceBounds.right - item.bounds.right;
            if (options.vertical === "top") deltaY = referenceBounds.top - item.bounds.top;
            else if (options.vertical === "center") deltaY = referenceBounds.centerY - item.bounds.centerY;
            else if (options.vertical === "bottom") deltaY = referenceBounds.bottom - item.bounds.bottom;
            deltaX += options.offset[0];
            deltaY += options.offset[1];
            var move = aeLayoutMoveLayerByCompDelta(item.layer, options.time, deltaX, deltaY);
            if (move.moved) movedCount += 1;
            summaries.push(aeLayoutItemSummary(item, move, options.time));
        }
        return {
            type: "align",
            reference: options.reference,
            referenceBounds: referenceBounds,
            horizontal: options.horizontal === undefined ? null : options.horizontal,
            vertical: options.vertical === undefined ? null : options.vertical,
            offset: options.offset,
            time: options.time,
            movedCount: movedCount,
            layers: summaries
        };
    } finally {
        comp.time = previousTime;
    }
}

function aeLayoutSortItems(items, axis) {
    items.sort(function(a, b) {
        return axis === "horizontal"
            ? a.bounds.centerX - b.bounds.centerX
            : a.bounds.centerY - b.bounds.centerY;
    });
    return items;
}

function aeDistributeLayerRefs(comp, layers, rawOptions) {
    var options = aeLayoutValidateDistributeOptions(comp, rawOptions);
    var previousTime = comp.time;
    var summaries = [];
    var movedCount = 0;
    try {
        comp.time = options.time;
        var items = aeLayoutSortItems(aeLayoutCollectItems(layers, options.time), options.axis);
        var referenceBounds = aeLayoutReferenceBounds(
            comp,
            options.reference,
            options.marginPercent,
            items
        );
        var start = options.axis === "horizontal" ? referenceBounds.left : referenceBounds.top;
        var end = options.axis === "horizontal" ? referenceBounds.right : referenceBounds.bottom;
        var span = end - start;
        var targets = [];
        var i;
        if (options.mode === "gaps") {
            var totalSize = 0;
            for (i = 0; i < items.length; i++) {
                totalSize += options.axis === "horizontal" ? items[i].bounds.width : items[i].bounds.height;
            }
            var gap = items.length > 1 ? (span - totalSize) / (items.length - 1) : 0;
            var cursor = start;
            for (i = 0; i < items.length; i++) {
                var size = options.axis === "horizontal" ? items[i].bounds.width : items[i].bounds.height;
                targets.push(cursor);
                cursor += size + gap;
            }
        } else {
            var firstSize = options.axis === "horizontal" ? items[0].bounds.width : items[0].bounds.height;
            var lastSize = options.axis === "horizontal"
                ? items[items.length - 1].bounds.width
                : items[items.length - 1].bounds.height;
            var firstCenter = start + (firstSize / 2);
            var lastCenter = end - (lastSize / 2);
            var centerStep = items.length > 1 ? (lastCenter - firstCenter) / (items.length - 1) : 0;
            for (i = 0; i < items.length; i++) {
                targets.push(firstCenter + (centerStep * i));
            }
        }
        for (i = 0; i < items.length; i++) {
            var item = items[i];
            var deltaX = 0;
            var deltaY = 0;
            if (options.axis === "horizontal") {
                deltaX = options.mode === "gaps"
                    ? targets[i] - item.bounds.left
                    : targets[i] - item.bounds.centerX;
            } else {
                deltaY = options.mode === "gaps"
                    ? targets[i] - item.bounds.top
                    : targets[i] - item.bounds.centerY;
            }
            var move = aeLayoutMoveLayerByCompDelta(item.layer, options.time, deltaX, deltaY);
            if (move.moved) movedCount += 1;
            summaries.push(aeLayoutItemSummary(item, move, options.time));
        }
        return {
            type: "distribute",
            reference: options.reference,
            referenceBounds: referenceBounds,
            axis: options.axis,
            mode: options.mode,
            time: options.time,
            movedCount: movedCount,
            layers: summaries
        };
    } finally {
        comp.time = previousTime;
    }
}

function aeValidateSceneLayoutSpecs(layoutSpecs, sceneLayerIds, compSpec, errors) {
    if (layoutSpecs === undefined) {
        return;
    }
    if (!(layoutSpecs instanceof Array)) {
        errors.push("layout must be an array when specified.");
        return;
    }
    var validationComp = {
        duration: compSpec && aeLayoutIsFiniteNumber(compSpec.duration)
            ? Number(compSpec.duration)
            : Number.MAX_VALUE,
        time: 0
    };
    for (var i = 0; i < layoutSpecs.length; i++) {
        var spec = layoutSpecs[i];
        var prefix = "layout[" + i + "]";
        if (!spec || typeof spec !== "object" || spec instanceof Array) {
            errors.push(prefix + " must be an object.");
            continue;
        }
        if (spec.type !== "align" && spec.type !== "distribute") {
            errors.push(prefix + ".type must be align or distribute.");
        }
        var minimumCount = spec.type === "distribute" ? 2 : 1;
        if (!(spec.layerIds instanceof Array) || spec.layerIds.length < minimumCount) {
            errors.push(prefix + ".layerIds must contain at least " + minimumCount + " scene id(s).");
        } else {
            var localIds = {};
            for (var j = 0; j < spec.layerIds.length; j++) {
                var layerId = spec.layerIds[j];
                if (typeof layerId !== "string" || layerId.length === 0) {
                    errors.push(prefix + ".layerIds[" + j + "] must be a non-empty string.");
                } else if (localIds[layerId]) {
                    errors.push(prefix + ".layerIds contains a duplicate: " + layerId);
                } else if (!sceneLayerIds[layerId]) {
                    errors.push(prefix + ".layerIds references an unknown scene layer: " + layerId);
                }
                localIds[layerId] = true;
            }
        }
        var options = {};
        for (var key in spec) {
            if (spec.hasOwnProperty(key) && key !== "type" && key !== "layerIds") {
                options[key] = spec[key];
            }
        }
        try {
            if (spec.type === "align") {
                aeLayoutValidateAlignOptions(validationComp, options);
            } else if (spec.type === "distribute") {
                aeLayoutValidateDistributeOptions(validationComp, options);
            }
        } catch (e) {
            errors.push(prefix + ": " + e.toString());
        }
    }
}

function alignLayers(selectorsJSON, optionsJSON) {
    try {
        ensureJSON();
        var comp = app.project ? app.project.activeItem : null;
        if (!comp || !(comp instanceof CompItem)) {
            throw new Error("Active composition not found.");
        }
        var selectors = JSON.parse(selectorsJSON);
        var options = JSON.parse(optionsJSON);
        var layers = aeLayoutResolveLayers(comp, selectors, 1);
        return encodePayload({ status: "success", layout: aeAlignLayerRefs(comp, layers, options) });
    } catch (e) {
        log("alignLayers() threw: " + e.toString());
        return encodePayload({ status: "error", message: e.toString() });
    }
}

function distributeLayers(selectorsJSON, optionsJSON) {
    try {
        ensureJSON();
        var comp = app.project ? app.project.activeItem : null;
        if (!comp || !(comp instanceof CompItem)) {
            throw new Error("Active composition not found.");
        }
        var selectors = JSON.parse(selectorsJSON);
        var options = JSON.parse(optionsJSON);
        var layers = aeLayoutResolveLayers(comp, selectors, 2);
        return encodePayload({ status: "success", layout: aeDistributeLayerRefs(comp, layers, options) });
    } catch (e) {
        log("distributeLayers() threw: " + e.toString());
        return encodePayload({ status: "error", message: e.toString() });
    }
}
