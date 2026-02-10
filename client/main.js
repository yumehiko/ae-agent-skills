let http = null;
let path = null;
let nodeReady = true;
let nodeInitError = null;

try {
    http = require('http');
    path = require('path');
} catch (e) {
    nodeReady = false;
    nodeInitError = e;
}

// CEP-Spyを参考に、CSInterface.jsのパスを解決
// https://github.com/Adobe-CEP/CEP-Spy/blob/master/spy/index.html#L32
const csInterface = new CSInterface();
const extensionRoot = csInterface.getSystemPath(SystemPath.EXTENSION);


function escapeForExtendScript(str) {
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function toExtendScriptStringLiteral(str) {
    // Use JSON.stringify so newline/quote characters are escaped consistently.
    return JSON.stringify(str);
}

const hostScriptPath = nodeReady
    ? escapeForExtendScript(path.join(extensionRoot, 'host', 'index.jsx'))
    : null;

function evalHostScript(scriptSource, callback) {
    if (!hostScriptPath) {
        callback('{"status":"error","message":"Host script unavailable because CEP Node.js is disabled."}');
        return;
    }
    const fullScript = `$.evalFile("${hostScriptPath}");${scriptSource}`;
    csInterface.evalScript(fullScript, callback);
}

function appendLog(source, message) {
    const logTextarea = document.getElementById('log');
    const timestamp = new Date().toLocaleTimeString();
    const prefix = source ? `[${source}] ` : '';
    logTextarea.value = `${timestamp} ${prefix}${message}\n` + logTextarea.value;
}

function log(message) {
    appendLog('Panel', message);
}

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

let server = null;
if (nodeReady) {
    server = http.createServer((req, res) => {
        log(`Request received: ${req.method} ${req.url}`);

        // CORS preflight request
        if (req.method === 'OPTIONS') {
            res.writeHead(204, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            });
            res.end();
            return;
        }

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');

        const [pathname, queryString = ''] = req.url.split('?');
        const method = (req.method || 'GET').toUpperCase();
        const searchParams = new URLSearchParams(queryString);

        if (pathname === '/health' && method === 'GET') {
            res.writeHead(200);
            res.end(JSON.stringify({ status: 'ok' }));
            log('Health check responded with ok.');
        } else if (pathname === '/layers' && method === 'GET') {
            handleGetLayers(req, res);
        } else if (pathname === '/layers' && method === 'POST') {
            handleAddLayer(req, res);
        } else if (pathname === '/properties' && method === 'GET') {
            handleGetProperties(searchParams, res);
        } else if (pathname === '/selected-properties' && method === 'GET') {
            handleGetSelectedProperties(res);
        } else if (pathname === '/expression' && method === 'POST') {
            handleSetExpression(req, res);
        } else if (pathname === '/effects' && method === 'POST') {
            handleAddEffect(req, res);
        } else {
            res.writeHead(404);
            res.end(JSON.stringify({ status: 'error', message: 'Not Found' }));
            log(`404 Not Found: ${req.method} ${req.url}`);
        }
    });
}

function handleGetLayers(req, res) {
    log('Calling ExtendScript: getLayers()');
    evalHostScript('getLayers()', (result) => {
        try {
            const parsedResult = parseBridgeResult(result);
            res.writeHead(200);
            res.end(JSON.stringify({ status: 'success', data: parsedResult }));
            log('getLayers() successful.');
        } catch (e) {
            res.writeHead(500);
            res.end(JSON.stringify({ status: 'error', message: 'Failed to parse ExtendScript result.', error: e.toString(), rawResult: result }));
            log(`getLayers() failed: ${e.toString()}`);
        }
    });
}

function handleGetSelectedProperties(res) {
    log('Calling ExtendScript: getSelectedProperties()');
    evalHostScript('getSelectedProperties()', (result) => {
        try {
            const parsedResult = parseBridgeResult(result);
            res.writeHead(200);
            res.end(JSON.stringify({ status: 'success', data: parsedResult }));
            log('getSelectedProperties() successful.');
        } catch (e) {
            res.writeHead(500);
            res.end(JSON.stringify({ status: 'error', message: 'Failed to parse ExtendScript result.', error: e.toString(), rawResult: result }));
            log(`getSelectedProperties() failed: ${e.toString()}`);
        }
    });
}

