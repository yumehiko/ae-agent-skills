const BRIDGE_TOKEN_BYTES = 32;
const BRIDGE_TOKEN_HEADER = 'x-ae-bridge-token';
const BRIDGE_TOKEN_FILENAME = '.bridge-token';

function createBridgeToken() {
    return crypto.randomBytes(BRIDGE_TOKEN_BYTES).toString('hex');
}

function getBridgeTokenFilePath() {
    return path.join(os.homedir(), 'ae-agent-skills', BRIDGE_TOKEN_FILENAME);
}

function writeBridgeTokenFile(token) {
    const tokenFilePath = getBridgeTokenFilePath();
    const tokenDir = path.dirname(tokenFilePath);
    if (!fs.existsSync(tokenDir)) {
        fs.mkdirSync(tokenDir, { recursive: true, mode: 0o700 });
    }

    const tempPath = `${tokenFilePath}.${process.pid}.tmp`;
    fs.writeFileSync(tempPath, `${token}\n`, { encoding: 'utf8', mode: 0o600 });
    fs.chmodSync(tempPath, 0o600);
    fs.renameSync(tempPath, tokenFilePath);
    fs.chmodSync(tokenFilePath, 0o600);
    return tokenFilePath;
}

function isAllowedBridgeHost(host) {
    return host === '127.0.0.1:8080' || host === 'localhost:8080';
}

function tokensMatch(actual, expected) {
    if (typeof actual !== 'string' || typeof expected !== 'string') return false;
    const actualBuffer = Buffer.from(actual, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    if (actualBuffer.length !== expectedBuffer.length) return false;
    return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function authorizeBridgeRequest(req, res, expectedToken) {
    if (req.headers.origin) {
        sendJson(res, 403, {
            status: 'error',
            message: 'Browser-originated requests are not allowed.',
        });
        return false;
    }

    if (!isAllowedBridgeHost(req.headers.host)) {
        sendJson(res, 403, {
            status: 'error',
            message: 'Invalid bridge host.',
        });
        return false;
    }

    const requestToken = req.headers[BRIDGE_TOKEN_HEADER];
    if (!tokensMatch(requestToken, expectedToken)) {
        sendJson(res, 401, {
            status: 'error',
            message: 'Missing or invalid bridge token.',
        });
        return false;
    }

    return true;
}
