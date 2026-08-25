# MCP Server

MCP Server app installs an embedded Model Context Protocol(MCP) server within OpenMetadata. Clients supporting MCP Protocol can connect using SSE or Streamable-Http transports.
 
   1. SSE : http[s]://openmetadata-host/mcp/sse
 
    - This endpoint can be used by client if Streamable-Http transport is used.
 
   2. Streamable-Http : http[s]://openmetadata-host/mcp
 
    - This endpoint can be used by client if Streamable-Http transport is used.

$$section
### Base URL $(id="baseUrl")

External-facing base URL advertised in the MCP OAuth metadata (issuer and endpoint URLs). Leave empty to fall back to the OpenMetadata base URL from system settings. Set this explicitly for clustered deployments where the service is reached through a load balancer or ingress.
Example: `https://openmetadata.example.com`

$$

$$section
### Allowed Origins $(id="allowedOrigins")

Origins allowed to call the MCP OAuth endpoints from a browser (CORS allowlist). An empty list rejects every cross-origin request, which stops browser-based MCP clients from connecting. Use exact origins in production; `*` is accepted but not recommended.

$$