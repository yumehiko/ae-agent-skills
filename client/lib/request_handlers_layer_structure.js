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

function routeLayerStructureRequest(pathname, method, req, res) {
    if (pathname === '/layer-parent' && method === 'POST') {
        handleParentLayer(req, res);
        return true;
    }
    if (pathname === '/precompose' && method === 'POST') {
        handlePrecompose(req, res);
        return true;
    }
    if (pathname === '/duplicate-layer' && method === 'POST') {
        handleDuplicateLayer(req, res);
        return true;
    }
    if (pathname === '/layer-order' && method === 'POST') {
        handleMoveLayerOrder(req, res);
        return true;
    }
    if (pathname === '/delete-layer' && method === 'POST') {
        handleDeleteLayer(req, res);
        return true;
    }
    if (pathname === '/delete-comp' && method === 'POST') {
        handleDeleteComp(req, res);
        return true;
    }
    return false;
}
