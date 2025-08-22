package org.openmetadata.service.resources.system;

import io.dropwizard.core.server.DefaultServerFactory;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.annotation.security.PermitAll;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.util.ExecutorManager;
import org.openmetadata.service.util.ExecutorMonitor;

@Path("/v1/system/executors")
@Tag(
    name = "Executor Management",
    description = "APIs for monitoring and managing thread pool executors")
@Produces(MediaType.APPLICATION_JSON)
@Slf4j
@Collection(name = "Executors")
public class ExecutorResource {
  public static final String COLLECTION_PATH = "/v1/system/executors";
  private DefaultServerFactory serverFactory;

  public void initialize(OpenMetadataApplicationConfig config) throws IOException {
    serverFactory = (DefaultServerFactory) config.getServerFactory();
  }

  @GET
  @Path("/summary")
  @Operation(
      operationId = "getExecutorSummary",
      summary = "Get executor summary",
      description =
          "Returns a comprehensive summary of all executor metrics and system thread information")
  @ApiResponse(
      responseCode = "200",
      description = "Executor summary",
      content =
          @Content(
              mediaType = "application/json",
              schema = @Schema(implementation = ExecutorMonitor.ExecutorSummary.class)))
  @PermitAll
  public ExecutorMonitor.ExecutorSummary getExecutorSummary(
      @Context SecurityContext securityContext) {
    return ExecutorManager.getInstance().getMonitor().getExecutorSummary();
  }

  @GET
  @Path("/metrics")
  @Operation(
      operationId = "getAllExecutorMetrics",
      summary = "Get all executor metrics",
      description = "Returns detailed metrics for all registered executors")
  @ApiResponse(
      responseCode = "200",
      description = "Executor metrics",
      content = @Content(mediaType = "application/json"))
  @PermitAll
  public Map<String, ExecutorMonitor.ExecutorMetrics> getAllExecutorMetrics(
      @Context SecurityContext securityContext) {
    return ExecutorManager.getInstance().getMonitor().getAllExecutorMetrics();
  }

  @GET
  @Path("/metrics/{executorName}")
  @Operation(
      operationId = "getExecutorMetrics",
      summary = "Get metrics for specific executor",
      description = "Returns detailed metrics for a specific executor by name")
  @ApiResponse(
      responseCode = "200",
      description = "Executor metrics",
      content = @Content(mediaType = "application/json"))
  @ApiResponse(responseCode = "404", description = "Executor not found")
  @PermitAll
  public List<ExecutorMonitor.ExecutorMetrics> getExecutorMetrics(
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the executor", schema = @Schema(type = "string"))
          @PathParam("executorName")
          String executorName) {
    List<ExecutorMonitor.ExecutorMetrics> metrics =
        ExecutorManager.getInstance().getMonitor().getExecutorMetrics(executorName);

    if (metrics.isEmpty()) {
      throw new RuntimeException("Executor not found: " + executorName);
    }

    return metrics;
  }

  @GET
  @Path("/system/threads")
  @Operation(
      operationId = "getSystemThreadMetrics",
      summary = "Get system thread metrics",
      description = "Returns comprehensive system-level thread information")
  @ApiResponse(
      responseCode = "200",
      description = "System thread metrics",
      content =
          @Content(
              mediaType = "application/json",
              schema = @Schema(implementation = ExecutorMonitor.SystemThreadMetrics.class)))
  @PermitAll
  public ExecutorMonitor.SystemThreadMetrics getSystemThreadMetrics(
      @Context SecurityContext securityContext) {
    return ExecutorManager.getInstance().getMonitor().collectSystemThreadMetrics();
  }

  @GET
  @Path("/executors")
  @Operation(
      operationId = "listExecutors",
      summary = "List all executors",
      description = "Returns a list of all registered executors with basic information")
  @ApiResponse(
      responseCode = "200",
      description = "List of executors",
      content = @Content(mediaType = "application/json"))
  @PermitAll
  public List<ExecutorInfo> listExecutors(@Context SecurityContext securityContext) {
    return ExecutorManager.getInstance().getAllExecutors().stream()
        .map(
            executor ->
                new ExecutorInfo(
                    executor.getName(),
                    executor.getType().toString(),
                    executor.getCreatedAt(),
                    !executor.getExecutor().isShutdown()))
        .toList();
  }