function handleGetProperties(searchParams, res) {
    const layerId = searchParams.get('layerId');
    if (!layerId) {
        res.writeHead(400);
        res.end(JSON.stringify({ status: 'error', message: 'Missing layerId parameter' }));
        log('getProperties failed: Missing layerId');
        return;
    }

    const includeGroups = searchParams.getAll('includeGroup').filter(Boolean);
    const excludeGroups = searchParams.getAll('excludeGroup').filter(Boolean);
    const maxDepthParam = searchParams.get('maxDepth');
    let maxDepth;
    if (maxDepthParam !== null) {
        const parsedDepth = parseInt(maxDepthParam, 10);
        if (isNaN(parsedDepth) || parsedDepth <= 0) {
            res.writeHead(400);
            res.end(JSON.stringify({ status: 'error', message: 'maxDepth must be a positive integer' }));
            log('getProperties failed: Invalid maxDepth');
            return;
        }
        maxDepth = parsedDepth;
    }

    const options = {};
    if (includeGroups.length > 0) {
        options.includeGroups = includeGroups;
    }
    if (excludeGroups.length > 0) {
        options.excludeGroups = excludeGroups;
    }
    if (maxDepth !== undefined) {
        options.maxDepth = maxDepth;
    }

    const optionsLiteral = Object.keys(options).length > 0
        ? toExtendScriptStringLiteral(JSON.stringify(options))
        : 'null';
    const optionsLabel = optionsLiteral === 'null' ? 'null' : 'custom';

    log(`Calling ExtendScript: getProperties(${layerId}, options=${optionsLabel})`);
    evalHostScript(`getProperties(${layerId}, ${optionsLiteral})`, (result) => {
        try {
            const parsedResult = parseBridgeResult(result);
            res.writeHead(200);
            res.end(JSON.stringify({ status: 'success', data: parsedResult }));
            log(`getProperties(${layerId}) successful.`);
        } catch (e) {
            res.writeHead(500);
            res.end(JSON.stringify({ status: 'error', message: 'Failed to parse ExtendScript result.', error: e.toString(), rawResult: result }));
            log(`getProperties(${layerId}) failed: ${e.toString()}`);
        }
    });
}

function handleSetExpression(req, res) {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });
    req.on('end', () => {
        try {
            const { layerId, propertyPath, expression } = JSON.parse(body);
            if (!layerId || !propertyPath || expression === undefined) {
                res.writeHead(400);
                res.end(JSON.stringify({ status: 'error', message: 'Missing parameters' }));
                log('setExpression failed: Missing parameters');
                return;
            }
            if (typeof expression !== 'string') {
                res.writeHead(400);
                res.end(JSON.stringify({ status: 'error', message: 'Expression must be a string' }));
                log('setExpression failed: Expression must be a string');
                return;
            }

            const escapedPath = escapeForExtendScript(propertyPath);
            const expressionLiteral = toExtendScriptStringLiteral(expression);
            const script = `setExpression(${layerId}, "${escapedPath}", ${expressionLiteral})`;
            log(`Calling ExtendScript: ${script}`);
            evalHostScript(script, (result) => {
                if (result === 'success') {
                    res.writeHead(200);
                    res.end(JSON.stringify({ status: 'success', message: 'Expression set successfully' }));
                    log('setExpression successful.');
                } else {
                    res.writeHead(500);
                    res.end(JSON.stringify({ status: 'error', message: result }));
                    log(`setExpression failed: ${result}`);
                }
            });
        } catch (e) {
            res.writeHead(400);
            res.end(JSON.stringify({ status: 'error', message: 'Invalid JSON', error: e.toString() }));
            log(`setExpression failed: Invalid JSON - ${e.toString()}`);
        }
    });
}

function handleAddEffect(req, res) {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });
    req.on('end', () => {
        try {
            const { layerId, effectMatchName, effectName } = JSON.parse(body);
            if (!layerId || !effectMatchName) {
                res.writeHead(400);
                res.end(JSON.stringify({ status: 'error', message: 'Missing parameters' }));
                log('addEffect failed: Missing parameters');
                return;
            }
            if (effectName !== undefined && typeof effectName !== 'string') {
                res.writeHead(400);
                res.end(JSON.stringify({ status: 'error', message: 'effectName must be a string when specified' }));
                log('addEffect failed: effectName must be a string');
                return;
            }

            const matchNameLiteral = toExtendScriptStringLiteral(effectMatchName);
            const effectNameLiteral = effectName === undefined
                ? 'null'
                : toExtendScriptStringLiteral(effectName);
            const script = `addEffect(${layerId}, ${matchNameLiteral}, ${effectNameLiteral})`;
            log(`Calling ExtendScript: ${script}`);
            evalHostScript(script, (result) => {
                try {
                    const parsedResult = parseBridgeResult(result);
                    if (parsedResult && parsedResult.status === 'error') {
                        res.writeHead(500);
                        res.end(JSON.stringify({ status: 'error', message: parsedResult.message || 'Failed to add effect' }));
                        log(`addEffect failed: ${parsedResult.message || 'Unknown error'}`);
                        return;
                    }

                    res.writeHead(200);
                    res.end(JSON.stringify({ status: 'success', data: parsedResult }));
                    log('addEffect successful.');
                } catch (e) {
                    res.writeHead(500);
                    res.end(JSON.stringify({ status: 'error', message: 'Failed to parse ExtendScript result.', error: e.toString(), rawResult: result }));
                    log(`addEffect failed: ${e.toString()}`);
                }
            });
        } catch (e) {
            res.writeHead(400);
            res.end(JSON.stringify({ status: 'error', message: 'Invalid JSON', error: e.toString() }));
            log(`addEffect failed: Invalid JSON - ${e.toString()}`);
        }
    });
}

