package org.openmetadata.service.swagger;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import java.io.IOException;
import java.io.InputStream;

/**
 * JAX-RS resource that serves the OpenAPI specification. The spec is generated at build time by
 * swagger-maven-plugin-jakarta.
 */
@Path("/")
public class SwaggerResource {

  private final String resourcePackage;
  private final SwaggerBundleConfiguration config;

  public SwaggerResource(String resourcePackage, SwaggerBundleConfiguration config) {
    this.resourcePackage = resourcePackage;
    this.config = config;
  }

  @GET
  @Path("/swagger.json")
  @Produces(MediaType.APPLICATION_JSON)
  public Response getOpenApiJson(@Context UriInfo uriInfo) {
    try (InputStream is = getClass().getClassLoader().getResourceAsStream("assets/swagger.json")) {
      if (is == null) {
        return Response.status(Response.Status.NOT_FOUND)
            .entity("{\"error\": \"OpenAPI spec not found\"}")
            .build();
      }
      String content = new String(is.readAllBytes());
      return Response.ok(content).build();
    } catch (IOException e) {
      return Response.serverError().entity("{\"error\": \"" + e.getMessage() + "\"}").build();
    }
  }

  @GET
  @Path("/swagger.yaml")
  @Produces("application/yaml")
  public Response getOpenApiYaml(@Context UriInfo uriInfo) {
    try (InputStream is = getClass().getClassLoader().getResourceAsStream("assets/swagger.yaml")) {
      if (is == null) {
        return Response.status(Response.Status.NOT_FOUND)
            .entity("error: OpenAPI spec not found")
            .build();
      }
      String content = new String(is.readAllBytes());
      return Response.ok(content).build();
    } catch (IOException e) {
      return Response.serverError().entity("error: " + e.getMessage()).build();
    }
  }
}
