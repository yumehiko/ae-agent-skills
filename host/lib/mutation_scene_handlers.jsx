var __aeSceneHandlersRoot = __AE_AGENT_HOST_ROOT;
if (!__aeSceneHandlersRoot || __aeSceneHandlersRoot.length === 0) {
    __aeSceneHandlersRoot = File($.fileName).parent.parent.fsName;
}

$.evalFile(File(__aeSceneHandlersRoot + "/lib/mutation_scene_core.jsx"));
$.evalFile(File(__aeSceneHandlersRoot + "/lib/mutation_scene_validation.jsx"));
$.evalFile(File(__aeSceneHandlersRoot + "/lib/mutation_scene_apply.jsx"));
