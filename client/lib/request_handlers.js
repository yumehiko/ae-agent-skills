function applyCommonResponseHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
}

function handleCorsPreflight(req, res) {
    if (req.method !== 'OPTIONS') {
        return false;
    }
    res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return true;
}

function handleBridgeDataCall(script, res, contextLabel) {
    log(`Calling ExtendScript: ${contextLabel}`);
    evalHostScript(script, (result) => {
        try {
            const parsedResult = parseBridgeResult(result);
            sendJson(res, 200, { status: 'success', data: parsedResult });
            log(`${contextLabel} successful.`);
        } catch (e) {
            sendBridgeParseError(res, result, e);
            log(`${contextLabel} failed: ${e.toString()}`);
        }
    });
}

function handleBridgeMutationCall(script, res, contextLabel, fallbackMessage) {
    log(`Calling ExtendScript: ${contextLabel}`);
    evalHostScript(script, (result) => {
        try {
            const parsedResult = parseBridgeResult(result);
            if (parsedResult && parsedResult.status === 'error') {
                sendJson(res, 500, {
                    status: 'error',
                    message: parsedResult.message || fallbackMessage,
                });
                log(`${contextLabel} failed: ${parsedResult.message || 'Unknown error'}`);
                return;
            }
            sendJson(res, 200, { status: 'success', data: parsedResult });
            log(`${contextLabel} successful.`);
        } catch (e) {
            sendBridgeParseError(res, result, e);
            log(`${contextLabel} failed: ${e.toString()}`);
        }
    });
}

function normalizeLayerSelector(layerIdRaw, layerNameRaw) {
    const hasLayerId = layerIdRaw !== undefined && layerIdRaw !== null;
    const hasLayerName = typeof layerNameRaw === 'string' && layerNameRaw.trim().length > 0;
    if ((hasLayerId && hasLayerName) || (!hasLayerId && !hasLayerName)) {
        return { ok: false, error: 'Provide exactly one of layerId or layerName' };
    }
    if (hasLayerId) {
        if (typeof layerIdRaw !== 'number' || !Number.isInteger(layerIdRaw) || layerIdRaw <= 0) {
            return { ok: false, error: 'layerId must be a positive integer when specified' };
        }
        return { ok: true, layerIdLiteral: String(layerIdRaw), layerNameLiteral: 'null' };
    }
    return {
        ok: true,
        layerIdLiteral: 'null',
        layerNameLiteral: toExtendScriptStringLiteral(layerNameRaw.trim()),
    };
}

function handleHealth(res) {
    sendJson(res, 200, { status: 'ok' });
    log('Health check responded with ok.');
}

function handleGetLayers(res) {
    handleBridgeDataCall('getLayers()', res, 'getLayers()');
}

function handleGetComps(res) {
    handleBridgeDataCall('listComps()', res, 'listComps()');
}

function handleGetSelectedProperties(res) {
    handleBridgeDataCall('getSelectedProperties()', res, 'getSelectedProperties()');
}

function handleCreateComp(req, res) {
    readJsonBody(req, res, ({ name, width, height, duration, frameRate, pixelAspect }) => {
        if (!name || typeof name !== 'string') {
            sendBadRequest(res, 'name is required and must be a string');
            log('createComp failed: invalid name');
            return;
        }
        if (typeof width !== 'number' || width <= 0) {
            sendBadRequest(res, 'width is required and must be a positive number');
            log('createComp failed: invalid width');
            return;
        }
        if (typeof height !== 'number' || height <= 0) {
            sendBadRequest(res, 'height is required and must be a positive number');
            log('createComp failed: invalid height');
            return;
        }
        if (typeof duration !== 'number' || duration <= 0) {
            sendBadRequest(res, 'duration is required and must be a positive number');
            log('createComp failed: invalid duration');
            return;
        }
        if (typeof frameRate !== 'number' || frameRate <= 0) {
            sendBadRequest(res, 'frameRate is required and must be a positive number');
            log('createComp failed: invalid frameRate');
            return;
        }
        if (pixelAspect !== undefined && (typeof pixelAspect !== 'number' || pixelAspect <= 0)) {
            sendBadRequest(res, 'pixelAspect must be a positive number when specified');
            log('createComp failed: invalid pixelAspect');
            return;
        }

        const nameLiteral = toExtendScriptStringLiteral(name);
        const pixelAspectValue = pixelAspect === undefined ? 1.0 : pixelAspect;
        const script = `createComp(${nameLiteral}, ${width}, ${height}, ${pixelAspectValue}, ${duration}, ${frameRate})`;
        handleBridgeMutationCall(script, res, 'createComp()', 'Failed to create comp');
    });
}

