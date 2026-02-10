const BRIDGE_PORT = 8080;

function startBridgeServer() {
    if (!nodeReady) {
        log('main.js loaded (degraded mode).');
        log('CEP Node.js runtime is not available. The bridge server is disabled.');
        log('Enable PlayerDebugMode and restart After Effects to use this extension.');
        if (nodeInitError) {
            log(`Node bootstrap error: ${nodeInitError.toString()}`);
        }
        return;
    }

    const server = http.createServer((req, res) => {
        routeRequest(req, res);
    });

    server.on('error', (err) => {
        if (err && err.code === 'EADDRINUSE') {
            log(`Failed to start bridge: port ${BRIDGE_PORT} is already in use.`);
            log('Close the process using 127.0.0.1:8080, then reopen the panel.');
            return;
        }
        log(`Failed to start bridge server: ${err ? err.toString() : 'Unknown error'}`);
    });

    server.listen(BRIDGE_PORT, '127.0.0.1', () => {
        log(`Server listening on http://127.0.0.1:${BRIDGE_PORT}`);
        log('HTTPブリッジを起動しました。CLI から利用してください。');
    });

    log('main.js loaded.');
}
