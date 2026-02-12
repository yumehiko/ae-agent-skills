function handleSetInOutPoint(req, res) {
    readJsonBody(req, res, ({ layerId, layerName, inPoint, outPoint }) => {
        if (inPoint === undefined && outPoint === undefined) {
            sendBadRequest(res, 'At least one of inPoint/outPoint is required');
            log('setInOutPoint failed: missing parameters');
            return;
        }
        const selector = normalizeLayerSelector(layerId, layerName);
        if (!selector.ok) {
            sendBadRequest(res, selector.error);
            log(`setInOutPoint failed: ${selector.error}`);
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
        const script = `setInOutPoint(${selector.layerIdLiteral}, ${selector.layerNameLiteral}, ${inPointLiteral}, ${outPointLiteral})`;
        handleBridgeMutationCall(script, res, 'setInOutPoint()', 'Failed to set in/out point');
    });
}

function handleMoveLayerTime(req, res) {
    readJsonBody(req, res, ({ layerId, layerName, delta }) => {
        if (delta === undefined) {
            sendBadRequest(res, 'delta is required');
            log('moveLayerTime failed: missing parameters');
            return;
        }
        const selector = normalizeLayerSelector(layerId, layerName);
        if (!selector.ok) {
            sendBadRequest(res, selector.error);
            log(`moveLayerTime failed: ${selector.error}`);
            return;
        }
        if (typeof delta !== 'number' || !isFinite(delta)) {
            sendBadRequest(res, 'delta must be a finite number');
            log('moveLayerTime failed: invalid delta');
            return;
        }

        const script = `moveLayerTime(${selector.layerIdLiteral}, ${selector.layerNameLiteral}, ${delta})`;
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

function routeTimelineRequest(pathname, method, req, res) {
    if (pathname === '/layer-in-out' && method === 'POST') {
        handleSetInOutPoint(req, res);
        return true;
    }
    if (pathname === '/layer-time' && method === 'POST') {
        handleMoveLayerTime(req, res);
        return true;
    }
    if (pathname === '/cti' && method === 'POST') {
        handleSetCti(req, res);
        return true;
    }
    if (pathname === '/work-area' && method === 'POST') {
        handleSetWorkArea(req, res);
        return true;
    }
    return false;
}
