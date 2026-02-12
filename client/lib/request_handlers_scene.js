function handleApplyScene(req, res) {
    readJsonBody(req, res, ({ scene, validateOnly }) => {
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

        const sceneLiteral = toExtendScriptStringLiteral(JSON.stringify(scene));
        const optionsLiteral = toExtendScriptStringLiteral(
            JSON.stringify({ validateOnly: validateOnly === true }),
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
