let http = null;
let path = null;
let fs = null;
let nodeReady = true;
let nodeInitError = null;

try {
    http = require('http');
    path = require('path');
    fs = require('fs');
} catch (e) {
    nodeReady = false;
    nodeInitError = e;
}

const csInterface = new CSInterface();
const extensionRoot = csInterface.getSystemPath(SystemPath.EXTENSION);
const hostScriptPath = nodeReady
    ? escapeForExtendScript(path.join(extensionRoot, 'host', 'index.jsx'))
    : null;
const extensionVersion = resolveExtensionVersion();

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

function resolveExtensionVersion() {
    if (!nodeReady || !fs || !path) return null;
    try {
        const manifestPath = path.join(extensionRoot, 'CSXS', 'manifest.xml');
        const manifest = fs.readFileSync(manifestPath, 'utf8');
        const match = manifest.match(/ExtensionBundleVersion="([^"]+)"/);
        return match ? match[1] : null;
    } catch (e) {
        return null;
    }
}

function applyPanelVersionLabel() {
    const versionEl = document.getElementById('panel-version');
    if (!versionEl) return;
    if (extensionVersion) {
        versionEl.textContent = `v${extensionVersion}`;
    }
}

applyPanelVersionLabel();