function handleSetActiveComp(req, res) {
    readJsonBody(req, res, ({ compId, compName }) => {
        const hasCompId = compId !== undefined;
        const hasCompName = compName !== undefined && compName !== null && compName !== '';
        if ((hasCompId && hasCompName) || (!hasCompId && !hasCompName)) {
            sendBadRequest(res, 'Provide exactly one of compId or compName');
            log('setActiveComp failed: invalid selector');
            return;
        }
        if (hasCompId && typeof compId !== 'number') {
            sendBadRequest(res, 'compId must be a number');
            log('setActiveComp failed: compId must be number');
            return;
        }
        if (hasCompName && typeof compName !== 'string') {
            sendBadRequest(res, 'compName must be a string');
            log('setActiveComp failed: compName must be string');
            return;
        }

        const compIdLiteral = hasCompId ? String(compId) : 'null';
        const compNameLiteral = hasCompName ? toExtendScriptStringLiteral(compName) : 'null';
        const script = `setActiveComp(${compIdLiteral}, ${compNameLiteral})`;
        handleBridgeMutationCall(script, res, 'setActiveComp()', 'Failed to set active comp');
    });
}

function handleGetProperties(searchParams, res) {
    const layerIdParam = searchParams.get('layerId');
    const layerNameParam = searchParams.get('layerName');
    const hasLayerId = layerIdParam !== null && layerIdParam !== '';
    const hasLayerName = layerNameParam !== null && layerNameParam.trim() !== '';
    if ((hasLayerId && hasLayerName) || (!hasLayerId && !hasLayerName)) {
        sendBadRequest(res, 'Provide exactly one of layerId or layerName');
        log('getProperties failed: invalid layer selector');
        return;
    }
    let layerId = null;
    if (hasLayerId) {
        const parsedLayerId = parseInt(layerIdParam, 10);
        if (isNaN(parsedLayerId) || parsedLayerId <= 0) {
            sendBadRequest(res, 'layerId must be a positive integer');
            log('getProperties failed: invalid layerId');
            return;
        }
        layerId = parsedLayerId;
    }

    const includeGroups = searchParams.getAll('includeGroup').filter(Boolean);
    const excludeGroups = searchParams.getAll('excludeGroup').filter(Boolean);
    const maxDepthParam = searchParams.get('maxDepth');
    const includeGroupChildrenParam = searchParams.get('includeGroupChildren');
    const timeParam = searchParams.get('time');

    let maxDepth;
    if (maxDepthParam !== null) {
        const parsedDepth = parseInt(maxDepthParam, 10);
        if (isNaN(parsedDepth) || parsedDepth <= 0) {
            sendBadRequest(res, 'maxDepth must be a positive integer');
            log('getProperties failed: Invalid maxDepth');
            return;
        }
        maxDepth = parsedDepth;
    }
    let includeGroupChildren;
    if (includeGroupChildrenParam !== null) {
        if (!['true', 'false'].includes(includeGroupChildrenParam)) {
            sendBadRequest(res, 'includeGroupChildren must be true or false');
            log('getProperties failed: invalid includeGroupChildren');
            return;
        }
        includeGroupChildren = includeGroupChildrenParam === 'true';
    }
    let time;
    if (timeParam !== null) {
        const parsedTime = Number(timeParam);
        if (!isFinite(parsedTime)) {
            sendBadRequest(res, 'time must be a finite number');
            log('getProperties failed: invalid time');
            return;
        }
        time = parsedTime;
    }

    const options = {};
    if (hasLayerName) options.layerName = layerNameParam.trim();
    if (includeGroups.length > 0) options.includeGroups = includeGroups;
    if (excludeGroups.length > 0) options.excludeGroups = excludeGroups;
    if (maxDepth !== undefined) options.maxDepth = maxDepth;
    if (includeGroupChildren !== undefined) options.includeGroupChildren = includeGroupChildren;
    if (time !== undefined) options.time = time;

    const optionsLiteral = Object.keys(options).length > 0
        ? toExtendScriptStringLiteral(JSON.stringify(options))
        : 'null';
    const optionsLabel = optionsLiteral === 'null' ? 'null' : 'custom';
    const layerIdLiteral = layerId === null ? 'null' : String(layerId);
    const script = `getProperties(${layerIdLiteral}, ${optionsLiteral})`;

    handleBridgeDataCall(script, res, `getProperties(${layerIdLiteral}, options=${optionsLabel})`);
}

