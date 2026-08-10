function handleAddCompLayer(req, res) {
    readJsonBody(req, res, ({ compId, compName, name, startTime, inPoint, outPoint }) => {
        const hasCompId = compId !== undefined && compId !== null;
        const hasCompName = typeof compName === 'string' && compName.trim().length > 0;
        if (hasCompId === hasCompName) {
            sendBadRequest(res, 'Provide exactly one of compId or compName');
            return;
        }
        if (hasCompId && (!Number.isInteger(compId) || compId <= 0)) {
            sendBadRequest(res, 'compId must be a positive integer when specified');
            return;
        }
        if (compName !== undefined && !hasCompName) {
            sendBadRequest(res, 'compName must be a non-empty string when specified');
            return;
        }
        if (name !== undefined && typeof name !== 'string') {
            sendBadRequest(res, 'name must be a string when specified');
            return;
        }
        for (const [label, value] of [
            ['startTime', startTime],
            ['inPoint', inPoint],
            ['outPoint', outPoint],
        ]) {
            if (value !== undefined && (typeof value !== 'number' || !isFinite(value))) {
                sendBadRequest(res, `${label} must be a finite number when specified`);
                return;
            }
        }
        if (inPoint !== undefined && outPoint !== undefined && outPoint <= inPoint) {
            sendBadRequest(res, 'outPoint must be greater than inPoint');
            return;
        }

        const stringLiteral = (value) => value === undefined || value === null
            ? 'null'
            : toExtendScriptStringLiteral(value);
        const numberLiteral = (value) => value === undefined || value === null
            ? 'null'
            : String(value);
        const script = `addCompLayer(${numberLiteral(compId)}, ${stringLiteral(hasCompName ? compName.trim() : null)}, ${stringLiteral(name)}, ${numberLiteral(startTime)}, ${numberLiteral(inPoint)}, ${numberLiteral(outPoint)})`;
        handleBridgeMutationCall(script, res, 'addCompLayer()', 'Failed to add composition layer');
    });
}

function routeCompRequest(pathname, method, req, res) {
    if (pathname === '/comp-layer' && method === 'POST') {
        handleAddCompLayer(req, res);
        return true;
    }
    return false;
}
