const ENCODE_PREFIX = '__ENC__';

function parseBridgeResult(result) {
    if (typeof result !== 'string' || result.length === 0) {
        throw new Error('ExtendScript returned an empty result.');
    }

    let decoded = result;
    if (result.startsWith(ENCODE_PREFIX)) {
        const encodedPayload = result.slice(ENCODE_PREFIX.length);
        try {
            decoded = decodeURIComponent(encodedPayload);
        } catch (e) {
            throw new Error(`Failed to decode ExtendScript payload: ${e.toString()}`);
        }
    }

    return JSON.parse(decoded);
}

function sendJson(res, statusCode, payload) {
    res.writeHead(statusCode);
    res.end(JSON.stringify(payload));
}

function sendBadRequest(res, message, error) {
    const payload = { status: 'error', message };
    if (error) {
        payload.error = error.toString();
    }
    sendJson(res, 400, payload);
}

function sendBridgeParseError(res, result, error) {
    sendJson(res, 500, {
        status: 'error',
        message: 'Failed to parse ExtendScript result.',
        error: error.toString(),
        rawResult: result,
    });
}

function readJsonBody(req, res, onParsed) {
    let body = '';
    req.on('data', (chunk) => {
        body += chunk.toString();
    });
    req.on('end', () => {
        try {
            const parsed = JSON.parse(body);
            onParsed(parsed);
        } catch (e) {
            sendBadRequest(res, 'Invalid JSON', e);
        }
    });
}