function handleAddLayer(req, res) {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });
    req.on('end', () => {
        try {
            const { layerType, name, text, width, height, color, duration } = JSON.parse(body);
            if (!layerType || typeof layerType !== 'string') {
                res.writeHead(400);
                res.end(JSON.stringify({ status: 'error', message: 'layerType is required and must be a string' }));
                log('addLayer failed: invalid layerType');
                return;
            }

            const normalizedType = layerType.toLowerCase();
            if (!['text', 'null', 'solid', 'shape'].includes(normalizedType)) {
                res.writeHead(400);
                res.end(JSON.stringify({ status: 'error', message: 'Unsupported layerType. Use one of: text, null, solid, shape.' }));
                log(`addLayer failed: unsupported layerType "${layerType}"`);
                return;
            }

            if (name !== undefined && typeof name !== 'string') {
                res.writeHead(400);
                res.end(JSON.stringify({ status: 'error', message: 'name must be a string when specified' }));
                log('addLayer failed: name must be string');
                return;
            }
            if (text !== undefined && typeof text !== 'string') {
                res.writeHead(400);
                res.end(JSON.stringify({ status: 'error', message: 'text must be a string when specified' }));
                log('addLayer failed: text must be string');
                return;
            }
            if (width !== undefined && typeof width !== 'number') {
                res.writeHead(400);
                res.end(JSON.stringify({ status: 'error', message: 'width must be a number when specified' }));
                log('addLayer failed: width must be number');
                return;
            }
            if (height !== undefined && typeof height !== 'number') {
                res.writeHead(400);
                res.end(JSON.stringify({ status: 'error', message: 'height must be a number when specified' }));
                log('addLayer failed: height must be number');
                return;
            }
            if (duration !== undefined && typeof duration !== 'number') {
                res.writeHead(400);
                res.end(JSON.stringify({ status: 'error', message: 'duration must be a number when specified' }));
                log('addLayer failed: duration must be number');
                return;
            }
            if (color !== undefined) {
                const validColor = Array.isArray(color)
                    && color.length === 3
                    && color.every((part) => typeof part === 'number');
                if (!validColor) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ status: 'error', message: 'color must be an array of 3 numbers when specified' }));
                    log('addLayer failed: color must be [r, g, b]');
                    return;
                }
            }

            const options = {};
            if (name !== undefined) options.name = name;
            if (text !== undefined) options.text = text;
            if (width !== undefined) options.width = width;
            if (height !== undefined) options.height = height;
            if (color !== undefined) options.color = color;
            if (duration !== undefined) options.duration = duration;

            const layerTypeLiteral = toExtendScriptStringLiteral(normalizedType);
            const optionsLiteral = Object.keys(options).length === 0
                ? 'null'
                : toExtendScriptStringLiteral(JSON.stringify(options));
            const script = `addLayer(${layerTypeLiteral}, ${optionsLiteral})`;
            log(`Calling ExtendScript: ${script}`);
            evalHostScript(script, (result) => {
                try {
                    const parsedResult = parseBridgeResult(result);
                    if (parsedResult && parsedResult.status === 'error') {
                        res.writeHead(500);
                        res.end(JSON.stringify({ status: 'error', message: parsedResult.message || 'Failed to add layer' }));
                        log(`addLayer failed: ${parsedResult.message || 'Unknown error'}`);
                        return;
                    }

                    res.writeHead(200);
                    res.end(JSON.stringify({ status: 'success', data: parsedResult }));
                    log('addLayer successful.');
                } catch (e) {
                    res.writeHead(500);
                    res.end(JSON.stringify({ status: 'error', message: 'Failed to parse ExtendScript result.', error: e.toString(), rawResult: result }));
                    log(`addLayer failed: ${e.toString()}`);
                }
            });
        } catch (e) {
            res.writeHead(400);
            res.end(JSON.stringify({ status: 'error', message: 'Invalid JSON', error: e.toString() }));
            log(`addLayer failed: Invalid JSON - ${e.toString()}`);
        }
    });
}


const port = 8080;
if (!nodeReady) {
    log('main.js loaded (degraded mode).');
    log('CEP Node.js runtime is not available. The bridge server is disabled.');
    log('Enable PlayerDebugMode and restart After Effects to use this extension.');
    if (nodeInitError) {
        log(`Node bootstrap error: ${nodeInitError.toString()}`);
    }
} else {
    server.on('error', (err) => {
        if (err && err.code === 'EADDRINUSE') {
            log(`Failed to start bridge: port ${port} is already in use.`);
            log('Close the process using 127.0.0.1:8080, then reopen the panel.');
            return;
        }
        log(`Failed to start bridge server: ${err ? err.toString() : 'Unknown error'}`);
    });

    server.listen(port, '127.0.0.1', () => {
        log(`Server listening on http://127.0.0.1:${port}`);
        log('HTTPブリッジを起動しました。CLI から利用してください。');
    });

    log('main.js loaded.');
}
