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
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.mcp.server.transport.OAuthHttpStatelessServerTransportProvider;

/**
 * JAX-RS resource for OAuth endpoints.
 * This wraps the servlet-based OAuth transport to work with Jersey/Dropwizard.
 */
@Slf4j
@Path("/mcp")
public class OAuthEndpointsResource {

  private final OAuthHttpStatelessServerTransportProvider transport;

  public OAuthEndpointsResource(OAuthHttpStatelessServerTransportProvider transport) {
    this.transport = transport;
  }

  @GET
  @Path("/.well-known/oauth-authorization-server")
  @Produces(MediaType.APPLICATION_JSON)
  public Response getAuthorizationServerMetadata(
      @Context HttpServletRequest request, @Context HttpServletResponse response) {

    LOG.info("OAuth metadata endpoint called via JAX-RS");
    try {
      transport.doGet(request, response);
      return Response.status(response.getStatus()).entity(response.getOutputStream()).build();
    } catch (Exception e) {
      LOG.error("Error handling OAuth metadata request", e);
      return Response.serverError().build();
    }
  }

  @GET
  @Path("/.well-known/oauth-protected-resource")
  @Produces(MediaType.APPLICATION_JSON)
  public void getProtectedResourceMetadata(
      @Context HttpServletRequest request, @Context HttpServletResponse response)
      throws IOException, ServletException {

    LOG.info("Protected resource metadata endpoint called via JAX-RS");
    transport.doGet(request, response);
  }

  @GET
  @Path("/authorize")
  public void authorize(@Context HttpServletRequest request, @Context HttpServletResponse response)
      throws IOException, ServletException {

    LOG.info("OAuth authorize endpoint called via JAX-RS");
    transport.doGet(request, response);
  }

  @POST
  @Path("/authorize")
  public void authorizePost(
      @Context HttpServletRequest request, @Context HttpServletResponse response)
      throws IOException, ServletException {

    LOG.info("OAuth authorize POST endpoint called via JAX-RS");
    transport.doPost(request, response);
  }

  @POST
  @Path("/token")
  @Produces(MediaType.APPLICATION_JSON)
  public void token(@Context HttpServletRequest request, @Context HttpServletResponse response)
      throws IOException, ServletException {

    LOG.info("OAuth token endpoint called via JAX-RS");
    transport.doPost(request, response);
  }

  @POST
  @Path("/register")
  @Produces(MediaType.APPLICATION_JSON)
  public void register(@Context HttpServletRequest request, @Context HttpServletResponse response)
      throws IOException, ServletException {

    LOG.info("OAuth register endpoint called via JAX-RS");
    transport.doPost(request, response);
  }

  @POST
  @Path("/revoke")
  public void revoke(@Context HttpServletRequest request, @Context HttpServletResponse response)
      throws IOException, ServletException {

    LOG.info("OAuth revoke endpoint called via JAX-RS");
    transport.doPost(request, response);
  }
}
