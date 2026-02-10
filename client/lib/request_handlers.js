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

function handleSetInOutPoint(req, res) {
    readJsonBody(req, res, ({ layerId, inPoint, outPoint }) => {
        if (!layerId || (inPoint === undefined && outPoint === undefined)) {
            sendBadRequest(res, 'layerId and at least one of inPoint/outPoint are required');
            log('setInOutPoint failed: missing parameters');
            return;
        }
        if (inPoint !== undefined && (typeof inPoint !== 'number' || !isFinite(inPoint))) {
            sendBadRequest(res, 'inPoint must be a finite number when specified');
            log('setInOutPoint failed: invalid inPoint');
            return;
        }
        if (outPoint !== undefined && (typeof outPoint !== 'number' || !isFinite(outPoint))) {
            sendBadRequest(res, 'outPoint must be a finite number when specified');
            log('setInOutPoint failed: invalid outPoint');
            return;
        }

        const inPointLiteral = inPoint === undefined ? 'null' : String(inPoint);
        const outPointLiteral = outPoint === undefined ? 'null' : String(outPoint);
        const script = `setInOutPoint(${layerId}, ${inPointLiteral}, ${outPointLiteral})`;
        handleBridgeMutationCall(script, res, 'setInOutPoint()', 'Failed to set in/out point');
    });
}

function handleMoveLayerTime(req, res) {
    readJsonBody(req, res, ({ layerId, delta }) => {
        if (!layerId || delta === undefined) {
            sendBadRequest(res, 'layerId and delta are required');
            log('moveLayerTime failed: missing parameters');
            return;
        }
        if (typeof delta !== 'number' || !isFinite(delta)) {
            sendBadRequest(res, 'delta must be a finite number');
            log('moveLayerTime failed: invalid delta');
            return;
        }

        const script = `moveLayerTime(${layerId}, ${delta})`;
        handleBridgeMutationCall(script, res, 'moveLayerTime()', 'Failed to move layer time');
    });
}

function handleSetCti(req, res) {
    readJsonBody(req, res, ({ time }) => {
        if (time === undefined) {
            sendBadRequest(res, 'time is required');
            log('setCTI failed: missing time');
            return;
        }
        if (typeof time !== 'number' || !isFinite(time)) {
            sendBadRequest(res, 'time must be a finite number');
            log('setCTI failed: invalid time');
            return;
        }

        const script = `setCTI(${time})`;
        handleBridgeMutationCall(script, res, 'setCTI()', 'Failed to set CTI');
    });
}

function handleSetWorkArea(req, res) {
    readJsonBody(req, res, ({ start, duration }) => {
        if (start === undefined || duration === undefined) {
            sendBadRequest(res, 'start and duration are required');
            log('setWorkArea failed: missing parameters');
            return;
        }
        if (typeof start !== 'number' || !isFinite(start)) {
            sendBadRequest(res, 'start must be a finite number');
            log('setWorkArea failed: invalid start');
            return;
        }
        if (typeof duration !== 'number' || !isFinite(duration)) {
            sendBadRequest(res, 'duration must be a finite number');
            log('setWorkArea failed: invalid duration');
            return;
        }

        const script = `setWorkArea(${start}, ${duration})`;
        handleBridgeMutationCall(script, res, 'setWorkArea()', 'Failed to set work area');
    });
}

function handleParentLayer(req, res) {
    readJsonBody(req, res, ({ childLayerId, parentLayerId }) => {
        if (!childLayerId) {
            sendBadRequest(res, 'childLayerId is required');
            log('parentLayer failed: missing childLayerId');
            return;
        }
        if (parentLayerId !== undefined && parentLayerId !== null && typeof parentLayerId !== 'number') {
            sendBadRequest(res, 'parentLayerId must be a number when specified');
            log('parentLayer failed: invalid parentLayerId');
            return;
        }

        const parentLiteral = parentLayerId === undefined || parentLayerId === null
            ? 'null'
            : String(parentLayerId);
        const script = `parentLayer(${childLayerId}, ${parentLiteral})`;
        handleBridgeMutationCall(script, res, 'parentLayer()', 'Failed to set parent layer');
    });
}

function handlePrecompose(req, res) {
    readJsonBody(req, res, ({ layerIds, name, moveAllAttributes }) => {
        if (!Array.isArray(layerIds) || layerIds.length === 0 || !name || typeof name !== 'string') {
            sendBadRequest(res, 'layerIds (non-empty array) and name (string) are required');
            log('precompose failed: invalid layerIds or name');
            return;
        }
        const allNumbers = layerIds.every((id) => typeof id === 'number');
        if (!allNumbers) {
            sendBadRequest(res, 'layerIds must be an array of numbers');
            log('precompose failed: invalid layerIds values');
            return;
        }
        if (moveAllAttributes !== undefined && typeof moveAllAttributes !== 'boolean') {
            sendBadRequest(res, 'moveAllAttributes must be boolean when specified');
            log('precompose failed: invalid moveAllAttributes');
            return;
        }

        const layerIdsLiteral = toExtendScriptStringLiteral(JSON.stringify(layerIds));
        const nameLiteral = toExtendScriptStringLiteral(name);
        const moveLiteral = moveAllAttributes === undefined ? 'false' : String(moveAllAttributes);
        const script = `precomposeLayers(${layerIdsLiteral}, ${nameLiteral}, ${moveLiteral})`;
        handleBridgeMutationCall(script, res, 'precomposeLayers()', 'Failed to precompose layers');
    });
}

