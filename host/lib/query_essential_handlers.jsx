function getEssentialProperties() {
    try {
        ensureJSON();
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return encodePayload({ status: "Error", message: "Active composition not found." });
        }
        var count = 0;
        try {
            if (typeof comp.motionGraphicsTemplateControllerCount === "number") {
                count = comp.motionGraphicsTemplateControllerCount;
            }
        } catch (eCount) {
            count = 0;
        }

        var controllers = [];
        for (var i = 1; i <= count; i++) {
            var name = null;
            try {
                if (typeof comp.getMotionGraphicsTemplateControllerName === "function") {
                    name = comp.getMotionGraphicsTemplateControllerName(i);
                }
            } catch (eName) {
                name = null;
            }
            if (!name || String(name).length === 0) {
                continue;
            }
            controllers.push({
                index: i,
                name: String(name)
            });
        }
        return encodePayload({
            compId: comp.id,
            compName: comp.name,
            count: controllers.length,
            controllers: controllers
        });
    } catch (e) {
        log("getEssentialProperties() threw: " + e.toString());
        return encodePayload({ status: "Error", message: e.toString() });
    }
}
