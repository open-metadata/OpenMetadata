/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.resources.system;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.Meter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Metrics;
import io.micrometer.core.instrument.Timer;
import io.micrometer.core.instrument.distribution.HistogramSnapshot;
import io.micrometer.core.instrument.distribution.ValueAtPercentile;
import io.micrometer.core.instrument.search.Search;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import java.lang.management.GarbageCollectorMXBean;
import java.lang.management.ManagementFactory;
import java.lang.management.MemoryMXBean;
import java.lang.management.MemoryUsage;
import java.lang.management.OperatingSystemMXBean;
import java.lang.management.RuntimeMXBean;
import java.lang.management.ThreadMXBean;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.jdbi3.BulkExecutor;
import org.openmetadata.service.security.Authorizer;

@Path("/v1/system/diagnostics")
@Tag(
    name = "System",
    description = "System diagnostics providing a performance snapshot for load test correlation")
@Produces(MediaType.APPLICATION_JSON)
@Slf4j
public class DiagnosticsResource {
  private final Authorizer authorizer;

  public DiagnosticsResource(Authorizer authorizer) {
    this.authorizer = authorizer;
  }

  @GET
  @Operation(
      operationId = "getSystemDiagnostics",
      summary = "Get system diagnostics",
      description =
          "Returns a structured performance snapshot including JVM, Jetty thread pool, "
              + "database connection pool, bulk executor, and per-endpoint latency breakdown.",
      responses = {
        @ApiResponse(responseCode = "200", description = "Diagnostics snapshot"),
      })
  public Response getDiagnostics(@Context SecurityContext securityContext) {
    authorizer.authorizeAdmin(securityContext);
    Map<String, Object> diagnostics = new LinkedHashMap<>();
    diagnostics.put("timestamp", Instant.now().toString());
    diagnostics.put("jvm", collectJvmMetrics());
    diagnostics.put("jetty", collectJettyMetrics());
    diagnostics.put("database", collectDatabaseMetrics());
    diagnostics.put("bulk_executor", collectBulkExecutorMetrics());
    diagnostics.put("database_queries", collectDatabaseQueryMetrics());
    diagnostics.put("request_latency", collectRequestLatencyMetrics());
    return Response.ok(diagnostics).build();
  }

  private Map<String, Object> collectJvmMetrics() {
    Map<String, Object> jvm = new LinkedHashMap<>();

    MemoryMXBean memoryBean = ManagementFactory.getMemoryMXBean();
    MemoryUsage heapUsage = memoryBean.getHeapMemoryUsage();
    MemoryUsage nonHeapUsage = memoryBean.getNonHeapMemoryUsage();

    long heapUsed = heapUsage.getUsed();
    long heapMax = heapUsage.getMax();
    jvm.put("heap_used_bytes", heapUsed);
    jvm.put("heap_max_bytes", heapMax);
    jvm.put("heap_usage_pct", heapMax > 0 ? Math.round(heapUsed * 1000.0 / heapMax) / 10.0 : 0.0);
    jvm.put("non_heap_used_bytes", nonHeapUsage.getUsed());

    long gcPauseTotalMs = 0;
    long gcCount = 0;
    for (GarbageCollectorMXBean gcBean : ManagementFactory.getGarbageCollectorMXBeans()) {
      gcPauseTotalMs += gcBean.getCollectionTime();
      gcCount += gcBean.getCollectionCount();
    }
    jvm.put("gc_pause_total_ms", gcPauseTotalMs);
    jvm.put("gc_count", gcCount);

    ThreadMXBean threadBean = ManagementFactory.getThreadMXBean();
    jvm.put("thread_count", threadBean.getThreadCount());
    jvm.put("thread_peak", threadBean.getPeakThreadCount());

    OperatingSystemMXBean osBean = ManagementFactory.getOperatingSystemMXBean();
    if (osBean instanceof com.sun.management.OperatingSystemMXBean sunOsBean) {
      double processCpu = sunOsBean.getProcessCpuLoad();
      double systemCpu = sunOsBean.getCpuLoad();
      jvm.put("cpu_process_pct", Math.round(processCpu * 1000.0) / 10.0);
      jvm.put("cpu_system_pct", Math.round(systemCpu * 1000.0) / 10.0);
    } else {
      jvm.put("cpu_process_pct", -1.0);
      jvm.put("cpu_system_pct", -1.0);
    }

    RuntimeMXBean runtimeBean = ManagementFactory.getRuntimeMXBean();
    jvm.put("uptime_seconds", runtimeBean.getUptime() / 1000);

    return jvm;
  }

