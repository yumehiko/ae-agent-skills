function handleApplyScene(req, res) {
    readJsonBody(req, res, ({ scene, validateOnly, mode, expectProject }) => {
        if (!scene || typeof scene !== 'object' || Array.isArray(scene)) {
            sendBadRequest(res, 'scene is required and must be an object');
            log('applyScene failed: invalid scene');
            return;
        }
        if (validateOnly !== undefined && typeof validateOnly !== 'boolean') {
            sendBadRequest(res, 'validateOnly must be a boolean when specified');
            log('applyScene failed: invalid validateOnly');
            return;
        }
        const normalizedMode = mode === undefined ? 'merge' : String(mode);
        if (!['merge', 'replace-managed', 'clear-all'].includes(normalizedMode)) {
            sendBadRequest(res, 'mode must be one of: merge, replace-managed, clear-all');
            log('applyScene failed: invalid mode');
            return;
        }
        if (expectProject !== undefined
            && (typeof expectProject !== 'string' || expectProject.trim().length === 0)) {
            sendBadRequest(res, 'expectProject must be a non-empty absolute path when specified');
            log('applyScene failed: invalid expectProject');
            return;
        }

        const sceneLiteral = toExtendScriptStringLiteral(JSON.stringify(scene));
        const optionsLiteral = toExtendScriptStringLiteral(
            JSON.stringify({
                validateOnly: validateOnly === true,
                mode: normalizedMode,
                expectProject: expectProject === undefined ? null : expectProject.trim(),
            }),
        );
        const script = `applyScene(${sceneLiteral}, ${optionsLiteral})`;
        handleBridgeMutationCall(script, res, 'applyScene()', 'Failed to apply scene');
    });
}

function routeSceneRequest(pathname, method, req, res) {
    if (pathname === '/scene' && method === 'POST') {
        handleApplyScene(req, res);
        return true;
    }
    return false;
}
