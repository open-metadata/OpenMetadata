/*
 *  Copyright 2025 OpenMetadata
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.resources;

import com.fasterxml.jackson.databind.JsonNode;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.clients.ThirdEyeClient;
import org.openmetadata.service.clients.ThirdEyeService;
import org.openmetadata.service.config.ThirdEyeConfiguration;
import org.openmetadata.service.exception.ThirdEyeServiceException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Resource for proxying requests to ThirdEye analytics service.
 * 
 * This resource acts as a proxy between the OpenMetadata UI and the
 * ThirdEye Python service, handling authentication, authorization,
 * and request/response transformation.
 */
@Slf4j
@Path("/v1/thirdeye")
@Tag(name = "ThirdEye Analytics", description = "APIs for ThirdEye analytics and insights")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "thirdeye")
public class ThirdEyeResource {
  
  private static final Logger log = LoggerFactory.getLogger(ThirdEyeResource.class);
  
  public static final String COLLECTION_PATH = "v1/thirdeye";
  
  private final ThirdEyeService thirdEyeService;
  private final Authorizer authorizer;
  private final ThirdEyeConfiguration config;

  public ThirdEyeResource(Authorizer authorizer) {
    this.authorizer = authorizer;
    // Initialize with default configuration - will be overridden by dependency injection
    this.config = new ThirdEyeConfiguration();
    this.thirdEyeService = new ThirdEyeService(config);
  }

  public ThirdEyeResource(ThirdEyeService thirdEyeService, Authorizer authorizer, ThirdEyeConfiguration config) {
    this.thirdEyeService = thirdEyeService;
    this.authorizer = authorizer;
    this.config = config;
  }

