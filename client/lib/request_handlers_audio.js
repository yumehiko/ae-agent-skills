function audioSelectorFromSearchParams(searchParams) {
    const layerIdRaw = searchParams.get('layerId');
    const layerNameRaw = searchParams.get('layerName');
    const layerId = layerIdRaw === null || layerIdRaw === '' ? undefined : Number(layerIdRaw);
    const layerName = layerNameRaw === null ? undefined : layerNameRaw;
    return normalizeLayerSelector(layerId, layerName);
}

function validateAudioRequest(audio) {
    const hasSetting = audio.muted !== undefined
        || audio.levelDb !== undefined
        || audio.fadeIn !== undefined
        || audio.fadeOut !== undefined;
    if (!hasSetting) {
        return 'Provide at least one of muted, levelDb, fadeIn, or fadeOut';
    }
    if (audio.muted !== undefined && typeof audio.muted !== 'boolean') {
        return 'muted must be a boolean when specified';
    }
    if (audio.levelDb !== undefined
        && (typeof audio.levelDb !== 'number' || !isFinite(audio.levelDb))) {
        return 'levelDb must be a finite number when specified';
    }
    if (audio.levelDb !== undefined && (audio.levelDb < -192 || audio.levelDb > 24)) {
        return 'levelDb must be between -192 and 24';
    }
    if (audio.fadeIn !== undefined
        && (typeof audio.fadeIn !== 'number' || !isFinite(audio.fadeIn) || audio.fadeIn < 0)) {
        return 'fadeIn must be a finite number greater than or equal to 0';
    }
    if (audio.fadeOut !== undefined
        && (typeof audio.fadeOut !== 'number' || !isFinite(audio.fadeOut) || audio.fadeOut < 0)) {
        return 'fadeOut must be a finite number greater than or equal to 0';
    }
    return null;
}

function handleGetLayerAudio(searchParams, res) {
    const selector = audioSelectorFromSearchParams(searchParams);
    if (!selector.ok) {
        sendBadRequest(res, selector.error);
        return;
    }
    const script = `getLayerAudio(${selector.layerIdLiteral}, ${selector.layerNameLiteral})`;
    handleBridgeMutationCall(script, res, 'getLayerAudio()', 'Failed to get layer audio');
}

function handleSetLayerAudio(req, res) {
    readJsonBody(req, res, ({ layerId, layerName, muted, levelDb, fadeIn, fadeOut, compId, compName }) => {
        const selector = normalizeLayerSelector(layerId, layerName);
        if (!selector.ok) {
            sendBadRequest(res, selector.error);
            return;
        }
        const audio = {};
        if (muted !== undefined) audio.muted = muted;
        if (levelDb !== undefined) audio.levelDb = levelDb;
        if (fadeIn !== undefined) audio.fadeIn = fadeIn;
        if (fadeOut !== undefined) audio.fadeOut = fadeOut;
        const validationError = validateAudioRequest(audio);
        if (validationError) {
            sendBadRequest(res, validationError);
            return;
        }
        const audioLiteral = toExtendScriptStringLiteral(JSON.stringify(audio));
        const script = `setLayerAudio(${selector.layerIdLiteral}, ${selector.layerNameLiteral}, ${audioLiteral})`;
        handleBridgeMutationCall(script, res, 'setLayerAudio()', 'Failed to set layer audio', compId, compName);
    });
}

function routeAudioRequest(pathname, method, req, res, searchParams) {
    if (pathname === '/layer-audio' && method === 'GET') {
        handleGetLayerAudio(searchParams, res);
        return true;
    }
    if (pathname === '/layer-audio' && method === 'POST') {
        handleSetLayerAudio(req, res);
        return true;
    }
    return false;
}