function handleSetExpression(req, res) {
    readJsonBody(req, res, ({ layerId, layerName, propertyPath, expression }) => {
        if (!propertyPath || expression === undefined) {
            sendBadRequest(res, 'Missing parameters');
            log('setExpression failed: Missing parameters');
            return;
        }
        const selector = normalizeLayerSelector(layerId, layerName);
        if (!selector.ok) {
            sendBadRequest(res, selector.error);
            log(`setExpression failed: ${selector.error}`);
            return;
        }
        if (typeof expression !== 'string') {
            sendBadRequest(res, 'Expression must be a string');
            log('setExpression failed: Expression must be a string');
            return;
        }

        const escapedPath = escapeForExtendScript(propertyPath);
        const expressionLiteral = toExtendScriptStringLiteral(expression);
        const script = `setExpression(${selector.layerIdLiteral}, ${selector.layerNameLiteral}, "${escapedPath}", ${expressionLiteral})`;

        log(`Calling ExtendScript: ${script}`);
        evalHostScript(script, (result) => {
            if (result === 'success') {
                sendJson(res, 200, { status: 'success', message: 'Expression set successfully' });
                log('setExpression successful.');
                return;
            }
            sendJson(res, 500, { status: 'error', message: result });
            log(`setExpression failed: ${result}`);
        });
    });
}

function handleSetPropertyValue(req, res) {
    readJsonBody(req, res, ({ layerId, layerName, propertyPath, value }) => {
        if (!propertyPath || value === undefined) {
            sendBadRequest(res, 'Missing parameters');
            log('setPropertyValue failed: Missing parameters');
            return;
        }
        const selector = normalizeLayerSelector(layerId, layerName);
        if (!selector.ok) {
            sendBadRequest(res, selector.error);
            log(`setPropertyValue failed: ${selector.error}`);
            return;
        }
        const pathLiteral = toExtendScriptStringLiteral(propertyPath);
        const valueLiteral = toExtendScriptStringLiteral(JSON.stringify(value));
        const script = `setPropertyValue(${selector.layerIdLiteral}, ${selector.layerNameLiteral}, ${pathLiteral}, ${valueLiteral})`;
        handleBridgeMutationCall(script, res, 'setPropertyValue()', 'Failed to set property value');
    });
}

function handleSetKeyframe(req, res) {
    readJsonBody(req, res, ({ layerId, layerName, propertyPath, time, value, inInterp, outInterp, easeIn, easeOut }) => {
        if (!propertyPath || time === undefined || value === undefined) {
            sendBadRequest(res, 'Missing parameters');
            log('setKeyframe failed: Missing parameters');
            return;
        }
        const selector = normalizeLayerSelector(layerId, layerName);
        if (!selector.ok) {
            sendBadRequest(res, selector.error);
            log(`setKeyframe failed: ${selector.error}`);
            return;
        }
        if (typeof time !== 'number' || !isFinite(time)) {
            sendBadRequest(res, 'time must be a number');
            log('setKeyframe failed: invalid time');
            return;
        }
        if (inInterp !== undefined && !['linear', 'bezier', 'hold'].includes(inInterp)) {
            sendBadRequest(res, 'inInterp must be one of: linear, bezier, hold');
            log('setKeyframe failed: invalid inInterp');
            return;
        }
        if (outInterp !== undefined && !['linear', 'bezier', 'hold'].includes(outInterp)) {
            sendBadRequest(res, 'outInterp must be one of: linear, bezier, hold');
            log('setKeyframe failed: invalid outInterp');
            return;
        }

        const pathLiteral = toExtendScriptStringLiteral(propertyPath);
        const valueLiteral = toExtendScriptStringLiteral(JSON.stringify(value));
        const options = {};
        if (inInterp !== undefined) options.inInterp = inInterp;
        if (outInterp !== undefined) options.outInterp = outInterp;
        if (easeIn !== undefined) options.easeIn = easeIn;
        if (easeOut !== undefined) options.easeOut = easeOut;
        const optionsLiteral = Object.keys(options).length === 0
            ? 'null'
            : toExtendScriptStringLiteral(JSON.stringify(options));
        const script = `setKeyframe(${selector.layerIdLiteral}, ${selector.layerNameLiteral}, ${pathLiteral}, ${time}, ${valueLiteral}, ${optionsLiteral})`;
        handleBridgeMutationCall(script, res, 'setKeyframe()', 'Failed to set keyframe');
    });
}

