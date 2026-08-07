const LAYOUT_REFERENCES = ['comp', 'action-safe', 'title-safe', 'selection'];

function validateLayoutSelectors(layerIds, layerNames, minimumCount) {
    const hasIds = Array.isArray(layerIds);
    const hasNames = Array.isArray(layerNames);
    if (hasIds === hasNames) {
        return { error: 'Provide exactly one of layerIds or layerNames' };
    }
    const values = hasIds ? layerIds : layerNames;
    if (values.length < minimumCount) {
        return { error: `At least ${minimumCount} layer selector(s) are required` };
    }
    if (hasIds && values.some((value) => (
        typeof value !== 'number' || !Number.isInteger(value) || value <= 0
    ))) {
        return { error: 'layerIds must contain positive integers' };
    }
    if (hasNames && values.some((value) => (
        typeof value !== 'string' || !value.trim()
    ))) {
        return { error: 'layerNames must contain non-empty strings' };
    }
    const normalizedValues = hasNames ? values.map((value) => value.trim()) : values;
    if (new Set(normalizedValues.map(String)).size !== normalizedValues.length) {
        return { error: 'Layer selectors must not contain duplicates' };
    }
    return {
        selectors: hasIds ? { layerIds: normalizedValues } : { layerNames: normalizedValues },
    };
}

function validateLayoutCommon(body) {
    const reference = body.reference === undefined ? 'comp' : body.reference;
    if (!LAYOUT_REFERENCES.includes(reference)) {
        return { error: `reference must be one of: ${LAYOUT_REFERENCES.join(', ')}` };
    }
    if (body.time !== undefined && (
        typeof body.time !== 'number' || !Number.isFinite(body.time) || body.time < 0
    )) return { error: 'time must be a finite number greater than or equal to 0' };
    if (body.marginPercent !== undefined && (
        typeof body.marginPercent !== 'number'
        || !Number.isFinite(body.marginPercent)
        || body.marginPercent < 0
        || body.marginPercent >= 50
    )) return { error: 'marginPercent must be between 0 and 50 (exclusive)' };
    if (reference === 'selection' && body.marginPercent !== undefined) {
        return { error: 'marginPercent is not allowed when reference is selection' };
    }
    return { reference };
}

function buildLayoutScript(functionName, selectors, options) {
    const selectorsLiteral = toExtendScriptStringLiteral(JSON.stringify(selectors));
    const optionsLiteral = toExtendScriptStringLiteral(JSON.stringify(options));
    return `${functionName}(${selectorsLiteral}, ${optionsLiteral})`;
}

function handleAlignLayers(req, res) {
    readJsonBody(req, res, (body) => {
        const selectorResult = validateLayoutSelectors(body.layerIds, body.layerNames, 1);
        if (selectorResult.error) {
            sendBadRequest(res, selectorResult.error);
            return;
        }
        const common = validateLayoutCommon(body);
        if (common.error) {
            sendBadRequest(res, common.error);
            return;
        }
        if (body.horizontal === undefined && body.vertical === undefined) {
            sendBadRequest(res, 'Provide horizontal, vertical, or both');
            return;
        }
        if (body.horizontal !== undefined
            && !['left', 'center', 'right'].includes(body.horizontal)) {
            sendBadRequest(res, 'horizontal must be one of: left, center, right');
            return;
        }
        if (body.vertical !== undefined
            && !['top', 'center', 'bottom'].includes(body.vertical)) {
            sendBadRequest(res, 'vertical must be one of: top, center, bottom');
            return;
        }
        if (body.offset !== undefined && (
            !Array.isArray(body.offset)
            || body.offset.length !== 2
            || body.offset.some((value) => typeof value !== 'number' || !Number.isFinite(value))
        )) {
            sendBadRequest(res, 'offset must be a finite [x, y] array');
            return;
        }
        const options = { reference: common.reference };
        if (body.horizontal !== undefined) options.horizontal = body.horizontal;
        if (body.vertical !== undefined) options.vertical = body.vertical;
        if (body.offset !== undefined) options.offset = body.offset;
        if (body.time !== undefined) options.time = body.time;
        if (body.marginPercent !== undefined) options.marginPercent = body.marginPercent;
        const script = buildLayoutScript('alignLayers', selectorResult.selectors, options);
        handleBridgeMutationCall(script, res, 'alignLayers()', 'Failed to align layers');
    });
}

function handleDistributeLayers(req, res) {
    readJsonBody(req, res, (body) => {
        const selectorResult = validateLayoutSelectors(body.layerIds, body.layerNames, 2);
        if (selectorResult.error) {
            sendBadRequest(res, selectorResult.error);
            return;
        }
        const common = validateLayoutCommon(body);
        if (common.error) {
            sendBadRequest(res, common.error);
            return;
        }
        if (!['horizontal', 'vertical'].includes(body.axis)) {
            sendBadRequest(res, 'axis must be horizontal or vertical');
            return;
        }
        const mode = body.mode === undefined ? 'gaps' : body.mode;
        if (!['gaps', 'centers'].includes(mode)) {
            sendBadRequest(res, 'mode must be gaps or centers');
            return;
        }
        const options = {
            reference: common.reference,
            axis: body.axis,
            mode,
        };
        if (body.time !== undefined) options.time = body.time;
        if (body.marginPercent !== undefined) options.marginPercent = body.marginPercent;
        const script = buildLayoutScript('distributeLayers', selectorResult.selectors, options);
        handleBridgeMutationCall(script, res, 'distributeLayers()', 'Failed to distribute layers');
    });
}

function routeLayoutRequest(pathname, method, req, res) {
    if (pathname === '/layout-align' && method === 'POST') {
        handleAlignLayers(req, res);
        return true;
    }
    if (pathname === '/layout-distribute' && method === 'POST') {
        handleDistributeLayers(req, res);
        return true;
    }
    return false;
}
