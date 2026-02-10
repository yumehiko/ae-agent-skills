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
    const layerId = searchParams.get('layerId');
    if (!layerId) {
        sendBadRequest(res, 'Missing layerId parameter');
        log('getProperties failed: Missing layerId');
        return;
    }

    const includeGroups = searchParams.getAll('includeGroup').filter(Boolean);
    const excludeGroups = searchParams.getAll('excludeGroup').filter(Boolean);
    const maxDepthParam = searchParams.get('maxDepth');

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

    const options = {};
    if (includeGroups.length > 0) options.includeGroups = includeGroups;
    if (excludeGroups.length > 0) options.excludeGroups = excludeGroups;
    if (maxDepth !== undefined) options.maxDepth = maxDepth;

    const optionsLiteral = Object.keys(options).length > 0
        ? toExtendScriptStringLiteral(JSON.stringify(options))
        : 'null';
    const optionsLabel = optionsLiteral === 'null' ? 'null' : 'custom';
    const script = `getProperties(${layerId}, ${optionsLiteral})`;

    handleBridgeDataCall(script, res, `getProperties(${layerId}, options=${optionsLabel})`);
}

function handleSetExpression(req, res) {
    readJsonBody(req, res, ({ layerId, propertyPath, expression }) => {
        if (!layerId || !propertyPath || expression === undefined) {
            sendBadRequest(res, 'Missing parameters');
            log('setExpression failed: Missing parameters');
            return;
        }
        if (typeof expression !== 'string') {
            sendBadRequest(res, 'Expression must be a string');
            log('setExpression failed: Expression must be a string');
            return;
        }

        const escapedPath = escapeForExtendScript(propertyPath);
        const expressionLiteral = toExtendScriptStringLiteral(expression);
        const script = `setExpression(${layerId}, "${escapedPath}", ${expressionLiteral})`;

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
    readJsonBody(req, res, ({ layerId, propertyPath, value }) => {
        if (!layerId || !propertyPath || value === undefined) {
            sendBadRequest(res, 'Missing parameters');
            log('setPropertyValue failed: Missing parameters');
            return;
        }
        const pathLiteral = toExtendScriptStringLiteral(propertyPath);
        const valueLiteral = toExtendScriptStringLiteral(JSON.stringify(value));
        const script = `setPropertyValue(${layerId}, ${pathLiteral}, ${valueLiteral})`;
        handleBridgeMutationCall(script, res, 'setPropertyValue()', 'Failed to set property value');
    });
}

function handleSetKeyframe(req, res) {
    readJsonBody(req, res, ({ layerId, propertyPath, time, value, inInterp, outInterp, easeIn, easeOut }) => {
        if (!layerId || !propertyPath || time === undefined || value === undefined) {
            sendBadRequest(res, 'Missing parameters');
            log('setKeyframe failed: Missing parameters');
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
        const script = `setKeyframe(${layerId}, ${pathLiteral}, ${time}, ${valueLiteral}, ${optionsLiteral})`;
        handleBridgeMutationCall(script, res, 'setKeyframe()', 'Failed to set keyframe');
    });
}

function handleAddEffect(req, res) {
    readJsonBody(req, res, ({ layerId, effectMatchName, effectName }) => {
        if (!layerId || !effectMatchName) {
            sendBadRequest(res, 'Missing parameters');
            log('addEffect failed: Missing parameters');
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
        const script = `addEffect(${layerId}, ${matchNameLiteral}, ${effectNameLiteral})`;

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

function handleAddLayer(req, res) {
    readJsonBody(req, res, ({ layerType, name, text, width, height, color, duration }) => {
        if (!layerType || typeof layerType !== 'string') {
            sendBadRequest(res, 'layerType is required and must be a string');
            log('addLayer failed: invalid layerType');
            return;
        }

        const normalizedType = layerType.toLowerCase();
        if (!['text', 'null', 'solid', 'shape'].includes(normalizedType)) {
            sendBadRequest(res, 'Unsupported layerType. Use one of: text, null, solid, shape.');
            log(`addLayer failed: unsupported layerType "${layerType}"`);
            return;
        }
        if (name !== undefined && typeof name !== 'string') {
            sendBadRequest(res, 'name must be a string when specified');
            log('addLayer failed: name must be string');
            return;
        }
        if (text !== undefined && typeof text !== 'string') {
            sendBadRequest(res, 'text must be a string when specified');
            log('addLayer failed: text must be string');
            return;
        }
        if (width !== undefined && typeof width !== 'number') {
            sendBadRequest(res, 'width must be a number when specified');
            log('addLayer failed: width must be number');
            return;
        }
        if (height !== undefined && typeof height !== 'number') {
            sendBadRequest(res, 'height must be a number when specified');
            log('addLayer failed: height must be number');
            return;
        }
        if (duration !== undefined && typeof duration !== 'number') {
            sendBadRequest(res, 'duration must be a number when specified');
            log('addLayer failed: duration must be number');
            return;
        }
        if (color !== undefined) {
            const validColor = Array.isArray(color)
                && color.length === 3
                && color.every((part) => typeof part === 'number');
            if (!validColor) {
                sendBadRequest(res, 'color must be an array of 3 numbers when specified');
                log('addLayer failed: color must be [r, g, b]');
                return;
            }
        }

        const options = {};
        if (name !== undefined) options.name = name;
        if (text !== undefined) options.text = text;
        if (width !== undefined) options.width = width;
        if (height !== undefined) options.height = height;
        if (color !== undefined) options.color = color;
        if (duration !== undefined) options.duration = duration;

        const layerTypeLiteral = toExtendScriptStringLiteral(normalizedType);
        const optionsLiteral = Object.keys(options).length === 0
            ? 'null'
            : toExtendScriptStringLiteral(JSON.stringify(options));
        const script = `addLayer(${layerTypeLiteral}, ${optionsLiteral})`;

        log(`Calling ExtendScript: ${script}`);
        evalHostScript(script, (result) => {
            try {
                const parsedResult = parseBridgeResult(result);
                if (parsedResult && parsedResult.status === 'error') {
                    sendJson(res, 500, {
                        status: 'error',
                        message: parsedResult.message || 'Failed to add layer',
                    });
                    log(`addLayer failed: ${parsedResult.message || 'Unknown error'}`);
                    return;
                }
                sendJson(res, 200, { status: 'success', data: parsedResult });
                log('addLayer successful.');
            } catch (e) {
                sendBridgeParseError(res, result, e);
                log(`addLayer failed: ${e.toString()}`);
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
    if (pathname === '/layers' && method === 'POST') {
        handleAddLayer(req, res);
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
    if (pathname === '/effects' && method === 'POST') {
        handleAddEffect(req, res);
        return;
    }

    handleNotFound(req, res);
}
