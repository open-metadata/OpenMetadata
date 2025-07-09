package org.openmetadata.service.monitoring;

import io.micrometer.core.instrument.Metrics;
import io.micrometer.core.instrument.Timer;
import java.util.concurrent.TimeUnit;

/**
 * Compatibility layer for legacy metrics usage.
 * This class provides static methods that match the old MicrometerBundleSingleton API
 * but use the new Micrometer-based implementation underneath.
 * 
 * This allows existing code to work without modification during migration.
 */
public class LegacyMetricsCompat {
  
  /**
   * HTTP request timer compatible with old Histogram API
   */
  public static class HttpRequestsCompat {
    public static void observe(String method, double duration) {
      Timer timer = Metrics.timer("http_server_requests_sec", "method", method);
      timer.record((long)(duration * 1000), TimeUnit.MILLISECONDS);
    }
    
    public static HttpRequestsCompat labels(String method) {
      return new HttpRequestsCompat();
    }
    
    public void observe(double duration) {
      // This is called after labels(), so we don't have the method here
      // In practice, the old code should be migrated to use the static observe method
      Timer timer = Metrics.timer("http_server_requests_sec");
      timer.record((long)(duration * 1000), TimeUnit.MILLISECONDS);
    }
  }
  
  /**
   * JDBI request timer compatible with old Histogram API
   */
  public static class JdbiRequestsCompat {
    public static void observe(double duration) {
      Timer timer = Metrics.timer("jdbi_requests_seconds");
      timer.record((long)(duration * 1000), TimeUnit.MILLISECONDS);
    }
  }
  
  /**
   * Pipeline client status counter compatible with old Counter API
   */
  public static class PipelineClientStatusCounterCompat {
    private final String operation;
    private final String status;
    
    private PipelineClientStatusCounterCompat(String operation, String status) {
      this.operation = operation;
      this.status = status;
    }
    
    public static PipelineClientStatusCounterCompat labels(String operation, String status) {
      return new PipelineClientStatusCounterCompat(operation, status);
    }
    
    public void inc() {
      Metrics.counter("pipeline_client_request_status", 
          "operation", operation, 
          "status", status)
          .increment();
    }
  }
  
  // Expose as static fields to match old API
  public static final HttpRequestsCompat httpRequests = new HttpRequestsCompat();
  public static final JdbiRequestsCompat jdbiRequests = new JdbiRequestsCompat();
  public static final PipelineClientStatusCounterCompat pipelineClientStatusCounter = 
      new PipelineClientStatusCounterCompat(null, null);
  
  /**
   * Initialize latency timers (for compatibility)
   */
  public static void initLatencyEvents() {
    // Already initialized in MicrometerBundle
    // This method exists for compatibility only
  }
  
  /**
   * Get request latency timer
   */
  public static Timer getRequestsLatencyTimer() {
    return Metrics.timer("http.latency.requests");
  }
  
  /**
   * Get JDBI latency timer
   */
  public static Timer getJdbiLatencyTimer() {
    return Metrics.timer("jdbi.latency.requests");
  }
}