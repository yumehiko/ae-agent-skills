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

const csInterface = new CSInterface();
const extensionRoot = csInterface.getSystemPath(SystemPath.EXTENSION);
const hostScriptPath = nodeReady
    ? escapeForExtendScript(path.join(extensionRoot, 'host', 'index.jsx'))
    : null;

function escapeForExtendScript(str) {
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function toExtendScriptStringLiteral(str) {
    return JSON.stringify(str);
}

function evalHostScript(scriptSource, callback) {
    if (!hostScriptPath) {
        callback('{"status":"error","message":"Host script unavailable because CEP Node.js is disabled."}');
        return;
    }
    const fullScript = `$.evalFile("${hostScriptPath}");${scriptSource}`;
    csInterface.evalScript(fullScript, callback);
}
