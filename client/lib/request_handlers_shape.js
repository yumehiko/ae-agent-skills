function handleAddShapeRepeater(req, res) {
    readJsonBody(
        req,
        res,
        ({ layerId, groupIndex, name, copies, offset, position, scale, rotation, startOpacity, endOpacity }) => {
            if (!layerId || typeof layerId !== 'number') {
                sendBadRequest(res, 'layerId is required and must be a number');
                log('addShapeRepeater failed: invalid layerId');
                return;
            }
            if (groupIndex !== undefined && (!Number.isInteger(groupIndex) || groupIndex <= 0)) {
                sendBadRequest(res, 'groupIndex must be a positive integer when specified');
                log('addShapeRepeater failed: invalid groupIndex');
                return;
            }
            if (name !== undefined && typeof name !== 'string') {
                sendBadRequest(res, 'name must be a string when specified');
                log('addShapeRepeater failed: invalid name');
                return;
            }
            if (copies !== undefined && (typeof copies !== 'number' || !isFinite(copies))) {
                sendBadRequest(res, 'copies must be a finite number when specified');
                log('addShapeRepeater failed: invalid copies');
                return;
            }
            if (offset !== undefined && (typeof offset !== 'number' || !isFinite(offset))) {
                sendBadRequest(res, 'offset must be a finite number when specified');
                log('addShapeRepeater failed: invalid offset');
                return;
            }
            if (rotation !== undefined && (typeof rotation !== 'number' || !isFinite(rotation))) {
                sendBadRequest(res, 'rotation must be a finite number when specified');
                log('addShapeRepeater failed: invalid rotation');
                return;
            }
            if (startOpacity !== undefined && (typeof startOpacity !== 'number' || !isFinite(startOpacity))) {
                sendBadRequest(res, 'startOpacity must be a finite number when specified');
                log('addShapeRepeater failed: invalid startOpacity');
                return;
            }
            if (endOpacity !== undefined && (typeof endOpacity !== 'number' || !isFinite(endOpacity))) {
                sendBadRequest(res, 'endOpacity must be a finite number when specified');
                log('addShapeRepeater failed: invalid endOpacity');
                return;
            }

            function isVec2(value) {
                return Array.isArray(value)
                    && value.length === 2
                    && value.every((part) => typeof part === 'number' && isFinite(part));
            }
            if (position !== undefined && !isVec2(position)) {
                sendBadRequest(res, 'position must be an array of 2 numbers when specified');
                log('addShapeRepeater failed: invalid position');
                return;
            }
            if (scale !== undefined && !isVec2(scale)) {
                sendBadRequest(res, 'scale must be an array of 2 numbers when specified');
                log('addShapeRepeater failed: invalid scale');
                return;
            }

            const options = {};
            if (groupIndex !== undefined) options.groupIndex = groupIndex;
            if (name !== undefined) options.name = name;
            if (copies !== undefined) options.copies = copies;
            if (offset !== undefined) options.offset = offset;
            if (position !== undefined) options.position = position;
            if (scale !== undefined) options.scale = scale;
            if (rotation !== undefined) options.rotation = rotation;
            if (startOpacity !== undefined) options.startOpacity = startOpacity;
            if (endOpacity !== undefined) options.endOpacity = endOpacity;

            const optionsLiteral = Object.keys(options).length === 0
                ? 'null'
                : toExtendScriptStringLiteral(JSON.stringify(options));
            const script = `addShapeRepeater(${layerId}, ${optionsLiteral})`;
            handleBridgeMutationCall(script, res, 'addShapeRepeater()', 'Failed to add shape repeater');
        },
    );
}

