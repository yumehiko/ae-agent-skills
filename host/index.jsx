var __AE_AGENT_HOST_ROOT = File($.fileName).parent.fsName;

$.evalFile(File(__AE_AGENT_HOST_ROOT + "/lib/common.jsx"));
$.evalFile(File(__AE_AGENT_HOST_ROOT + "/lib/property_utils.jsx"));
$.evalFile(File(__AE_AGENT_HOST_ROOT + "/lib/query_handlers.jsx"));
$.evalFile(File(__AE_AGENT_HOST_ROOT + "/lib/mutation_handlers.jsx"));
$.evalFile(File(__AE_AGENT_HOST_ROOT + "/lib/mutation_shape_handlers.jsx"));
$.evalFile(File(__AE_AGENT_HOST_ROOT + "/lib/mutation_timeline_handlers.jsx"));
$.evalFile(File(__AE_AGENT_HOST_ROOT + "/lib/mutation_layer_structure_handlers.jsx"));
