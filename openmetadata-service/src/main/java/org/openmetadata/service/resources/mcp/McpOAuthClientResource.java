package org.openmetadata.service.resources.mcp;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.mcp.OAuthClient;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.OAuthDAOs;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.Authorizer;

@Path("/v1/mcp/clients")
@Tag(name = "MCP OAuth Clients", description = "Administer registered MCP OAuth clients.")
@Produces(MediaType.APPLICATION_JSON)
@Collection(name = "mcpOAuthClients")
@Slf4j
public class McpOAuthClientResource {
  private final Authorizer authorizer;
  private final OAuthDAOs.OAuthClientDAO clients;

  public McpOAuthClientResource(final Authorizer authorizer) {
    this(authorizer, Entity.getCollectionDAO().oauthClientDAO());
  }

  McpOAuthClientResource(final Authorizer authorizer, final OAuthDAOs.OAuthClientDAO clients) {
    this.authorizer = authorizer;
    this.clients = clients;
  }

  @GET
  @Operation(
      operationId = "listMcpOAuthClients",
      summary = "List MCP clients without credentials (admin only)")
  public List<OAuthClient> list(
      @Context final SecurityContext context,
      @QueryParam("after") @DefaultValue("") final String after,
      @QueryParam("limit") @DefaultValue("100") final int limit) {
    authorizer.authorizeAdmin(context);
    if (limit < 1 || limit > 1000 || after == null || after.length() > 255) {
      throw new BadRequestException("limit must be 1–1000 and after must be a client ID");
    }
    return clients.listClients(after, limit);
  }

  @DELETE
  @Path("/{clientId}")
  @Operation(
      operationId = "deleteMcpOAuthClient",
      summary = "Remove an MCP client and revoke all its grants (admin only)")
  public Response delete(
      @Context final SecurityContext context, @PathParam("clientId") final String clientId) {
    authorizer.authorizeAdmin(context);
    if (clients.deleteWithGrants(clientId) == 0) {
      throw new NotFoundException("MCP OAuth client not found");
    }
    LOG.info(
        "Administrator {} removed MCP OAuth client {} and its grants",
        context.getUserPrincipal().getName(),
        clientId);
    return Response.noContent().build();
  }
}