function handleAddEffect(req, res) {
    readJsonBody(req, res, ({ layerId, layerName, effectMatchName, effectName }) => {
        if (!effectMatchName) {
            sendBadRequest(res, 'Missing parameters');
            log('addEffect failed: Missing parameters');
            return;
        }
        const selector = normalizeLayerSelector(layerId, layerName);
        if (!selector.ok) {
            sendBadRequest(res, selector.error);
            log(`addEffect failed: ${selector.error}`);
            return;
        }
        if (effectName !== undefined && typeof effectName !== 'string') {
            sendBadRequest(res, 'effectName must be a string when specified');
            log('addEffect failed: effectName must be a string');
            return;
        }

        const matchNameLiteral = toExtendScriptStringLiteral(effectMatchName);
        const effectNameLiteral = effectName === undefined
            ? 'null'
            : toExtendScriptStringLiteral(effectName);
        const script = `addEffect(${selector.layerIdLiteral}, ${selector.layerNameLiteral}, ${matchNameLiteral}, ${effectNameLiteral})`;

        log(`Calling ExtendScript: ${script}`);
        evalHostScript(script, (result) => {
            try {
                const parsedResult = parseBridgeResult(result);
                if (parsedResult && parsedResult.status === 'error') {
                    sendJson(res, 500, {
                        status: 'error',
                        message: parsedResult.message || 'Failed to add effect',
                    });
                    log(`addEffect failed: ${parsedResult.message || 'Unknown error'}`);
                    return;
                }
                sendJson(res, 200, { status: 'success', data: parsedResult });
                log('addEffect successful.');
            } catch (e) {
                sendBridgeParseError(res, result, e);
                log(`addEffect failed: ${e.toString()}`);
            }
        });
    });
}

function handleNotFound(req, res) {
    sendJson(res, 404, { status: 'error', message: 'Not Found' });
    log(`404 Not Found: ${req.method} ${req.url}`);
}

function routeRequest(req, res) {
    log(`Request received: ${req.method} ${req.url}`);

    if (handleCorsPreflight(req, res)) {
        return;
    }

    applyCommonResponseHeaders(res);

    const [pathname, queryString = ''] = req.url.split('?');
    const method = (req.method || 'GET').toUpperCase();
    const searchParams = new URLSearchParams(queryString);

    if (pathname === '/health' && method === 'GET') {
        handleHealth(res);
        return;
    }
    if (pathname === '/layers' && method === 'GET') {
        handleGetLayers(res);
        return;
    }
    if (pathname === '/comps' && method === 'GET') {
        handleGetComps(res);
        return;
    }
    if (typeof routeShapeRequest === 'function' && routeShapeRequest(pathname, method, req, res)) {
        return;
    }
    if (typeof routeSceneRequest === 'function' && routeSceneRequest(pathname, method, req, res)) {
        return;
    }
    if (pathname === '/comps' && method === 'POST') {
        handleCreateComp(req, res);
        return;
    }
    if (pathname === '/active-comp' && method === 'POST') {
        handleSetActiveComp(req, res);
        return;
    }
    if (pathname === '/properties' && method === 'GET') {
        handleGetProperties(searchParams, res);
        return;
    }
    if (pathname === '/selected-properties' && method === 'GET') {
        handleGetSelectedProperties(res);
        return;
    }
    if (pathname === '/expression' && method === 'POST') {
        handleSetExpression(req, res);
        return;
    }
    if (pathname === '/property-value' && method === 'POST') {
        handleSetPropertyValue(req, res);
        return;
    }
    if (pathname === '/keyframes' && method === 'POST') {
        handleSetKeyframe(req, res);
        return;
    }
    if (typeof routeEssentialRequest === 'function' && routeEssentialRequest(pathname, method, req, res)) {
        return;
    }
    if (pathname === '/effects' && method === 'POST') {
        handleAddEffect(req, res);
        return;
    }
    if (typeof routeTimelineRequest === 'function' && routeTimelineRequest(pathname, method, req, res)) {
        return;
    }
    if (typeof routeLayerStructureRequest === 'function'
        && routeLayerStructureRequest(pathname, method, req, res)) {
        return;
    }

    handleNotFound(req, res);
}