  private Map<String, Object> collectJettyMetrics() {
    Map<String, Object> jetty = new LinkedHashMap<>();
    MeterRegistry registry = Metrics.globalRegistry;

    jetty.put("threads_current", gaugeValue(registry, "jetty.threads.current"));
    jetty.put("threads_busy", gaugeValue(registry, "jetty.threads.busy"));
    jetty.put("threads_idle", gaugeValue(registry, "jetty.threads.idle"));
    jetty.put("threads_max", gaugeValue(registry, "jetty.threads.max"));

    double current = gaugeValue(registry, "jetty.threads.current");
    double busy = gaugeValue(registry, "jetty.threads.busy");
    jetty.put("utilization_pct", current > 0 ? Math.round(busy / current * 1000.0) / 10.0 : 0.0);

    jetty.put("queue_size", gaugeValue(registry, "jetty.queue.size"));
    jetty.put("queue_time_avg_ms", gaugeValue(registry, "jetty.request.queue.time.ms"));
    jetty.put("active_requests", gaugeValue(registry, "jetty.requests.active"));

    double virtualEnabled = gaugeValue(registry, "jetty.virtual.threads.enabled");
    jetty.put("virtual_threads_enabled", virtualEnabled > 0);

    return jetty;
  }

  private Map<String, Object> collectDatabaseMetrics() {
    Map<String, Object> db = new LinkedHashMap<>();
    MeterRegistry registry = Metrics.globalRegistry;

    double active = gaugeValue(registry, "hikaricp.connections.active");
    double idle = gaugeValue(registry, "hikaricp.connections.idle");
    double total = active + idle;
    double max = gaugeValue(registry, "hikaricp.connections.max");
    double pending = gaugeValue(registry, "hikaricp.connections.pending");

    db.put("pool_active", (int) active);
    db.put("pool_idle", (int) idle);
    db.put("pool_total", (int) total);
    db.put("pool_max", (int) max);
    db.put("pool_pending", (int) pending);
    db.put("pool_usage_pct", max > 0 ? Math.round(active / max * 1000.0) / 10.0 : 0.0);

    double timeoutMs = gaugeValue(registry, "hikaricp.connections.timeout");
    db.put("connection_timeout_ms", timeoutMs > 0 ? (long) timeoutMs : 30000L);

    Timer acquireTimer = registry.find("hikaricp.connections.acquire").timer();
    if (acquireTimer != null && acquireTimer.count() > 0) {
      db.put(
          "connection_acquire_avg_ms",
          Math.round(acquireTimer.mean(TimeUnit.MILLISECONDS) * 10.0) / 10.0);
      db.put(
          "connection_acquire_max_ms",
          Math.round(acquireTimer.max(TimeUnit.MILLISECONDS) * 10.0) / 10.0);
      db.put("connection_acquire_count", acquireTimer.count());
    }

    return db;
  }

  private Map<String, Object> collectDatabaseQueryMetrics() {
    Map<String, Object> queries = new LinkedHashMap<>();
    MeterRegistry registry = Metrics.globalRegistry;
    long totalOperations = 0;

    for (String queryType : new String[] {"select", "insert", "update", "delete"}) {
      Search search = registry.find("db.query.duration").tag("type", queryType);
      long count = 0;
      double totalMs = 0;
      double maxMs = 0;
      double p95Ms = 0;
      for (Meter meter : search.meters()) {
        if (!(meter instanceof Timer timer) || timer.count() == 0) {
          continue;
        }
        count += timer.count();
        totalMs += timer.totalTime(TimeUnit.MILLISECONDS);
        maxMs = Math.max(maxMs, timer.max(TimeUnit.MILLISECONDS));
        HistogramSnapshot snapshot = timer.takeSnapshot();
        for (ValueAtPercentile vap : snapshot.percentileValues()) {
          if (Math.abs(vap.percentile() - 0.95) < 0.001) {
            p95Ms = Math.max(p95Ms, vap.value(TimeUnit.MILLISECONDS));
          }
        }
      }
      if (count > 0) {
        totalOperations += count;
        double meanMs = totalMs / count;
        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("count", count);
        entry.put("mean_ms", Math.round(meanMs * 10.0) / 10.0);
        entry.put("max_ms", Math.round(maxMs * 10.0) / 10.0);
        entry.put("total_ms", Math.round(totalMs * 10.0) / 10.0);
        if (p95Ms > 0) {
          entry.put("p95_ms", Math.round(p95Ms * 10.0) / 10.0);
        }
        queries.put(queryType, entry);
      }
    }

    queries.put("total_operations", totalOperations);
    return queries;
  }

