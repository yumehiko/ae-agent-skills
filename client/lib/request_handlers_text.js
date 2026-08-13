const TEXT_JUSTIFICATIONS = [
    'left',
    'center',
    'right',
    'full-left',
    'full-center',
    'full-right',
    'full',
];

function textSelectorFromSearchParams(searchParams) {
    const layerIdRaw = searchParams.get('layerId');
    const layerNameRaw = searchParams.get('layerName');
    const layerId = layerIdRaw === null || layerIdRaw === '' ? undefined : Number(layerIdRaw);
    const layerName = layerNameRaw === null ? undefined : layerNameRaw;
    return normalizeLayerSelector(layerId, layerName);
}

function validateTextColor(value, label) {
    if (!Array.isArray(value) || value.length !== 3) {
        return `${label} must be an RGB array with exactly 3 numbers`;
    }
    if (value.some((component) => (
        typeof component !== 'number'
        || !Number.isFinite(component)
        || component < 0
        || component > 255
    ))) {
        return `${label} values must be finite numbers between 0 and 255`;
    }
    return null;
}

function validateTextStyleRequest(style) {
    const allowed = new Set([
        'font',
        'fontSize',
        'fillEnabled',
        'fillColor',
        'strokeEnabled',
        'strokeColor',
        'strokeWidth',
        'strokeOverFill',
        'tracking',
        'leading',
        'autoLeading',
        'justification',
    ]);
    const keys = Object.keys(style);
    if (keys.length === 0) {
        return 'Provide at least one text style setting';
    }
    const unknown = keys.find((key) => !allowed.has(key));
    if (unknown) return `Unknown text style setting: ${unknown}`;
    if (style.font !== undefined && (typeof style.font !== 'string' || !style.font.trim())) {
        return 'font must be a non-empty PostScript font name when specified';
    }
    if (style.fontSize !== undefined && (
        typeof style.fontSize !== 'number'
        || !Number.isFinite(style.fontSize)
        || style.fontSize < 0.1
        || style.fontSize > 1296
    )) return 'fontSize must be between 0.1 and 1296 when specified';
    if (style.fillEnabled !== undefined && typeof style.fillEnabled !== 'boolean') {
        return 'fillEnabled must be a boolean when specified';
    }
    if (style.fillColor !== undefined) {
        const colorError = validateTextColor(style.fillColor, 'fillColor');
        if (colorError) return colorError;
    }
    if (style.strokeEnabled !== undefined && typeof style.strokeEnabled !== 'boolean') {
        return 'strokeEnabled must be a boolean when specified';
    }
    if (style.strokeColor !== undefined) {
        const colorError = validateTextColor(style.strokeColor, 'strokeColor');
        if (colorError) return colorError;
    }
    if (style.strokeWidth !== undefined && (
        typeof style.strokeWidth !== 'number'
        || !Number.isFinite(style.strokeWidth)
        || style.strokeWidth < 0
        || style.strokeWidth > 1000
    )) return 'strokeWidth must be between 0 and 1000 when specified';
    if (style.strokeOverFill !== undefined && typeof style.strokeOverFill !== 'boolean') {
        return 'strokeOverFill must be a boolean when specified';
    }
    if (style.tracking !== undefined && (
        typeof style.tracking !== 'number' || !Number.isFinite(style.tracking)
    )) return 'tracking must be a finite number when specified';
    if (style.leading !== undefined && (
        typeof style.leading !== 'number'
        || !Number.isFinite(style.leading)
        || style.leading < 0.1
        || style.leading > 1296
    )) return 'leading must be between 0.1 and 1296 when specified';
    if (style.autoLeading !== undefined && typeof style.autoLeading !== 'boolean') {
        return 'autoLeading must be a boolean when specified';
    }
    if (style.leading !== undefined && style.autoLeading === true) {
        return 'leading cannot be combined with autoLeading: true';
    }
    if (style.justification !== undefined
        && !TEXT_JUSTIFICATIONS.includes(style.justification)) {
        return `justification must be one of: ${TEXT_JUSTIFICATIONS.join(', ')}`;
    }
    return null;
}

