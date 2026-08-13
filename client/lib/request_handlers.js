function applyCommonResponseHeaders(res) {
    res.setHeader('Content-Type', 'application/json');
}

function handleBridgeDataCall(script, res, contextLabel) {
    log(`Calling ExtendScript: ${contextLabel}`);
    evalHostScript(script, (result) => {
        try {
            const parsedResult = parseBridgeResult(result);
            if (parsedResult
                && typeof parsedResult.status === 'string'
                && parsedResult.status.toLowerCase() === 'error') {
                sendJson(res, 400, {
                    status: 'error',
                    message: parsedResult.message || `${contextLabel} failed`,
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

function normalizeOptionalCompBodySelector(compId, compName) {
    const hasCompId = compId !== undefined && compId !== null;
    const hasCompName = compName !== undefined && compName !== null && compName !== '';
    if (hasCompId && hasCompName) {
        return { ok: false, error: 'Provide at most one of compId or compName' };
    }
    if (hasCompId && (
        typeof compId !== 'number' || !Number.isInteger(compId) || compId <= 0
    )) {
        return { ok: false, error: 'compId must be a positive integer' };
    }
    if (hasCompName && (typeof compName !== 'string' || !compName.trim())) {
        return { ok: false, error: 'compName must be a non-empty string' };
    }
    return {
        ok: true,
        hasSelector: hasCompId || hasCompName,
        compIdLiteral: hasCompId ? String(compId) : 'null',
        compNameLiteral: hasCompName
            ? toExtendScriptStringLiteral(compName.trim())
            : 'null',
    };
}

function wrapMutationScriptForComp(script, compId, compName) {
    const selector = normalizeOptionalCompBodySelector(compId, compName);
    selector.script = script;
    if (!selector.ok || !selector.hasSelector) return selector;
    selector.script = `aeRunMutationInComp(${selector.compIdLiteral}, ${selector.compNameLiteral}, function () { return ${script}; })`;
    return selector;
}

function handleBridgeMutationCall(
    script,
    res,
    contextLabel,
    fallbackMessage,
    compId,
    compName,
) {
    const wrapped = wrapMutationScriptForComp(script, compId, compName);
    if (!wrapped.ok) {
        sendBadRequest(res, wrapped.error);
        log(`${contextLabel} failed: ${wrapped.error}`);
        return;
    }
    log(`Calling ExtendScript: ${contextLabel}`);
    evalHostScript(wrapped.script, (result) => {
        try {
            const parsedResult = parseBridgeResult(result);
            if (parsedResult && parsedResult.status === 'error') {
                const payload = {
                    status: 'error',
                    message: parsedResult.message || fallbackMessage,
                };
                if (parsedResult.error !== undefined) payload.error = parsedResult.error;
                if (parsedResult.errors !== undefined) payload.errors = parsedResult.errors;
                if (parsedResult.details !== undefined) payload.details = parsedResult.details;
                if (parsedResult.rollback !== undefined) payload.rollback = parsedResult.rollback;
                if (parsedResult.project !== undefined) payload.project = parsedResult.project;
                if (parsedResult.expectedProject !== undefined) {
                    payload.expectedProject = parsedResult.expectedProject;
                }
                sendJson(res, 500, payload);
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

function normalizeOptionalCompQuerySelector(searchParams) {
    const compIdParam = searchParams.get('compId');
    const compNameParam = searchParams.get('compName');
    const hasCompId = compIdParam !== null && compIdParam !== '';
    const hasCompName = compNameParam !== null && compNameParam.trim() !== '';
    if (hasCompId && hasCompName) {
        return { ok: false, error: 'Provide at most one of compId or compName' };
    }
    if (hasCompId) {
        const compId = Number(compIdParam);
        if (!Number.isInteger(compId) || compId <= 0) {
            return { ok: false, error: 'compId must be a positive integer' };
        }
        return {
            ok: true,
            compId,
            compName: null,
            compIdLiteral: String(compId),
            compNameLiteral: 'null',
        };
    }
    if (hasCompName) {
        const compName = compNameParam.trim();
        return {
            ok: true,
            compId: null,
            compName,
            compIdLiteral: 'null',
            compNameLiteral: toExtendScriptStringLiteral(compName),
        };
    }
    return {
        ok: true,
        compId: null,
        compName: null,
        compIdLiteral: 'null',
        compNameLiteral: 'null',
    };
}

function handleHealth(res) {
    evalHostScript('getProjectState()', (result) => {
        try {
            const project = parseBridgeResult(result);
            if (project
                && typeof project.status === 'string'
                && project.status.toLowerCase() === 'error') {
                sendJson(res, 500, {
                    status: 'error',
                    message: project.message || 'Failed to inspect the current project.',
                });
                log(`Health check failed: ${project.message || 'Unknown error'}`);
                return;
            }
            sendJson(res, 200, { status: 'ok', project });
            log('Health check responded with current project state.');
        } catch (e) {
            sendBridgeParseError(res, result, e);
            log(`Health check failed: ${e.toString()}`);
        }
    });
}

function handlePurge(res) {
    handleBridgeDataCall('purgeAllCaches()', res, 'purgeAllCaches()');
}

function handleGetLayers(searchParams, res) {
    const compSelector = normalizeOptionalCompQuerySelector(searchParams);
    if (!compSelector.ok) {
        sendBadRequest(res, compSelector.error);
        return;
    }
    const script = `getLayers(${compSelector.compIdLiteral}, ${compSelector.compNameLiteral})`;
    handleBridgeDataCall(script, res, 'getLayers()');
}

function handleGetComps(res) {
    handleBridgeDataCall('listComps()', res, 'listComps()');
}

function handleGetSelectedProperties(res) {
    handleBridgeDataCall('getSelectedProperties()', res, 'getSelectedProperties()');
}

function handleGetExpressionErrors(searchParams, res) {
    const compSelector = normalizeOptionalCompQuerySelector(searchParams);
    if (!compSelector.ok) {
        sendBadRequest(res, compSelector.error);
        return;
    }
    const script = `getExpressionErrors(${compSelector.compIdLiteral}, ${compSelector.compNameLiteral})`;
    handleBridgeDataCall(script, res, 'getExpressionErrors()');
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
    const propertyPathParam = searchParams.get('propertyPath');
    const maxDepthParam = searchParams.get('maxDepth');
    const includeGroupChildrenParam = searchParams.get('includeGroupChildren');
    const includeKeyframesParam = searchParams.get('includeKeyframes');
    const includeExpressionParam = searchParams.get('includeExpression');
    const includeDisabledParam = searchParams.get('includeDisabled');
    const timeParam = searchParams.get('time');
    const compSelector = normalizeOptionalCompQuerySelector(searchParams);
    if (!compSelector.ok) {
        sendBadRequest(res, compSelector.error);
        log('getProperties failed: invalid comp selector');
        return;
    }

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
    let includeKeyframes;
    if (includeKeyframesParam !== null) {
        if (!['true', 'false'].includes(includeKeyframesParam)) {
            sendBadRequest(res, 'includeKeyframes must be true or false');
            log('getProperties failed: invalid includeKeyframes');
            return;
        }
        includeKeyframes = includeKeyframesParam === 'true';
    }
    let includeExpression;
    if (includeExpressionParam !== null) {
        if (!['true', 'false'].includes(includeExpressionParam)) {
            sendBadRequest(res, 'includeExpression must be true or false');
            log('getProperties failed: invalid includeExpression');
            return;
        }
        includeExpression = includeExpressionParam === 'true';
    }
    let includeDisabled;
    if (includeDisabledParam !== null) {
        if (!['true', 'false'].includes(includeDisabledParam)) {
            sendBadRequest(res, 'includeDisabled must be true or false');
            log('getProperties failed: invalid includeDisabled');
            return;
        }
        includeDisabled = includeDisabledParam === 'true';
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
    if (propertyPathParam !== null && propertyPathParam.trim().length > 0) {
        options.propertyPath = propertyPathParam.trim();
    }
    if (maxDepth !== undefined) options.maxDepth = maxDepth;
    if (includeGroupChildren !== undefined) options.includeGroupChildren = includeGroupChildren;
    if (includeKeyframes !== undefined) options.includeKeyframes = includeKeyframes;
    if (includeExpression !== undefined) options.includeExpression = includeExpression;
    if (includeDisabled !== undefined) options.includeDisabled = includeDisabled;
    if (time !== undefined) options.time = time;
    if (compSelector.compId !== null) options.compId = compSelector.compId;
    if (compSelector.compName !== null) options.compName = compSelector.compName;

    const optionsLiteral = Object.keys(options).length > 0
        ? toExtendScriptStringLiteral(JSON.stringify(options))
        : 'null';
    const optionsLabel = optionsLiteral === 'null' ? 'null' : 'custom';
    const layerIdLiteral = layerId === null ? 'null' : String(layerId);
    const script = `getProperties(${layerIdLiteral}, ${optionsLiteral})`;

    handleBridgeDataCall(script, res, `getProperties(${layerIdLiteral}, options=${optionsLabel})`);
}

function handleGetLayerBounds(searchParams, res) {
    const layerIdParam = searchParams.get('layerId');
    const layerNameParam = searchParams.get('layerName');
    const hasLayerId = layerIdParam !== null && layerIdParam !== '';
    const hasLayerName = layerNameParam !== null && layerNameParam.trim() !== '';
    if ((hasLayerId && hasLayerName) || (!hasLayerId && !hasLayerName)) {
        sendBadRequest(res, 'Provide exactly one of layerId or layerName');
        return;
    }
    let layerId = null;
    if (hasLayerId) {
        layerId = Number(layerIdParam);
        if (!Number.isInteger(layerId) || layerId <= 0) {
            sendBadRequest(res, 'layerId must be a positive integer');
            return;
        }
    }
    const compSelector = normalizeOptionalCompQuerySelector(searchParams);
    if (!compSelector.ok) {
        sendBadRequest(res, compSelector.error);
        return;
    }
    const timeParam = searchParams.get('time');
    let time = 0.0;
    if (timeParam !== null) {
        time = Number(timeParam);
        if (!isFinite(time)) {
            sendBadRequest(res, 'time must be a finite number');
            return;
        }
    }
    const options = { time };
    if (hasLayerName) options.layerName = layerNameParam.trim();
    if (compSelector.compId !== null) options.compId = compSelector.compId;
    if (compSelector.compName !== null) options.compName = compSelector.compName;
    const optionsLiteral = toExtendScriptStringLiteral(JSON.stringify(options));
    const layerIdLiteral = layerId === null ? 'null' : String(layerId);
    const script = `getLayerBounds(${layerIdLiteral}, ${optionsLiteral})`;
    handleBridgeDataCall(script, res, 'getLayerBounds()');
}

function handleSetExpression(req, res) {
    readJsonBody(req, res, ({ layerId, layerName, propertyPath, expression, compId, compName }) => {
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
        const wrapped = wrapMutationScriptForComp(script, compId, compName);
        if (!wrapped.ok) {
            sendBadRequest(res, wrapped.error);
            return;
        }

        log('Calling ExtendScript: setExpression()');
        evalHostScript(wrapped.script, (result) => {
            if (result === 'success') {
                sendJson(res, 200, { status: 'success', message: 'Expression set successfully' });
                log('setExpression successful.');
                return;
            }
            let message = result;
            try {
                const parsedResult = parseBridgeResult(result);
                if (parsedResult && parsedResult.message) message = parsedResult.message;
            } catch (_parseError) {}
            sendJson(res, 500, { status: 'error', message });
            log(`setExpression failed: ${message}`);
        });
    });
}

function handleSetPropertyValue(req, res) {
    readJsonBody(req, res, ({ layerId, layerName, propertyPath, value, compId, compName }) => {
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
        handleBridgeMutationCall(script, res, 'setPropertyValue()', 'Failed to set property value', compId, compName);
    });
}

function handleSetKeyframe(req, res) {
    readJsonBody(req, res, ({ layerId, layerName, propertyPath, time, value, inInterp, outInterp, easeIn, easeOut, compId, compName }) => {
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
        handleBridgeMutationCall(script, res, 'setKeyframe()', 'Failed to set keyframe', compId, compName);
    });
}

function handleAddEffect(req, res) {
    readJsonBody(req, res, ({ layerId, layerName, effectMatchName, effectName, compId, compName }) => {
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

        handleBridgeMutationCall(script, res, 'addEffect()', 'Failed to add effect', compId, compName);
    });
}

function handleNotFound(req, res) {
    sendJson(res, 404, { status: 'error', message: 'Not Found' });
    log(`404 Not Found: ${req.method} ${req.url}`);
}

function routeRequest(req, res, bridgeToken) {
    log(`Request received: ${req.method} ${req.url}`);

    applyCommonResponseHeaders(res);
    if (!authorizeBridgeRequest(req, res, bridgeToken)) return;

    const [pathname, queryString = ''] = req.url.split('?');
    const method = (req.method || 'GET').toUpperCase();
    const searchParams = new URLSearchParams(queryString);

    if (pathname === '/health' && method === 'GET') {
        handleHealth(res);
        return;
    }
    if (pathname === '/purge' && method === 'POST') {
        handlePurge(res);
        return;
    }
    if (pathname === '/layers' && method === 'GET') {
        handleGetLayers(searchParams, res);
        return;
    }
    if (pathname === '/comps' && method === 'GET') {
        handleGetComps(res);
        return;
    }
    if (typeof routeCompRequest === 'function' && routeCompRequest(pathname, method, req, res)) {
        return;
    }
    if (typeof routeSnapshotRequest === 'function'
        && routeSnapshotRequest(pathname, method, req, res)) {
        return;
    }
    if (typeof routeFootageRequest === 'function' && routeFootageRequest(pathname, method, req, res)) {
        return;
    }
    if (typeof routeAudioRequest === 'function'
        && routeAudioRequest(pathname, method, req, res, searchParams)) {
        return;
    }
    if (typeof routeTextRequest === 'function'
        && routeTextRequest(pathname, method, req, res, searchParams)) {
        return;
    }
    if (typeof routeLayoutRequest === 'function'
        && routeLayoutRequest(pathname, method, req, res)) {
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
    if (pathname === '/layer-bounds' && method === 'GET') {
        handleGetLayerBounds(searchParams, res);
        return;
    }
    if (pathname === '/selected-properties' && method === 'GET') {
        handleGetSelectedProperties(res);
        return;
    }
    if (pathname === '/expression-errors' && method === 'GET') {
        handleGetExpressionErrors(searchParams, res);
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
