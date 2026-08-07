function handleGetFootage(res) {
    handleBridgeDataCall('listFootageItems()', res, 'listFootageItems()');
}

function handleImportFootage(req, res) {
    readJsonBody(req, res, ({ path, name }) => {
        if (!path || typeof path !== 'string') {
            sendBadRequest(res, 'path is required and must be a string');
            return;
        }
        if (name !== undefined && typeof name !== 'string') {
            sendBadRequest(res, 'name must be a string when specified');
            return;
        }
        const script = `importFootage(${toExtendScriptStringLiteral(path)}, ${name === undefined ? 'null' : toExtendScriptStringLiteral(name)})`;
        handleBridgeMutationCall(script, res, 'importFootage()', 'Failed to import footage');
    });
}

function handleAddFootageLayer(req, res) {
    readJsonBody(req, res, ({ footageId, footageName, path, name, sourceIn, sourceOut, timelineIn }) => {
        const selectorCount = [footageId, footageName, path]
            .filter((value) => value !== undefined && value !== null && value !== '').length;
        if (selectorCount !== 1) {
            sendBadRequest(res, 'Provide exactly one of footageId, footageName, or path');
            return;
        }
        if (footageId !== undefined && (!Number.isInteger(footageId) || footageId <= 0)) {
            sendBadRequest(res, 'footageId must be a positive integer when specified');
            return;
        }
        if (footageName !== undefined && typeof footageName !== 'string') {
            sendBadRequest(res, 'footageName must be a string when specified');
            return;
        }
        if (path !== undefined && typeof path !== 'string') {
            sendBadRequest(res, 'path must be a string when specified');
            return;
        }
        if (name !== undefined && typeof name !== 'string') {
            sendBadRequest(res, 'name must be a string when specified');
            return;
        }
        if ((sourceIn === undefined) !== (sourceOut === undefined)) {
            sendBadRequest(res, 'sourceIn and sourceOut must be provided together');
            return;
        }
        for (const [label, value] of [['sourceIn', sourceIn], ['sourceOut', sourceOut], ['timelineIn', timelineIn]]) {
            if (value !== undefined && (typeof value !== 'number' || !isFinite(value))) {
                sendBadRequest(res, `${label} must be a finite number when specified`);
                return;
            }
        }
        if (sourceIn !== undefined && sourceIn < 0) {
            sendBadRequest(res, 'sourceIn must be greater than or equal to 0');
            return;
        }
        if (sourceOut !== undefined && sourceOut <= sourceIn) {
            sendBadRequest(res, 'sourceOut must be greater than sourceIn');
            return;
        }
        if (timelineIn !== undefined && timelineIn < 0) {
            sendBadRequest(res, 'timelineIn must be greater than or equal to 0');
            return;
        }

        const literal = (value) => value === undefined || value === null
            ? 'null'
            : toExtendScriptStringLiteral(value);
        const numberLiteral = (value) => value === undefined || value === null ? 'null' : String(value);
        const script = `addFootageLayer(${numberLiteral(footageId)}, ${literal(footageName)}, ${literal(path)}, ${literal(name)}, ${numberLiteral(sourceIn)}, ${numberLiteral(sourceOut)}, ${numberLiteral(timelineIn)})`;
        handleBridgeMutationCall(script, res, 'addFootageLayer()', 'Failed to add footage layer');
    });
}

function handleSetFootageCut(req, res) {
    readJsonBody(req, res, ({ layerId, layerName, sourceIn, sourceOut, timelineIn }) => {
        const selector = normalizeLayerSelector(layerId, layerName);
        if (!selector.ok) {
            sendBadRequest(res, selector.error);
            return;
        }
        if (typeof sourceIn !== 'number' || !isFinite(sourceIn) || sourceIn < 0) {
            sendBadRequest(res, 'sourceIn is required and must be a finite number greater than or equal to 0');
            return;
        }
        if (typeof sourceOut !== 'number' || !isFinite(sourceOut) || sourceOut <= sourceIn) {
            sendBadRequest(res, 'sourceOut is required and must be greater than sourceIn');
            return;
        }
        if (typeof timelineIn !== 'number' || !isFinite(timelineIn) || timelineIn < 0) {
            sendBadRequest(res, 'timelineIn is required and must be a finite number greater than or equal to 0');
            return;
        }
        const script = `setFootageLayerCut(${selector.layerIdLiteral}, ${selector.layerNameLiteral}, ${sourceIn}, ${sourceOut}, ${timelineIn})`;
        handleBridgeMutationCall(script, res, 'setFootageLayerCut()', 'Failed to set footage cut');
    });
}

function routeFootageRequest(pathname, method, req, res) {
    if (pathname === '/footage' && method === 'GET') {
        handleGetFootage(res);
        return true;
    }
    if (pathname === '/footage' && method === 'POST') {
        handleImportFootage(req, res);
        return true;
    }
    if (pathname === '/footage-layer' && method === 'POST') {
        handleAddFootageLayer(req, res);
        return true;
    }
    if (pathname === '/footage-cut' && method === 'POST') {
        handleSetFootageCut(req, res);
        return true;
    }
    return false;
}
