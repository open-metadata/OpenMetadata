package org.openmetadata.service.monitoring;

import io.dropwizard.lifecycle.Managed;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Tags;
import io.micrometer.core.instrument.binder.MeterBinder;
import java.lang.management.ManagementFactory;
import java.lang.management.ThreadMXBean;
import java.util.concurrent.atomic.AtomicLong;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.util.thread.QueuedThreadPool;
import org.eclipse.jetty.util.thread.ThreadPool;

@Slf4j
public class JettyMetrics implements MeterBinder, Managed {
  private final Server server;
  private QueuedThreadPool threadPool;
  private final AtomicLong requestQueueTime = new AtomicLong(0);
  private final AtomicLong activeRequests = new AtomicLong(0);

  public JettyMetrics(Server server) {
    this.server = server;
  }

  @Override
  public void start() throws Exception {
    if (server == null) {
      LOG.debug("JettyMetrics created without server - metrics will be initialized later");
      return;
    }

    ThreadPool pool = server.getThreadPool();
    if (pool instanceof QueuedThreadPool) {
      this.threadPool = (QueuedThreadPool) pool;
      LOG.info(
          "Jetty metrics initialized - Thread pool: min={}, max={}",
          threadPool.getMinThreads(),
          threadPool.getMaxThreads());
    }
  }

  @Override
  public void stop() throws Exception {
    // Nothing to stop
  }

  @Override
  public void bindTo(MeterRegistry registry) {
    if (server == null) {
      LOG.debug("JettyMetrics bindTo called without server - skipping metrics registration");
      return;
    }

    if (threadPool == null) {
      ThreadPool pool = server.getThreadPool();
      if (pool instanceof QueuedThreadPool) {
        this.threadPool = (QueuedThreadPool) pool;
      } else {
        LOG.warn("Server thread pool is not QueuedThreadPool, metrics unavailable");
        return;
      }
    }

    Tags tags = Tags.of("component", "jetty");

    // Thread pool metrics
    Gauge.builder("jetty.threads.current", threadPool, QueuedThreadPool::getThreads)
        .description("Current number of threads in the pool")
        .tags(tags)
        .register(registry);

    Gauge.builder("jetty.threads.busy", threadPool, QueuedThreadPool::getBusyThreads)
        .description("Number of busy threads")
        .tags(tags)
        .register(registry);

    Gauge.builder("jetty.threads.idle", threadPool, QueuedThreadPool::getIdleThreads)
        .description("Number of idle threads")
        .tags(tags)
        .register(registry);

    Gauge.builder("jetty.threads.min", threadPool, QueuedThreadPool::getMinThreads)
        .description("Minimum number of threads")
        .tags(tags)
        .register(registry);

    Gauge.builder("jetty.threads.max", threadPool, QueuedThreadPool::getMaxThreads)
        .description("Maximum number of threads")
        .tags(tags)
        .register(registry);

    // Queue metrics
    Gauge.builder(
            "jetty.queue.size",
            threadPool,
            tp -> {
              // QueuedThreadPool uses a BlockingQueue, we can get the queue and check its size
              return tp.getQueueSize();
            })
        .description("Number of requests queued")
        .tags(tags)
        .register(registry);

    // Queue capacity is not directly available, use max threads as a proxy
    Gauge.builder(
            "jetty.queue.capacity",
            threadPool,
            tp -> {
              // The queue capacity is typically Integer.MAX_VALUE for QueuedThreadPool
              // We'll use a more meaningful metric - available thread capacity
              return tp.getMaxThreads() - tp.getBusyThreads();
            })
        .description("Available thread capacity")
        .tags(tags)
        .register(registry);

    // Thread pool utilization percentage
    Gauge.builder(
            "jetty.threads.utilization",
            threadPool,
            tp -> {
              int busy = tp.getBusyThreads();
              int current = tp.getThreads();
              return current > 0 ? (double) busy / current * 100.0 : 0.0;
            })
        .description("Thread pool utilization percentage")
        .tags(tags)
        .register(registry);

    // Queue saturation - using queue size relative to max threads
    Gauge.builder(
            "jetty.queue.utilization",
            threadPool,
            tp -> {
              int queueSize = tp.getQueueSize();
              int maxThreads = tp.getMaxThreads();
              // If queue size exceeds max threads, that's concerning
              return maxThreads > 0
                  ? Math.min((double) queueSize / maxThreads * 100.0, 100.0)
                  : 0.0;
            })
        .description("Queue saturation (queue size / max threads)")
        .tags(tags)
        .register(registry);

    // Request queue time (needs to be updated from request handlers)
    Gauge.builder("jetty.request.queue.time.ms", requestQueueTime, AtomicLong::get)
        .description("Average time requests spend in queue (ms)")
        .tags(tags)
        .register(registry);

    // Active requests
    Gauge.builder("jetty.requests.active", activeRequests, AtomicLong::get)
        .description("Number of requests currently being processed")
        .tags(tags)
        .register(registry);

    // Virtual threads metrics (if enabled)
    if (isVirtualThreadsEnabled()) {
      ThreadMXBean threadMXBean = ManagementFactory.getThreadMXBean();

      Gauge.builder("jvm.threads.total", threadMXBean, ThreadMXBean::getThreadCount)
          .description("Total number of threads (including virtual)")
          .tags(tags)
          .register(registry);

      Gauge.builder("jvm.threads.peak", threadMXBean, ThreadMXBean::getPeakThreadCount)
          .description("Peak thread count")
          .tags(tags)
          .register(registry);

      // Platform threads vs virtual threads
      Gauge.builder(
              "jvm.threads.platform",
              threadMXBean,
              bean -> {
                // This is an approximation - actual platform threads
                return threadPool.getThreads();
              })
          .description("Number of platform threads")
          .tags(tags)
          .register(registry);

      Gauge.builder(
              "jvm.threads.virtual",
              threadMXBean,
              bean -> {
                // Virtual threads = total - platform
                return Math.max(0, bean.getThreadCount() - threadPool.getThreads());
              })
          .description("Number of virtual threads (estimated)")
          .tags(tags)
          .register(registry);
    }

    // Connection metrics - simplified version
    Gauge.builder(
            "jetty.connectors.count",
            server,
            srv -> {
              // Just count the number of connectors
              return srv.getConnectors().length;
            })
        .description("Number of server connectors")
        .tags(tags)
        .register(registry);

    LOG.info("Jetty metrics registered with Prometheus");
  }

  private boolean isVirtualThreadsEnabled() {
    String virtualThreadsEnabled = System.getenv("SERVER_ENABLE_VIRTUAL_THREAD");
    return "true".equalsIgnoreCase(virtualThreadsEnabled);
  }

  public void recordRequestQueueTime(long queueTimeMs) {
    // Use exponential moving average for smooth metric
    long current = requestQueueTime.get();
    long newAvg = (current * 9 + queueTimeMs) / 10;
    requestQueueTime.set(newAvg);
  }

  public void incrementActiveRequests() {
    activeRequests.incrementAndGet();
  }

  public void decrementActiveRequests() {
    activeRequests.decrementAndGet();
  }
}
