# Mcp Application

Mcp Application installs a embedded Mcp Server with OpenMetadata. Client supporting Mcp Protocol can connect using SSE or Streamable-Http transports.
For different transports the client can use the following endpoints:
1. SSE : http[s]://<openmetadata-host>/mcp/sse 
   - This endpoint is used for Server-Sent Events (SSE) transport.  
2. Streamable-Http : http[s]://<openmetadata-host>/mcp 
   - This endpoint is used for Streamable-Http transport.

$$section
### Origin Header URI $(id="originHeaderUri")

The URI to be used in the `Origin` header for the MCP Application. This is used to identify the source of the requests made by the clients.

$$