  @POST
  @Path("/collect-metrics")
  @Operation(
      operationId = "collectMetrics",
      summary = "Trigger metrics collection",
      description = "Manually triggers collection of executor metrics")
  @ApiResponse(responseCode = "200", description = "Metrics collection triggered")
  @PermitAll
  public Response collectMetrics(@Context SecurityContext securityContext) {
    try {
      ExecutorManager.getInstance().getMonitor().collectMetrics();
      return Response.ok()
          .entity(Map.of("message", "Metrics collection triggered successfully"))
          .build();
    } catch (Exception e) {
      LOG.error("Error triggering metrics collection", e);
      return Response.serverError()
          .entity(Map.of("error", "Failed to trigger metrics collection: " + e.getMessage()))
          .build();
    }
  }

  @POST
  @Path("/log-summary")
  @Operation(
      operationId = "logSummary",
      summary = "Log executor summary",
      description = "Logs a comprehensive summary of executor metrics to the server logs")
  @ApiResponse(responseCode = "200", description = "Summary logged successfully")
  @PermitAll
  public Response logSummary(@Context SecurityContext securityContext) {
    try {
      ExecutorManager.getInstance().getMonitor().logSummary();
      return Response.ok()
          .entity(Map.of("message", "Executor summary logged successfully"))
          .build();
    } catch (Exception e) {
      LOG.error("Error logging executor summary", e);
      return Response.serverError()
          .entity(Map.of("error", "Failed to log summary: " + e.getMessage()))
          .build();
    }
  }

  @GET
  @Path("/health")
  @Operation(
      operationId = "getExecutorHealth",
      summary = "Get executor health status",
      description = "Returns health status and potential issues with executors")
  @ApiResponse(
      responseCode = "200",
      description = "Executor health status",
      content = @Content(mediaType = "application/json"))
  @PermitAll
  public ExecutorHealthStatus getExecutorHealth(@Context SecurityContext securityContext) {
    ExecutorMonitor.ExecutorSummary summary =
        ExecutorManager.getInstance().getMonitor().getExecutorSummary();

    boolean healthy = true;
    StringBuilder issues = new StringBuilder();

    if (summary.getTotalRejectedTasks() > 0) {
      healthy = false;
      issues.append("Found ").append(summary.getTotalRejectedTasks()).append(" rejected tasks. ");
    }

    if (summary.getSystemMetrics() != null) {
      ExecutorMonitor.SystemThreadMetrics systemMetrics = summary.getSystemMetrics();

      if (!systemMetrics.getBlockedThreads().isEmpty()) {
        healthy = false;
        issues
            .append("Found ")
            .append(systemMetrics.getBlockedThreads().size())
            .append(" blocked threads. ");
      }

      if (systemMetrics.getTotalThreads() > serverFactory.getMaxThreads()) {
        issues
            .append("High thread count detected: ")
            .append(systemMetrics.getTotalThreads())
            .append(" threads. ");
      }
    }

    for (ExecutorMonitor.ExecutorMetrics metric : summary.getExecutorMetrics()) {
      if (metric.isShutdown() && !metric.isTerminated()) {
        healthy = false;
        issues
            .append("Executor ")
            .append(metric.getName())
            .append(" is shutdown but not terminated. ");
      }
    }

    return new ExecutorHealthStatus(
        healthy,
        issues.length() > 0 ? issues.toString() : "All executors are healthy",
        summary.getTotalExecutors(),
        summary.getTotalActiveThreads(),
        summary.getSystemMetrics() != null ? summary.getSystemMetrics().getTotalThreads() : 0);
  }

  public static class ExecutorInfo {
    public String name;
    public String type;
    public java.time.Instant createdAt;
    public boolean active;

    public ExecutorInfo(String name, String type, java.time.Instant createdAt, boolean active) {
      this.name = name;
      this.type = type;
      this.createdAt = createdAt;
      this.active = active;
    }
  }

  public static class ExecutorHealthStatus {
    public boolean healthy;
    public String message;
    public int totalExecutors;
    public int totalActiveThreads;
    public int totalSystemThreads;

    public ExecutorHealthStatus(
        boolean healthy,
        String message,
        int totalExecutors,
        int totalActiveThreads,
        int totalSystemThreads) {
      this.healthy = healthy;
      this.message = message;
      this.totalExecutors = totalExecutors;
      this.totalActiveThreads = totalActiveThreads;
      this.totalSystemThreads = totalSystemThreads;
    }
  }
}
