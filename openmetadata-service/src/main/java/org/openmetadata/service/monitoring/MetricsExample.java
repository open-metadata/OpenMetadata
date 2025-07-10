package org.openmetadata.service.monitoring;

import io.micrometer.core.instrument.Timer;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import lombok.extern.slf4j.Slf4j;

/**
 * Example showing how to use the new metrics system in OpenMetadata.
 * This demonstrates various metric types and usage patterns.
 */
@Slf4j
@Path("/api/v1/example")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class MetricsExample {

  @Inject private OpenMetadataMetrics metrics;

  @GET
  @Path("/search")
  public Response search(@QueryParam("query") String query) {
    // Example: Recording search metrics
    try {
      // Simulate search operation
      SearchResult result = performSearch(query);

      // Record the search query metrics
      metrics.recordSearchQuery("api", result.getCount());

      return Response.ok(result).build();
    } catch (Exception e) {
      // Record search query with no results on error
      metrics.recordSearchQuery("api", 0);
      throw e;
    }
  }

  @POST
  @Path("/entities/{type}")
  public Response createEntity(@PathParam("type") String entityType, Object entity) {
    // Example: Recording entity operations
    Timer.Sample sample = Timer.start(metrics.getMeterRegistry());

    try {
      // Simulate entity creation
      Object created = createEntityInternal(entityType, entity);

      // Record successful entity creation
      metrics.recordEntityCreated(entityType);

      // Record custom timing metric
      sample.stop(
          Timer.builder("entity.creation.time")
              .description("Time to create an entity")
              .tag("type", entityType)
              .tag("status", "success")
              .register(metrics.getMeterRegistry()));

      return Response.status(Response.Status.CREATED).entity(created).build();

    } catch (Exception e) {
      // Record failed creation timing
      sample.stop(
          Timer.builder("entity.creation.time")
              .description("Time to create an entity")
              .tag("type", entityType)
              .tag("status", "failure")
              .register(metrics.getMeterRegistry()));

      throw e;
    }
  }

  @PUT
  @Path("/entities/{type}/{id}")
  public Response updateEntity(
      @PathParam("type") String entityType, @PathParam("id") String entityId, Object entity) {

    // Example: Simple counter increment
    metrics.recordEntityUpdated(entityType);

    // Simulate update
    Object updated = updateEntityInternal(entityType, entityId, entity);

    return Response.ok(updated).build();
  }

  @DELETE
  @Path("/entities/{type}/{id}")
  public Response deleteEntity(
      @PathParam("type") String entityType, @PathParam("id") String entityId) {

    // Example: Recording with additional context
    metrics
        .getMeterRegistry()
        .counter(
            "entity.operations", "type", entityType, "operation", "delete", "soft_delete", "true")
        .increment();

    // Simulate deletion
    deleteEntityInternal(entityType, entityId);

    return Response.noContent().build();
  }

  @POST
  @Path("/auth/login")
  public Response login(LoginRequest request) {
    // Example: Authentication metrics
    String authType = request.getAuthType();

    metrics.recordAuthenticationAttempt(authType);

    try {
      // Simulate authentication
      LoginResponse response = authenticate(request);

      if (!response.isSuccess()) {
        metrics.recordAuthenticationFailure(authType, response.getFailureReason());
        return Response.status(Response.Status.UNAUTHORIZED).build();
      }

      return Response.ok(response).build();

    } catch (Exception e) {
      metrics.recordAuthenticationFailure(authType, "exception");
      throw e;
    }
  }

  @GET
  @Path("/status")
  public Response getStatus() {
    // Example: Using gauges for current state
    metrics.registerGauge(
        "example.active_connections",
        () -> getActiveConnectionCount(),
        "Number of active connections");

    // Example: Distribution summary for response sizes
    String status = getSystemStatus();
    metrics
        .getMeterRegistry()
        .summary("api.response.size", "endpoint", "status")
        .record(status.length());

    return Response.ok(status).build();
  }

  // Simulated internal methods
  private SearchResult performSearch(String query) {
    return new SearchResult(query, 42);
  }

  private Object createEntityInternal(String type, Object entity) {
    return entity;
  }

  private Object updateEntityInternal(String type, String id, Object entity) {
    return entity;
  }

  private void deleteEntityInternal(String type, String id) {
    // Simulate deletion
  }

  private LoginResponse authenticate(LoginRequest request) {
    return new LoginResponse(true, null);
  }

  private int getActiveConnectionCount() {
    return 10;
  }

  private String getSystemStatus() {
    return "{\"status\":\"healthy\",\"version\":\"1.8.0\"}";
  }

  // Helper classes
  private static class SearchResult {
    private final String query;
    private final int count;

    public SearchResult(String query, int count) {
      this.query = query;
      this.count = count;
    }

    public int getCount() {
      return count;
    }
  }

  private static class LoginRequest {
    private String authType;

    public String getAuthType() {
      return authType;
    }
  }

  private static class LoginResponse {
    private final boolean success;
    private final String failureReason;

    public LoginResponse(boolean success, String failureReason) {
      this.success = success;
      this.failureReason = failureReason;
    }

    public boolean isSuccess() {
      return success;
    }

    public String getFailureReason() {
      return failureReason;
    }
  }
}