function handleAddLayer(req, res) {
    readJsonBody(
        req,
        res,
        ({
            layerType,
            name,
            text,
            width,
            height,
            color,
            duration,
            shapeType,
            shapeSize,
            shapePosition,
            shapeFillColor,
            shapeFillOpacity,
            shapeStrokeColor,
            shapeStrokeOpacity,
            shapeStrokeWidth,
            shapeStrokeLineCap,
            shapeRoundness,
        }) => {
            if (!layerType || typeof layerType !== 'string') {
                sendBadRequest(res, 'layerType is required and must be a string');
                log('addLayer failed: invalid layerType');
                return;
            }

            const normalizedType = layerType.toLowerCase();
            if (!['text', 'null', 'solid', 'shape'].includes(normalizedType)) {
                sendBadRequest(res, 'Unsupported layerType. Use one of: text, null, solid, shape.');
                log(`addLayer failed: unsupported layerType "${layerType}"`);
                return;
            }
            if (name !== undefined && typeof name !== 'string') {
                sendBadRequest(res, 'name must be a string when specified');
                log('addLayer failed: name must be string');
                return;
            }
            if (text !== undefined && typeof text !== 'string') {
                sendBadRequest(res, 'text must be a string when specified');
                log('addLayer failed: text must be string');
                return;
            }
            if (width !== undefined && typeof width !== 'number') {
                sendBadRequest(res, 'width must be a number when specified');
                log('addLayer failed: width must be number');
                return;
            }
            if (height !== undefined && typeof height !== 'number') {
                sendBadRequest(res, 'height must be a number when specified');
                log('addLayer failed: height must be number');
                return;
            }
            if (duration !== undefined && typeof duration !== 'number') {
                sendBadRequest(res, 'duration must be a number when specified');
                log('addLayer failed: duration must be number');
                return;
            }
            if (color !== undefined) {
                const validColor = Array.isArray(color)
                    && color.length === 3
                    && color.every((part) => typeof part === 'number');
                if (!validColor) {
                    sendBadRequest(res, 'color must be an array of 3 numbers when specified');
                    log('addLayer failed: color must be [r, g, b]');
                    return;
                }
            }
            if (shapeType !== undefined && !['ellipse', 'rect'].includes(shapeType)) {
                sendBadRequest(res, 'shapeType must be one of: ellipse, rect');
                log('addLayer failed: invalid shapeType');
                return;
            }
            if (shapeSize !== undefined) {
                const validShapeSize = Array.isArray(shapeSize)
                    && shapeSize.length === 2
                    && shapeSize.every((part) => typeof part === 'number' && isFinite(part));
                if (!validShapeSize) {
                    sendBadRequest(res, 'shapeSize must be an array of 2 numbers when specified');
                    log('addLayer failed: invalid shapeSize');
                    return;
                }
            }
            if (shapePosition !== undefined) {
                const validShapePosition = Array.isArray(shapePosition)
                    && shapePosition.length === 2
                    && shapePosition.every((part) => typeof part === 'number' && isFinite(part));
                if (!validShapePosition) {
                    sendBadRequest(res, 'shapePosition must be an array of 2 numbers when specified');
                    log('addLayer failed: invalid shapePosition');
                    return;
                }
            }
            if (shapeFillColor !== undefined) {
                const validShapeFillColor = Array.isArray(shapeFillColor)
                    && shapeFillColor.length === 3
                    && shapeFillColor.every((part) => typeof part === 'number' && isFinite(part));
                if (!validShapeFillColor) {
                    sendBadRequest(res, 'shapeFillColor must be an array of 3 numbers when specified');
                    log('addLayer failed: invalid shapeFillColor');
                    return;
                }
            }
            if (shapeFillOpacity !== undefined && (typeof shapeFillOpacity !== 'number' || !isFinite(shapeFillOpacity))) {
                sendBadRequest(res, 'shapeFillOpacity must be a finite number when specified');
                log('addLayer failed: invalid shapeFillOpacity');
                return;
            }
            if (shapeStrokeColor !== undefined) {
                const validShapeStrokeColor = Array.isArray(shapeStrokeColor)
                    && shapeStrokeColor.length === 3
                    && shapeStrokeColor.every((part) => typeof part === 'number' && isFinite(part));
                if (!validShapeStrokeColor) {
                    sendBadRequest(res, 'shapeStrokeColor must be an array of 3 numbers when specified');
                    log('addLayer failed: invalid shapeStrokeColor');
                    return;
                }
            }
            if (
                shapeStrokeOpacity !== undefined
                && (typeof shapeStrokeOpacity !== 'number' || !isFinite(shapeStrokeOpacity))
            ) {
                sendBadRequest(res, 'shapeStrokeOpacity must be a finite number when specified');
                log('addLayer failed: invalid shapeStrokeOpacity');
                return;
            }
            if (shapeStrokeWidth !== undefined && (typeof shapeStrokeWidth !== 'number' || !isFinite(shapeStrokeWidth))) {
                sendBadRequest(res, 'shapeStrokeWidth must be a finite number when specified');
                log('addLayer failed: invalid shapeStrokeWidth');
                return;
            }
            if (
                shapeStrokeLineCap !== undefined
                && !['butt', 'round', 'projecting'].includes(shapeStrokeLineCap)
            ) {
                sendBadRequest(res, 'shapeStrokeLineCap must be one of: butt, round, projecting');
                log('addLayer failed: invalid shapeStrokeLineCap');
                return;
            }
            if (shapeRoundness !== undefined && (typeof shapeRoundness !== 'number' || !isFinite(shapeRoundness))) {
                sendBadRequest(res, 'shapeRoundness must be a finite number when specified');
                log('addLayer failed: invalid shapeRoundness');
                return;
            }

            const options = {};
            if (name !== undefined) options.name = name;
            if (text !== undefined) options.text = text;
            if (width !== undefined) options.width = width;
            if (height !== undefined) options.height = height;
            if (color !== undefined) options.color = color;
            if (duration !== undefined) options.duration = duration;
            if (shapeType !== undefined) options.shapeType = shapeType;
            if (shapeSize !== undefined) options.shapeSize = shapeSize;
            if (shapePosition !== undefined) options.shapePosition = shapePosition;
            if (shapeFillColor !== undefined) options.shapeFillColor = shapeFillColor;
            if (shapeFillOpacity !== undefined) options.shapeFillOpacity = shapeFillOpacity;
            if (shapeStrokeColor !== undefined) options.shapeStrokeColor = shapeStrokeColor;
            if (shapeStrokeOpacity !== undefined) options.shapeStrokeOpacity = shapeStrokeOpacity;
            if (shapeStrokeWidth !== undefined) options.shapeStrokeWidth = shapeStrokeWidth;
            if (shapeStrokeLineCap !== undefined) options.shapeStrokeLineCap = shapeStrokeLineCap;
            if (shapeRoundness !== undefined) options.shapeRoundness = shapeRoundness;

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
                        sendJson(res, 500, {
                            status: 'error',
                            message: parsedResult.message || 'Failed to add layer',
                        });
                        log(`addLayer failed: ${parsedResult.message || 'Unknown error'}`);
                        return;
                    }
                    sendJson(res, 200, { status: 'success', data: parsedResult });
                    log('addLayer successful.');
                } catch (e) {
                    sendBridgeParseError(res, result, e);
                    log(`addLayer failed: ${e.toString()}`);
                }
            });
        },
    );
}