function handleListFonts(searchParams, res) {
    const query = searchParams.get('query') || '';
    const limitRaw = searchParams.get('limit');
    let limit = 200;
    if (limitRaw !== null && limitRaw !== '') {
        limit = Number(limitRaw);
        if (!Number.isInteger(limit) || limit <= 0) {
            sendBadRequest(res, 'limit must be a positive integer');
            return;
        }
    }
    const script = `listFonts(${toExtendScriptStringLiteral(query)}, ${limit})`;
    handleBridgeMutationCall(script, res, 'listFonts()', 'Failed to list fonts');
}

function handleGetTextStyle(searchParams, res) {
    const selector = textSelectorFromSearchParams(searchParams);
    if (!selector.ok) {
        sendBadRequest(res, selector.error);
        return;
    }
    const compSelector = normalizeOptionalCompQuerySelector(searchParams);
    if (!compSelector.ok) {
        sendBadRequest(res, compSelector.error);
        return;
    }
    const script = `getTextStyle(${selector.layerIdLiteral}, ${selector.layerNameLiteral}, ${compSelector.compIdLiteral}, ${compSelector.compNameLiteral})`;
    handleBridgeMutationCall(script, res, 'getTextStyle()', 'Failed to get text style');
}

function handleSetTextStyle(req, res) {
    readJsonBody(req, res, (body) => {
        const selector = normalizeLayerSelector(body.layerId, body.layerName);
        if (!selector.ok) {
            sendBadRequest(res, selector.error);
            return;
        }
        const style = {};
        Object.keys(body).forEach((key) => {
            if (!['layerId', 'layerName', 'compId', 'compName'].includes(key)) style[key] = body[key];
        });
        const validationError = validateTextStyleRequest(style);
        if (validationError) {
            sendBadRequest(res, validationError);
            return;
        }
        const styleLiteral = toExtendScriptStringLiteral(JSON.stringify(style));
        const script = `setTextStyle(${selector.layerIdLiteral}, ${selector.layerNameLiteral}, ${styleLiteral})`;
        handleBridgeMutationCall(script, res, 'setTextStyle()', 'Failed to set text style', body.compId, body.compName);
    });
}

function handleSetTextJsonCollection(req, res, fieldName, hostFunction, contextLabel) {
    readJsonBody(req, res, (body) => {
        const selector = normalizeLayerSelector(body.layerId, body.layerName);
        if (!selector.ok) {
            sendBadRequest(res, selector.error);
            return;
        }
        if (!Array.isArray(body[fieldName])) {
            sendBadRequest(res, `${fieldName} must be an array`);
            return;
        }
        const collectionLiteral = toExtendScriptStringLiteral(JSON.stringify(body[fieldName]));
        const script = `${hostFunction}(${selector.layerIdLiteral}, ${selector.layerNameLiteral}, ${collectionLiteral})`;
        handleBridgeMutationCall(
            script,
            res,
            `${contextLabel}()`,
            `Failed to set ${fieldName}`,
            body.compId,
            body.compName,
        );
    });
}

function routeTextRequest(pathname, method, req, res, searchParams) {
    if (pathname === '/fonts' && method === 'GET') {
        handleListFonts(searchParams, res);
        return true;
    }
    if (pathname === '/text-style' && method === 'GET') {
        handleGetTextStyle(searchParams, res);
        return true;
    }
    if (pathname === '/text-style' && method === 'POST') {
        handleSetTextStyle(req, res);
        return true;
    }
    if (pathname === '/text-style-ranges' && method === 'POST') {
        handleSetTextJsonCollection(
            req,
            res,
            'textStyleRanges',
            'setTextStyleRanges',
            'setTextStyleRanges',
        );
        return true;
    }
    if (pathname === '/text-animators' && method === 'POST') {
        handleSetTextJsonCollection(
            req,
            res,
            'textAnimators',
            'setTextAnimators',
            'setTextAnimators',
        );
        return true;
    }
    return false;
}
