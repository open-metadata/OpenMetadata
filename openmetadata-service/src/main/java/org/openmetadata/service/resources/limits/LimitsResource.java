package org.openmetadata.service.resources.limits;

import io.swagger.v3.oas.annotations.Hidden;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import org.openmetadata.schema.system.LimitsConfig;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;

@Path("/v1/limits")
@Tag(name = "Limits", description = "APIs related to Limits configuration and settings.")
@Hidden
@Produces(MediaType.APPLICATION_JSON)
@Collection(name = "limits")
public class LimitsResource {
  private final Limits limits;
  private final OpenMetadataApplicationConfig config;

  public LimitsResource(OpenMetadataApplicationConfig config, Limits limits) {
    this.limits = limits;
    this.config = config;
  }

  @GET
  @Path("/features/{name}")
  @Operation(
      operationId = "getLimitsForaFeature",
      summary = "Get Limits configuration for a feature",
      responses = {
        @ApiResponse(responseCode = "200", description = "Limits configuration for a feature")
      })
  public Response getLimitsForaFeature(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Feature", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
      @Parameter(
              description = "Use Cache to retrieve the values.",
              schema = @Schema(type = "boolean", example = "true"))
          @QueryParam("cache")
          @DefaultValue("true")
          boolean cache) {
    return limits.getLimitsForaFeature(name, cache);
  }

  @GET
  @Path(("/config"))
  @Operation(
      operationId = "getLimitsConfiguration",
      summary = "Get Limits configuration",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Limits configuration",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = LimitsConfig.class)))
      })
  public LimitsConfig getAuthConfig() {
    LimitsConfig limitsConfig = new LimitsConfig();
    if (limits != null) {
      limitsConfig = limits.getLimitsConfig();
    }
    return limitsConfig;
  }
}
