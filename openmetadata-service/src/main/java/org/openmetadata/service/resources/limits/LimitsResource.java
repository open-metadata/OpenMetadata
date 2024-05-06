package org.openmetadata.service.resources.limits;

import io.swagger.v3.oas.annotations.Hidden;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import org.openmetadata.schema.system.LimitsResponse;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;

@Path("/v1/limits")
@Tag(name = "Limits", description = "APIs related to Limits configuration and settings.")
@Hidden
@Produces(MediaType.APPLICATION_JSON)
@Collection(name = "limits")
public class LimitsResource {
  private OpenMetadataApplicationConfig openMetadataApplicationConfig;

  private Limits limits;

  public void initialize(OpenMetadataApplicationConfig config, Limits limits) {
    this.openMetadataApplicationConfig = config;
    this.limits = limits;
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
                    schema = @Schema(implementation = LimitsResponse.class)))
      })
  public LimitsResponse getAuthConfig() {
    LimitsResponse limitsResponse = new LimitsResponse();
    if (limits != null) {
      limitsResponse = limits.getLimits();
    }
    return limitsResponse;
  }
}
