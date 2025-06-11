# Mcp Application

Mcp Application Embeds a MCP Server to allow LLMs to interact with OpenMetadata via the protocol. 
OpenMetadata Supports MCP SSE and Streamable-Http both Transports.
For Connecting client to Openmetadata MCP Server :-
1. SSE : Use the Uri `https://<openmetadata-host>/mcp/sse`
1. Streamable-Http : Use the Uri `https://<openmetadata-host>/mcp`

$$section
### Origin Header URI $(id="originHeaderUri")

URI to be used in the Origin header by clients when making requests to the MCP application.

$$