package org.openmetadata.mcp.resources;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import java.io.IOException;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.mcp.server.transport.OAuthHttpStatelessServerTransportProvider;

/**
 * JAX-RS resource for root-level OAuth endpoints (RFC 8414 discovery).
 * Forwards requests to the /mcp OAuth handlers.
 */
@Slf4j
@Path("/")
public class RootOAuthEndpointsResource {

  private final OAuthHttpStatelessServerTransportProvider transport;

  public RootOAuthEndpointsResource(OAuthHttpStatelessServerTransportProvider transport) {
    this.transport = transport;
  }

  @GET
  @Path("/.well-known/oauth-authorization-server")
  @Produces(MediaType.APPLICATION_JSON)
  public void getRootAuthorizationServerMetadata(
      @Context HttpServletRequest request, @Context HttpServletResponse response)
      throws IOException, ServletException {

    LOG.info("Root OAuth metadata endpoint called via JAX-RS, forwarding to /mcp");
    // Forward to MCP handler by modifying the request URI
    transport.doGet(request, response);
  }

  @GET
  @Path("/.well-known/oauth-protected-resource")
  @Produces(MediaType.APPLICATION_JSON)
  public void getRootProtectedResourceMetadata(
      @Context HttpServletRequest request, @Context HttpServletResponse response)
      throws IOException, ServletException {

    LOG.info("Root protected resource metadata endpoint called via JAX-RS");
    transport.doGet(request, response);
  }

  @GET
  @Path("/authorize")
  public void rootAuthorize(
      @Context HttpServletRequest request, @Context HttpServletResponse response)
      throws IOException, ServletException {

    LOG.info("Root OAuth authorize endpoint called via JAX-RS");
    transport.doGet(request, response);
  }

  @POST
  @Path("/authorize")
  public void rootAuthorizePost(
      @Context HttpServletRequest request, @Context HttpServletResponse response)
      throws IOException, ServletException {

    LOG.info("Root OAuth authorize POST endpoint called via JAX-RS");
    transport.doPost(request, response);
  }

  @POST
  @Path("/token")
  @Produces(MediaType.APPLICATION_JSON)
  public void rootToken(@Context HttpServletRequest request, @Context HttpServletResponse response)
      throws IOException, ServletException {

    LOG.info("Root OAuth token endpoint called via JAX-RS");
    transport.doPost(request, response);
  }

  @POST
  @Path("/register")
  @Produces(MediaType.APPLICATION_JSON)
  public void rootRegister(
      @Context HttpServletRequest request, @Context HttpServletResponse response)
      throws IOException, ServletException {

    LOG.info("Root OAuth register endpoint called via JAX-RS");
    transport.doPost(request, response);
  }

  @POST
  @Path("/revoke")
  public void rootRevoke(@Context HttpServletRequest request, @Context HttpServletResponse response)
      throws IOException, ServletException {

    LOG.info("Root OAuth revoke endpoint called via JAX-RS");
    transport.doPost(request, response);
  }
}