  /**
   * Health check for ThirdEye service
   */
  @GET
  @Path("/health")
  @Operation(
      operationId = "getThirdEyeHealth",
      summary = "Check ThirdEye service health",
      description = "Check if the ThirdEye analytics service is available and healthy",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "ThirdEye service is healthy",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = JsonNode.class))),
        @ApiResponse(
            responseCode = "503",
            description = "ThirdEye service is unavailable")
      })
  public Response getHealth(@Context SecurityContext securityContext) {
    if (!config.isEnabled()) {
      return Response.status(Response.Status.SERVICE_UNAVAILABLE)
          .entity(Map.of("status", "disabled", "message", "ThirdEye service is disabled"))
          .build();
    }

    try {
      boolean isHealthy = thirdEyeService.getClient().healthCheck().get();
      if (isHealthy) {
        return Response.ok(Map.of("status", "ok", "service", "thirdeye")).build();
      } else {
        return Response.status(Response.Status.SERVICE_UNAVAILABLE)
            .entity(Map.of("status", "unhealthy", "service", "thirdeye"))
            .build();
      }
    } catch (Exception e) {
      log.error("ThirdEye health check failed", e);
      return Response.status(Response.Status.SERVICE_UNAVAILABLE)
          .entity(Map.of("status", "error", "message", e.getMessage()))
          .build();
    }
  }

  /**
   * Get ZI Score summary for dashboard
   */
  @GET
  @Path("/zi-score/summary")
  @Operation(
      operationId = "getZIScoreSummary",
      summary = "Get ZI Score summary",
      description = "Get Zero Intelligence Score summary optimized for dashboard display",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "ZI Score summary",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = JsonNode.class)))
      })
  public Response getZIScoreSummary(
      @Context SecurityContext securityContext,
      @Context UriInfo uriInfo) {
    
    authorize(securityContext, "VIEW_ANALYTICS");
    
    if (!config.isEnabled()) {
      return Response.status(Response.Status.SERVICE_UNAVAILABLE)
          .entity(Map.of("error", "ThirdEye service is disabled"))
          .build();
    }

    try {
      JsonNode response = thirdEyeService.getClient().get("/zi-score/summary").get();
      return Response.ok(response).build();
    } catch (Exception e) {
      log.error("Failed to get ZI Score summary", e);
      return handleThirdEyeError(e);
    }
  }

  /**
   * Get full ZI Score with metadata
   */
  @GET
  @Path("/zi-score")
  @Operation(
      operationId = "getZIScore",
      summary = "Get full ZI Score",
      description = "Get complete Zero Intelligence Score with all metadata",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Full ZI Score data",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = JsonNode.class)))
      })
  public Response getZIScore(
      @Context SecurityContext securityContext,
      @Context UriInfo uriInfo) {
    
    authorize(securityContext, "VIEW_ANALYTICS");
    
    if (!config.isEnabled()) {
      return Response.status(Response.Status.SERVICE_UNAVAILABLE)
          .entity(Map.of("error", "ThirdEye service is disabled"))
          .build();
    }

    try {
      JsonNode response = thirdEyeService.getClient().get("/zi-score").get();
      return Response.ok(response).build();
    } catch (Exception e) {
      log.error("Failed to get ZI Score", e);
      return handleThirdEyeError(e);
    }
  }

  /**
   * Get health metrics from ThirdEye
   */
  @GET
  @Path("/zi-score/health-metrics")
  @Operation(
      operationId = "getHealthMetrics",
      summary = "Get health metrics",
      description = "Get raw health metrics from ThirdEye database views",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Health metrics data",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = JsonNode.class)))
      })
  public Response getHealthMetrics(
      @Context SecurityContext securityContext,
      @Context UriInfo uriInfo) {
    
    authorize(securityContext, "VIEW_ANALYTICS");
    
    if (!config.isEnabled()) {
      return Response.status(Response.Status.SERVICE_UNAVAILABLE)
          .entity(Map.of("error", "ThirdEye service is disabled"))
          .build();
    }

    try {
      JsonNode response = thirdEyeService.getClient().get("/zi-score/health-metrics").get();
      return Response.ok(response).build();
    } catch (Exception e) {
      log.error("Failed to get health metrics", e);
      return handleThirdEyeError(e);
    }
  }

  /**
   * Get purge candidates (tables recommended for deletion)
   */
  @GET
  @Path("/zi-score/purge-candidates")
  @Operation(
      operationId = "getPurgeCandidates",
      summary = "Get purge candidates",
      description = "Get tables recommended for deletion or archival based on purge scores",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Purge candidates data",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = JsonNode.class)))
      })
  public Response getPurgeCandidates(
      @Context SecurityContext securityContext,
      @Context UriInfo uriInfo,
      @Parameter(description = "Maximum number of results") @QueryParam("limit") Integer limit,
      @Parameter(description = "Number of results to skip") @QueryParam("offset") Integer offset,
      @Parameter(description = "Minimum purge score filter") @QueryParam("min_score") Double minScore,
      @Parameter(description = "Recommendation type filter") @QueryParam("recommendation") String recommendation) {
    
    authorize(securityContext, "VIEW_ANALYTICS");
    
    if (!config.isEnabled()) {
      return Response.status(Response.Status.SERVICE_UNAVAILABLE)
          .entity(Map.of("error", "ThirdEye service is disabled"))
          .build();
    }

    try {
      // Build query parameters
      Map<String, String> queryParams = Map.of(
          "limit", limit != null ? limit.toString() : "100",
          "offset", offset != null ? offset.toString() : "0"
      );
      
      if (minScore != null) {
        queryParams = Map.of(
            "limit", limit != null ? limit.toString() : "100",
            "offset", offset != null ? offset.toString() : "0",
            "min_score", minScore.toString()
        );
      }
      
      if (recommendation != null) {
        queryParams = Map.of(
            "limit", limit != null ? limit.toString() : "100",
            "offset", offset != null ? offset.toString() : "0",
            "recommendation", recommendation
        );
      }
      
      JsonNode response = thirdEyeService.getClient().get("/zi-score/purge-candidates", queryParams).get();
      return Response.ok(response).build();
    } catch (Exception e) {
      log.error("Failed to get purge candidates", e);
      return handleThirdEyeError(e);
    }
  }

  /**
   * Proxy GraphQL requests to ThirdEye service
   */
  @POST
  @Path("/graphql")
  @Operation(
      operationId = "thirdEyeGraphQL",
      summary = "ThirdEye GraphQL endpoint",
      description = "Proxy GraphQL queries to ThirdEye service",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "GraphQL response",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = JsonNode.class)))
      })
  public Response graphQL(
      @Context SecurityContext securityContext,
      @Context UriInfo uriInfo,
      @NotNull JsonNode graphqlRequest) {
    
    authorize(securityContext, "VIEW_ANALYTICS");
    
    if (!config.isEnabled()) {
      return Response.status(Response.Status.SERVICE_UNAVAILABLE)
          .entity(Map.of("error", "ThirdEye service is disabled"))
          .build();
    }

    try {
      JsonNode response = thirdEyeService.getClient().post("/graphql", graphqlRequest).get();
      return Response.ok(response).build();
    } catch (Exception e) {
      log.error("Failed to execute GraphQL query", e);
      return handleThirdEyeError(e);
    }
  }

  /**
   * Generic proxy for any ThirdEye endpoint
   */
  @GET
  @Path("/{path:.*}")
  @Operation(
      operationId = "proxyThirdEyeGet",
      summary = "Proxy GET request to ThirdEye",
      description = "Proxy any GET request to ThirdEye service",
      hidden = true)
  public Response proxyGet(
      @Context SecurityContext securityContext,
      @Context UriInfo uriInfo,
      @PathParam("path") String path) {
    
    authorize(securityContext, "VIEW_ANALYTICS");
    
    if (!config.isEnabled()) {
      return Response.status(Response.Status.SERVICE_UNAVAILABLE)
          .entity(Map.of("error", "ThirdEye service is disabled"))
          .build();
    }

    try {
      // Forward query parameters
      Map<String, String> queryParams = uriInfo.getQueryParameters().entrySet().stream()
          .collect(java.util.stream.Collectors.toMap(
              Map.Entry::getKey,
              entry -> entry.getValue().get(0)
          ));
      
      JsonNode response = thirdEyeService.getClient().get("/" + path, queryParams).get();
      return Response.ok(response).build();
    } catch (Exception e) {
      log.error("Failed to proxy GET request to ThirdEye: {}", path, e);
      return handleThirdEyeError(e);
    }
  }

  /**
   * Generic proxy for POST requests
   */
  @POST
  @Path("/{path:.*}")
  @Operation(
      operationId = "proxyThirdEyePost",
      summary = "Proxy POST request to ThirdEye",
      description = "Proxy any POST request to ThirdEye service",
      hidden = true)
  public Response proxyPost(
      @Context SecurityContext securityContext,
      @Context UriInfo uriInfo,
      @PathParam("path") String path,
      JsonNode requestBody) {
    
    authorize(securityContext, "VIEW_ANALYTICS");
    
    if (!config.isEnabled()) {
      return Response.status(Response.Status.SERVICE_UNAVAILABLE)
          .entity(Map.of("error", "ThirdEye service is disabled"))
          .build();
    }

    try {
      JsonNode response = thirdEyeService.getClient().post("/" + path, requestBody).get();
      return Response.ok(response).build();
    } catch (Exception e) {
      log.error("Failed to proxy POST request to ThirdEye: {}", path, e);
      return handleThirdEyeError(e);
    }
  }

  /**
   * Authorize the request
   */
  private void authorize(SecurityContext securityContext, String operation) {
    // TODO: Implement proper authorization based on OpenMetadata's auth system
    // For now, we'll allow all authenticated users
    if (securityContext.getUserPrincipal() == null) {
      throw new jakarta.ws.rs.NotAuthorizedException("Authentication required");
    }
  }

  /**
   * Handle ThirdEye service errors
   */
  private Response handleThirdEyeError(Exception e) {
    if (e instanceof ThirdEyeServiceException) {
      return Response.status(Response.Status.BAD_GATEWAY)
          .entity(Map.of("error", "ThirdEye service error", "message", e.getMessage()))
          .build();
    } else {
      return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
          .entity(Map.of("error", "Internal server error", "message", e.getMessage()))
          .build();
    }
  }
}
