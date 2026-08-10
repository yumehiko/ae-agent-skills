function snapshotCleanupFile(filePath) {
    if (!filePath || !fs) return;
    try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (e) {
        log(`Snapshot cleanup failed for ${filePath}: ${e.toString()}`);
    }
}

function snapshotCreateTempPath(outputPath) {
    const directory = path.dirname(outputPath);
    const baseName = path.basename(outputPath, path.extname(outputPath));
    const suffix = crypto.randomBytes(16).toString('hex');
    return path.join(directory, `.${baseName}.${suffix}.part.png`);
}

function snapshotHasCompletePng(filePath) {
    const pngEnd = Buffer.from([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);
    let descriptor = null;
    try {
        const stat = fs.statSync(filePath);
        if (!stat.isFile() || stat.size < pngEnd.length) return false;
        descriptor = fs.openSync(filePath, 'r');
        const tail = Buffer.alloc(pngEnd.length);
        fs.readSync(descriptor, tail, 0, tail.length, stat.size - tail.length);
        return tail.equals(pngEnd);
    } catch (e) {
        return false;
    } finally {
        if (descriptor !== null) {
            try {
                fs.closeSync(descriptor);
            } catch (eClose) {}
        }
    }
}

function snapshotWaitForCompletePng(filePath, callback) {
    const deadline = Date.now() + 120000;
    function poll() {
        if (snapshotHasCompletePng(filePath)) {
            callback(null);
            return;
        }
        if (Date.now() >= deadline) {
            callback(new Error('Timed out waiting for After Effects to finish the snapshot PNG.'));
            return;
        }
        setTimeout(poll, 50);
    }
    poll();
}

function snapshotCleanupTemporaryComp(temporaryCompId, callback) {
    if (temporaryCompId === null || temporaryCompId === undefined) {
        callback(null);
        return;
    }
    const script = `cleanupCompSnapshot(${Number(temporaryCompId)})`;
    evalHostScript(script, (result) => {
        try {
            const parsedResult = parseBridgeResult(result);
            if (parsedResult
                && typeof parsedResult.status === 'string'
                && parsedResult.status.toLowerCase() === 'error') {
                callback(new Error(parsedResult.message || 'Failed to remove snapshot composition.'));
                return;
            }
            callback(null);
        } catch (e) {
            callback(e);
        }
    });
}

function snapshotValidatePayload(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return { ok: false, error: 'Snapshot payload must be a JSON object' };
    }
    const hasCompId = payload.compId !== undefined && payload.compId !== null;
    const hasCompName = typeof payload.compName === 'string' && payload.compName.trim() !== '';
    if (hasCompId === hasCompName) {
        return { ok: false, error: 'Provide exactly one of compId or compName' };
    }
    if (hasCompId && (!Number.isInteger(payload.compId) || payload.compId <= 0)) {
        return { ok: false, error: 'compId must be a positive integer' };
    }
    const time = payload.time === undefined ? 0 : Number(payload.time);
    if (!isFinite(time)) {
        return { ok: false, error: 'time must be a finite number' };
    }
    const scale = payload.scale === undefined ? 1 : Number(payload.scale);
    if (!isFinite(scale) || scale <= 0 || scale > 1) {
        return { ok: false, error: 'scale must be greater than 0 and at most 1' };
    }
    if (typeof payload.outPath !== 'string' || payload.outPath.trim() === '') {
        return { ok: false, error: 'outPath is required' };
    }
    const outPath = payload.outPath.trim();
    if (!path.isAbsolute(outPath)) {
        return { ok: false, error: 'outPath must be absolute' };
    }
    if (path.extname(outPath).toLowerCase() !== '.png') {
        return { ok: false, error: 'outPath must end with .png' };
    }
    const outputDirectory = path.dirname(outPath);
    try {
        if (!fs.statSync(outputDirectory).isDirectory()) {
            return { ok: false, error: 'Snapshot output directory is not a directory' };
        }
        if (fs.existsSync(outPath)) {
            return { ok: false, error: 'Snapshot output already exists' };
        }
    } catch (e) {
        return { ok: false, error: `Snapshot output directory is not accessible: ${e.toString()}` };
    }
    return {
        ok: true,
        compId: hasCompId ? payload.compId : null,
        compName: hasCompName ? payload.compName.trim() : null,
        time,
        scale,
        outPath,
    };
}

function handleCreateSnapshot(req, res) {
    readJsonBody(req, res, (payload) => {
        const validated = snapshotValidatePayload(payload);
        if (!validated.ok) {
            sendBadRequest(res, validated.error);
            return;
        }
        const tempPath = snapshotCreateTempPath(validated.outPath);
        const compIdLiteral = validated.compId === null ? 'null' : String(validated.compId);
        const compNameLiteral = validated.compName === null
            ? 'null'
            : toExtendScriptStringLiteral(validated.compName);
        const script = `saveCompSnapshot(${compIdLiteral}, ${compNameLiteral}, ${validated.time}, ${toExtendScriptStringLiteral(tempPath)}, ${validated.scale})`;

        log(`Calling ExtendScript: saveCompSnapshot(${compIdLiteral}, compName, ${validated.time}, tempPath, ${validated.scale})`);
        evalHostScript(script, (result) => {
            try {
                const parsedResult = parseBridgeResult(result);
                if (parsedResult
                    && typeof parsedResult.status === 'string'
                    && parsedResult.status.toLowerCase() === 'error') {
                    snapshotCleanupFile(tempPath);
                    sendJson(res, 400, {
                        status: 'error',
                        message: parsedResult.message || 'Snapshot failed',
                    });
                    return;
                }
                snapshotWaitForCompletePng(tempPath, (waitError) => {
                    snapshotCleanupTemporaryComp(parsedResult.temporaryCompId, (cleanupError) => {
                        const completionError = waitError || cleanupError;
                        if (completionError) {
                            snapshotCleanupFile(tempPath);
                            sendJson(res, 500, {
                                status: 'error',
                                message: completionError.toString(),
                            });
                            log(`Snapshot failed: ${completionError.toString()}`);
                            return;
                        }
                        try {
                            if (fs.existsSync(validated.outPath)) {
                                throw new Error(
                                    'Snapshot output appeared while rendering; refusing to overwrite it.'
                                );
                            }
                            fs.renameSync(tempPath, validated.outPath);
                            const data = Object.assign({}, parsedResult, {
                                outPath: validated.outPath,
                            });
                            delete data.tempPath;
                            delete data.temporaryCompId;
                            sendJson(res, 200, { status: 'success', data });
                            log(`Snapshot created: ${validated.outPath}`);
                        } catch (eFinalize) {
                            snapshotCleanupFile(tempPath);
                            sendJson(res, 500, {
                                status: 'error',
                                message: eFinalize.toString(),
                            });
                            log(`Snapshot failed: ${eFinalize.toString()}`);
                        }
                    });
                });
            } catch (e) {
                snapshotCleanupFile(tempPath);
                if (fs.existsSync(validated.outPath)) {
                    try {
                        const outputStat = fs.statSync(validated.outPath);
                        if (outputStat.size <= 0) snapshotCleanupFile(validated.outPath);
                    } catch (eOutputStat) {}
                }
                sendJson(res, 500, { status: 'error', message: e.toString() });
                log(`Snapshot failed: ${e.toString()}`);
            }
        });
    });
}

function routeSnapshotRequest(pathname, method, req, res) {
    if (pathname === '/snapshot' && method === 'POST') {
        handleCreateSnapshot(req, res);
        return true;
    }
    return false;
}