function handleDuplicateLayer(req, res) {
    readJsonBody(req, res, ({ layerId }) => {
        if (!layerId) {
            sendBadRequest(res, 'layerId is required');
            log('duplicateLayer failed: missing layerId');
            return;
        }
        const script = `duplicateLayer(${layerId})`;
        handleBridgeMutationCall(script, res, 'duplicateLayer()', 'Failed to duplicate layer');
    });
}

function handleMoveLayerOrder(req, res) {
    readJsonBody(req, res, ({ layerId, beforeLayerId, afterLayerId, toTop, toBottom }) => {
        if (!layerId) {
            sendBadRequest(res, 'layerId is required');
            log('moveLayerOrder failed: missing layerId');
            return;
        }

        let specified = 0;
        if (beforeLayerId !== undefined) specified += 1;
        if (afterLayerId !== undefined) specified += 1;
        if (toTop === true) specified += 1;
        if (toBottom === true) specified += 1;
        if (specified !== 1) {
            sendBadRequest(res, 'Specify exactly one of beforeLayerId, afterLayerId, toTop, toBottom');
            log('moveLayerOrder failed: invalid target selector');
            return;
        }
        if (beforeLayerId !== undefined && typeof beforeLayerId !== 'number') {
            sendBadRequest(res, 'beforeLayerId must be a number');
            log('moveLayerOrder failed: invalid beforeLayerId');
            return;
        }
        if (afterLayerId !== undefined && typeof afterLayerId !== 'number') {
            sendBadRequest(res, 'afterLayerId must be a number');
            log('moveLayerOrder failed: invalid afterLayerId');
            return;
        }
        if (toTop !== undefined && typeof toTop !== 'boolean') {
            sendBadRequest(res, 'toTop must be boolean when specified');
            log('moveLayerOrder failed: invalid toTop');
            return;
        }
        if (toBottom !== undefined && typeof toBottom !== 'boolean') {
            sendBadRequest(res, 'toBottom must be boolean when specified');
            log('moveLayerOrder failed: invalid toBottom');
            return;
        }

        const beforeLiteral = beforeLayerId === undefined ? 'null' : String(beforeLayerId);
        const afterLiteral = afterLayerId === undefined ? 'null' : String(afterLayerId);
        const topLiteral = toTop === true ? 'true' : 'false';
        const bottomLiteral = toBottom === true ? 'true' : 'false';
        const script = `moveLayerOrder(${layerId}, ${beforeLiteral}, ${afterLiteral}, ${topLiteral}, ${bottomLiteral})`;
        handleBridgeMutationCall(script, res, 'moveLayerOrder()', 'Failed to move layer order');
    });
}

function handleDeleteLayer(req, res) {
    readJsonBody(req, res, ({ layerId }) => {
        if (!layerId) {
            sendBadRequest(res, 'layerId is required');
            log('deleteLayer failed: missing layerId');
            return;
        }
        if (typeof layerId !== 'number') {
            sendBadRequest(res, 'layerId must be a number');
            log('deleteLayer failed: invalid layerId');
            return;
        }

        const script = `deleteLayer(${layerId})`;
        handleBridgeMutationCall(script, res, 'deleteLayer()', 'Failed to delete layer');
    });
}

function handleDeleteComp(req, res) {
    readJsonBody(req, res, ({ compId, compName }) => {
        const hasCompId = compId !== undefined;
        const hasCompName = compName !== undefined && compName !== null && compName !== '';
        if ((hasCompId && hasCompName) || (!hasCompId && !hasCompName)) {
            sendBadRequest(res, 'Provide exactly one of compId or compName');
            log('deleteComp failed: invalid selector');
            return;
        }
        if (hasCompId && typeof compId !== 'number') {
            sendBadRequest(res, 'compId must be a number');
            log('deleteComp failed: compId must be number');
            return;
        }
        if (hasCompName && typeof compName !== 'string') {
            sendBadRequest(res, 'compName must be a string');
            log('deleteComp failed: compName must be string');
            return;
        }

        const compIdLiteral = hasCompId ? String(compId) : 'null';
        const compNameLiteral = hasCompName ? toExtendScriptStringLiteral(compName) : 'null';
        const script = `deleteComp(${compIdLiteral}, ${compNameLiteral})`;
        handleBridgeMutationCall(script, res, 'deleteComp()', 'Failed to delete comp');
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
    if (pathname === '/shape-repeater' && method === 'POST') {
        handleAddShapeRepeater(req, res);
        return;
    }
    if (pathname === '/layer-in-out' && method === 'POST') {
        handleSetInOutPoint(req, res);
        return;
    }
    if (pathname === '/layer-time' && method === 'POST') {
        handleMoveLayerTime(req, res);
        return;
    }
    if (pathname === '/cti' && method === 'POST') {
        handleSetCti(req, res);
        return;
    }
    if (pathname === '/work-area' && method === 'POST') {
        handleSetWorkArea(req, res);
        return;
    }
    if (pathname === '/layer-parent' && method === 'POST') {
        handleParentLayer(req, res);
        return;
    }
    if (pathname === '/precompose' && method === 'POST') {
        handlePrecompose(req, res);
        return;
    }
    if (pathname === '/duplicate-layer' && method === 'POST') {
        handleDuplicateLayer(req, res);
        return;
    }
    if (pathname === '/layer-order' && method === 'POST') {
        handleMoveLayerOrder(req, res);
        return;
    }
    if (pathname === '/delete-layer' && method === 'POST') {
        handleDeleteLayer(req, res);
        return;
    }
    if (pathname === '/delete-comp' && method === 'POST') {
        handleDeleteComp(req, res);
        return;
    }

    handleNotFound(req, res);
}