  private Map<String, Object> collectBulkExecutorMetrics() {
    Map<String, Object> bulk = new LinkedHashMap<>();

    try {
      BulkExecutor executor = BulkExecutor.getInstance();
      int maxThreads = executor.getMaxThreads();
      int activeThreads = executor.getActiveCount();
      int queueDepth = executor.getQueueDepth();
      int queueCapacity = executor.getQueueSize();

      bulk.put("max_threads", maxThreads);
      bulk.put("active_threads", activeThreads);
      bulk.put("queue_depth", queueDepth);
      bulk.put("queue_capacity", queueCapacity);
      bulk.put(
          "queue_usage_pct",
          queueCapacity > 0 ? Math.round(queueDepth * 1000.0 / queueCapacity) / 10.0 : 0.0);
      bulk.put("has_capacity", executor.hasCapacity());
    } catch (Exception e) {
      LOG.debug("Could not collect BulkExecutor metrics: {}", e.getMessage());
      bulk.put("error", "BulkExecutor not available");
    }

    return bulk;
  }

  private Map<String, Object> collectRequestLatencyMetrics() {
    Map<String, Object> latencyMap = new LinkedHashMap<>();
    MeterRegistry registry = Metrics.globalRegistry;

    Search totalTimerSearch = registry.find("request.latency.total");
    for (Meter meter : totalTimerSearch.meters()) {
      if (!(meter instanceof Timer totalTimer)) {
        continue;
      }

      String endpoint =
          totalTimer.getId().getTag("endpoint") != null
              ? totalTimer.getId().getTag("endpoint")
              : "unknown";
      String method =
          totalTimer.getId().getTag("method") != null
              ? totalTimer.getId().getTag("method")
              : "unknown";
      String key = method + " " + endpoint;

      long count = totalTimer.count();
      if (count == 0) {
        continue;
      }

      double avgTotalMs = totalTimer.mean(TimeUnit.MILLISECONDS);

      double avgDbMs = timerMean(registry, "request.latency.database", endpoint, method);
      double avgSearchMs = timerMean(registry, "request.latency.search", endpoint, method);
      double avgInternalMs = timerMean(registry, "request.latency.internal", endpoint, method);

      double dbPct = avgTotalMs > 0 ? Math.round(avgDbMs / avgTotalMs * 1000.0) / 10.0 : 0.0;
      double searchPct =
          avgTotalMs > 0 ? Math.round(avgSearchMs / avgTotalMs * 1000.0) / 10.0 : 0.0;
      double internalPct =
          avgTotalMs > 0 ? Math.round(avgInternalMs / avgTotalMs * 1000.0) / 10.0 : 0.0;

      double avgDbOps = summaryMean(registry, "request.operations.database", endpoint, method);
      double avgSearchOps = summaryMean(registry, "request.operations.search", endpoint, method);

      Map<String, Object> entry = new LinkedHashMap<>();
      entry.put("count", count);
      entry.put("avg_total_ms", Math.round(avgTotalMs * 10.0) / 10.0);
      entry.put("avg_db_ms", Math.round(avgDbMs * 10.0) / 10.0);
      entry.put("avg_search_ms", Math.round(avgSearchMs * 10.0) / 10.0);
      entry.put("avg_internal_ms", Math.round(avgInternalMs * 10.0) / 10.0);
      entry.put("db_pct", dbPct);
      entry.put("search_pct", searchPct);
      entry.put("internal_pct", internalPct);
      entry.put("avg_db_ops", Math.round(avgDbOps * 10.0) / 10.0);
      entry.put("avg_search_ops", Math.round(avgSearchOps * 10.0) / 10.0);

      latencyMap.put(key, entry);
    }

    return latencyMap;
  }

  private static double gaugeValue(MeterRegistry registry, String name) {
    Gauge gauge = registry.find(name).gauge();
    if (gauge != null) {
      return gauge.value();
    }
    return 0.0;
  }

  private static double timerMean(
      MeterRegistry registry, String name, String endpoint, String method) {
    Timer timer = registry.find(name).tag("endpoint", endpoint).tag("method", method).timer();
    if (timer != null && timer.count() > 0) {
      return timer.mean(TimeUnit.MILLISECONDS);
    }
    return 0.0;
  }

  private static double summaryMean(
      MeterRegistry registry, String name, String endpoint, String method) {
    io.micrometer.core.instrument.DistributionSummary summary =
        registry.find(name).tag("endpoint", endpoint).tag("method", method).summary();
    if (summary != null && summary.count() > 0) {
      return summary.mean();
    }
    return 0.0;
  }
}
