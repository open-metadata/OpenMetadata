# MCP Server

MCP Server app installs an embedded Model Context Protocol(MCP) server within OpenMetadata. Clients supporting MCP Protocol can connect using SSE or Streamable-Http transports.
 
   1. SSE : http[s]://openmetadata-host/mcp/sse
 
    - This endpoint can be used by client if Streamable-Http transport is used.
 
   2. Streamable-Http : http[s]://openmetadata-host/mcp
 
    - This endpoint can be used by client if Streamable-Http transport is used.