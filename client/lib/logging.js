function appendLog(source, message) {
    const logTextarea = document.getElementById('log');
    const timestamp = new Date().toLocaleTimeString();
    const prefix = source ? `[${source}] ` : '';
    logTextarea.value = `${timestamp} ${prefix}${message}\n` + logTextarea.value;
}

function log(message) {
    appendLog('Panel', message);
}
