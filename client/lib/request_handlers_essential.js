function handleAddEssentialProperty(req, res) {
    readJsonBody(req, res, ({ layerId, layerName, propertyPath, essentialName }) => {
        if (!propertyPath || typeof propertyPath !== 'string') {
            sendBadRequest(res, 'propertyPath is required and must be a string');
            log('addEssentialProperty failed: invalid propertyPath');
            return;
        }
        const selector = normalizeLayerSelector(layerId, layerName);
        if (!selector.ok) {
            sendBadRequest(res, selector.error);
            log(`addEssentialProperty failed: ${selector.error}`);
            return;
        }
        if (essentialName !== undefined && typeof essentialName !== 'string') {
            sendBadRequest(res, 'essentialName must be a string when specified');
            log('addEssentialProperty failed: invalid essentialName');
            return;
        }

        const pathLiteral = toExtendScriptStringLiteral(propertyPath);
        const essentialNameLiteral = essentialName === undefined
            ? 'null'
            : toExtendScriptStringLiteral(essentialName);
        const script = `addEssentialProperty(${selector.layerIdLiteral}, ${selector.layerNameLiteral}, ${pathLiteral}, ${essentialNameLiteral})`;
        handleBridgeMutationCall(script, res, 'addEssentialProperty()', 'Failed to add essential property');
    });
}

function handleGetEssentialProperties(res) {
    handleBridgeDataCall('getEssentialProperties()', res, 'getEssentialProperties()');
}

function routeEssentialRequest(pathname, method, req, res) {
    if (pathname === '/essential-properties' && method === 'GET') {
        handleGetEssentialProperties(res);
        return true;
    }
    if (pathname === '/essential-property' && method === 'POST') {
        handleAddEssentialProperty(req, res);
        return true;
    }
    return false;
}
