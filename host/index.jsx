var __AE_AGENT_HOST_ROOT = File($.fileName).parent.fsName;

$.evalFile(File(__AE_AGENT_HOST_ROOT + "/lib/common.jsx"));
$.evalFile(File(__AE_AGENT_HOST_ROOT + "/lib/query_handlers.jsx"));
$.evalFile(File(__AE_AGENT_HOST_ROOT + "/lib/mutation_handlers.jsx"));
