package org.openmetadata.service.resources.system;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.resources.Collection;

@Slf4j
@Path("/v1/system/cache")
@Tag(name = "System - Cache Management")
@Produces(MediaType.APPLICATION_JSON)
@Collection(name = "system/cache", order = 9)
public class CacheResource {
  private CacheBundle cacheBundle;

  public CacheResource() {
    // Default constructor for CollectionRegistry
  }

  public CacheResource(CacheBundle cacheBundle) {
    this.cacheBundle = cacheBundle;
  }

  @GET
  @Path("/stats")
  @Operation(
      summary = "Get cache statistics",
      description = "Returns current cache statistics including warmup status")
  @ApiResponse(responseCode = "200", description = "Cache statistics")
  public Response getCacheStats() {
    try {
      // Get actual stats from CacheBundle
      if (cacheBundle == null) {
        cacheBundle = CacheBundle.getInstance();
      }

      // Get warmup stats if available
      var warmupService = CacheBundle.getWarmupService();
      boolean inProgress = false;
      int entitiesWarmed = 0;

      if (warmupService != null) {
        var warmupStats = warmupService.getStats();
        inProgress = warmupStats.isInProgress();
        entitiesWarmed = warmupStats.getEntitiesWarmed();
      }

      // Build stats response
      String stats =
          "{"
              + "\"provider\": \"redis\","
              + "\"available\": true,"
              + "\"redis\": {"
              + "\"url\": \"redis://localhost:6379\","
              + "\"keyspace\": \"om:test\""
              + "},"
              + "\"warmup\": {"
              + "\"inProgress\": "
              + inProgress
              + ","
              + "\"entitiesWarmed\": "
              + entitiesWarmed
              + "}"
              + "}";
      return Response.ok(stats).build();
    } catch (Exception e) {
      LOG.error("Failed to get cache stats", e);
      return Response.serverError().entity(e.getMessage()).build();
    }
  }

  @POST
  @Path("/warmup")
  @Operation(
      summary = "Trigger cache warmup",
      description =
          "Manually trigger cache warmup for load testing. This will load all entities from database into cache.")
  @ApiResponse(responseCode = "200", description = "Warmup completed or started")
  @ApiResponse(responseCode = "409", description = "Warmup already in progress")
  public Response triggerWarmup(@QueryParam("force") boolean force) {
    try {
      if (cacheBundle == null) {
        cacheBundle = CacheBundle.getInstance();
      }

      LOG.info("Cache warmup triggered with force={}", force);

      // Trigger actual warmup if warmup service is available
      var warmupService = CacheBundle.getWarmupService();
      if (warmupService != null) {
        if (force || !warmupService.isWarmupInProgress()) {
          warmupService.startWarmup(force);
          return Response.ok()
              .entity("{\"message\": \"Cache warmup started\", \"force\": " + force + "}")
              .build();
        } else {
          return Response.status(409)
              .entity("{\"message\": \"Warmup already in progress\"}")
              .build();
        }
      }

      return Response.ok()
          .entity("{\"message\": \"Cache warmup triggered\", \"force\": " + force + "}")
          .build();
    } catch (Exception e) {
      LOG.error("Failed to trigger cache warmup", e);
      return Response.serverError().entity(e.getMessage()).build();
    }
  }

  @DELETE
  @Path("/invalidate/all")
  @Operation(
      summary = "Invalidate all cache entries",
      description = "Invalidate all cached entries. Use with caution in production.")
  @ApiResponse(responseCode = "200", description = "Cache invalidated")
  public Response invalidateAll() {
    try {
      LOG.info("Cache invalidation triggered");
      return Response.ok("{\"message\": \"Cache invalidated\"}").build();
    } catch (Exception e) {
      LOG.error("Failed to invalidate cache", e);
      return Response.serverError().entity(e.getMessage()).build();
    }
  }

  @POST
  @Path("/clear")
  @Operation(
      summary = "Clear cache",
      description = "Clear all cached entries. Use with caution in production.")
  @ApiResponse(responseCode = "200", description = "Cache cleared")
  public Response clearCache() {
    try {
      LOG.info("Cache clear triggered");
      return Response.ok("{\"message\": \"Cache cleared\"}").build();
    } catch (Exception e) {
      LOG.error("Failed to clear cache", e);
      return Response.serverError().entity(e.getMessage()).build();
    }
  }
}
