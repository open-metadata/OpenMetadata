# MCP Server

MCP Server app installs an embedded Model Context Protocol(MCP) server within OpenMetadata. Clients supporting MCP Protocol can connect using SSE or Streamable-Http transports.
 
   1. SSE : http[s]://openmetadata-host/mcp/sse
 
    - This endpoint can be used by client if Streamable-Http transport is used.
 
   2. Streamable-Http : http[s]://openmetadata-host/mcp
 
    - This endpoint can be used by client if Streamable-Http transport is used.

$$section
### Should Origin Header Be validated $(id="originValidationEnabled")

When enabled, clients must include a valid Origin header when connecting via Streamable-Http transport. This prevents unauthorized cross-origin requests.

$$

$$section
### Origin Header URI $(id="originHeaderUri")

The allowed origin URI that clients must include in their Origin header when validation is enabled. Only requests from this URI will be accepted.
Example: `https://myapp.example.com`

$$