package org.openmetadata.service.util;

import io.dropwizard.lifecycle.Managed;
import java.time.Instant;
import java.util.Collection;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledThreadPoolExecutor;
import java.util.concurrent.SynchronousQueue;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.OpenMetadataApplicationConfig;

@Slf4j
public class ExecutorManager implements Managed {
  private static ExecutorManager instance;
  private final ExecutorConfig config;
  private final Map<String, ManagedExecutor> executors = new ConcurrentHashMap<>();
  private final ExecutorMonitor monitor;
  private ScheduledExecutorService monitoringExecutor;

  public static class ExecutorConfig {
    @Getter private final int maxVirtualThreads;
    @Getter private final int maxPlatformThreads;
    @Getter private final int monitoringIntervalSeconds;
    @Getter private final boolean enableMonitoring;
    @Getter private final boolean enableMetrics;

    public ExecutorConfig(OpenMetadataApplicationConfig config) {
      // Use Dropwizard's server configuration for thread limits
      io.dropwizard.core.server.DefaultServerFactory serverFactory =
          (io.dropwizard.core.server.DefaultServerFactory) config.getServerFactory();

      this.maxPlatformThreads = serverFactory.getMaxThreads();
      this.maxVirtualThreads =
          Math.max(this.maxPlatformThreads * 10, 1000); // 10x platform threads or minimum 1000

      // Use system properties for monitoring configuration
      this.monitoringIntervalSeconds =
          Integer.parseInt(System.getProperty("executor.monitoring.interval", "30"));
      this.enableMonitoring =
          Boolean.parseBoolean(System.getProperty("executor.monitoring.enabled", "true"));
      this.enableMetrics =
          Boolean.parseBoolean(System.getProperty("executor.metrics.enabled", "true"));
    }
  }

  public static class ManagedExecutor {
    @Getter private final String name;
    @Getter private final ExecutorType type;
    @Getter private final ExecutorService executor;
    @Getter private final Instant createdAt;
    @Getter private final AtomicInteger submittedTasks = new AtomicInteger(0);
    @Getter private final AtomicInteger completedTasks = new AtomicInteger(0);
    @Getter private final AtomicInteger rejectedTasks = new AtomicInteger(0);

    public ManagedExecutor(String name, ExecutorType type, ExecutorService executor) {
      this.name = name;
      this.type = type;
      this.executor = executor;
      this.createdAt = Instant.now();
    }

    public void incrementSubmitted() {
      submittedTasks.incrementAndGet();
    }

    public void incrementCompleted() {
      completedTasks.incrementAndGet();
    }

    public void incrementRejected() {
      rejectedTasks.incrementAndGet();
    }
  }

  public enum ExecutorType {
    VIRTUAL_THREAD,
    FIXED_THREAD_POOL,
    CACHED_THREAD_POOL,
    SCHEDULED_THREAD_POOL,
    SCHEDULED_VIRTUAL_THREAD,
    SINGLE_THREAD
  }

  private ExecutorManager(ExecutorConfig config) {
    this.config = config;
    this.monitor = new ExecutorMonitor();
  }

  public static synchronized void initialize(OpenMetadataApplicationConfig config) {
    if (instance == null) {
      instance = new ExecutorManager(new ExecutorConfig(config));
      LOG.info(
          "ExecutorManager initialized with Dropwizard config: maxVirtualThreads={}, maxPlatformThreads={}",
          instance.config.getMaxVirtualThreads(),
          instance.config.getMaxPlatformThreads());
    }
  }

  public static ExecutorManager getInstance() {
    if (instance == null) {
      throw new IllegalStateException("ExecutorManager not initialized. Call initialize() first.");
    }
    return instance;
  }

  public ExecutorService getVirtualThreadExecutor(String name, Integer pool) {
    return executors
        .computeIfAbsent(
            name + "-virtual", key -> createManagedExecutor(key, ExecutorType.VIRTUAL_THREAD, pool))
        .getExecutor();
  }

  public ExecutorService getFixedThreadPool(String name, final Integer threads) {
    if (threads > config.getMaxPlatformThreads()) {
      LOG.warn(
          "Requested {} threads for pool '{}' exceeds max platform threads {}. Using max allowed.",
          threads,
          name,
          config.getMaxPlatformThreads());
    }
    return executors
        .computeIfAbsent(
            name + "-fixed-" + threads,
            key ->
                createManagedExecutor(
                    key,
                    ExecutorType.FIXED_THREAD_POOL,
                    threads > config.getMaxPlatformThreads()
                        ? config.getMaxPlatformThreads()
                        : threads))
        .getExecutor();
  }

  public ExecutorService getCachedThreadPool(String name) {
    return executors
        .computeIfAbsent(
            name + "-cached",
            key -> createManagedExecutor(key, ExecutorType.CACHED_THREAD_POOL, null))
        .getExecutor();
  }

  public ScheduledExecutorService getScheduledExecutor(String name, final Integer threads) {
    if (threads > config.getMaxPlatformThreads()) {
      LOG.warn(
          "Requested {} threads for scheduled pool '{}' exceeds max platform threads {}. Using max allowed.",
          threads,
          name,
          config.getMaxPlatformThreads());
    }
    return (ScheduledExecutorService)
        executors
            .computeIfAbsent(
                name + "-scheduled-" + threads,
                key ->
                    createManagedExecutor(
                        key,
                        ExecutorType.SCHEDULED_THREAD_POOL,
                        threads > config.getMaxPlatformThreads()
                            ? config.getMaxPlatformThreads()
                            : threads))
            .getExecutor();
  }

  public ExecutorService getSingleThreadExecutor(String name) {
    return executors
        .computeIfAbsent(
            name + "-single", key -> createManagedExecutor(key, ExecutorType.SINGLE_THREAD, null))
        .getExecutor();
  }

  public ScheduledExecutorService getScheduledVirtualThreadExecutor(String name, int corePoolSize) {
    String key = name + "-scheduled-virtual-" + corePoolSize;
    return (ScheduledExecutorService)
        executors
            .computeIfAbsent(
                key,
                k -> createManagedExecutor(k, ExecutorType.SCHEDULED_VIRTUAL_THREAD, corePoolSize))
            .getExecutor();
  }

  private ManagedExecutor createManagedExecutor(
      String name, ExecutorType type, Integer threadCount) {
    ThreadFactory threadFactory = createThreadFactory(name);
    ExecutorService executor =
        switch (type) {
          case VIRTUAL_THREAD -> createControlledVirtualThreadExecutor(name, threadCount);
          case FIXED_THREAD_POOL -> Executors.newFixedThreadPool(
              threadCount != null ? threadCount : 1, threadFactory);
          case CACHED_THREAD_POOL -> Executors.newCachedThreadPool(threadFactory);
          case SCHEDULED_THREAD_POOL -> Executors.newScheduledThreadPool(
              threadCount != null ? threadCount : 1, threadFactory);
          case SCHEDULED_VIRTUAL_THREAD -> createScheduledVirtualThreadExecutor(
              name, threadCount != null ? threadCount : 1);
          case SINGLE_THREAD -> Executors.newSingleThreadExecutor(threadFactory);
          default -> throw new IllegalArgumentException("Unknown executor type: " + type);
        };

    ManagedExecutor managedExecutor = new ManagedExecutor(name, type, executor);
    LOG.info(
        "Created executor: {} of type: {} with {} threads",
        name,
        type,
        threadCount != null ? threadCount : "unlimited");
    return managedExecutor;
  }

  private ExecutorService createControlledVirtualThreadExecutor(String name, Integer poolSize) {
    int maxVirtualThreads = Math.min(config.getMaxVirtualThreads(), 10000);

    if (poolSize != null) {
      maxVirtualThreads = poolSize;
    }

    ThreadFactory virtualThreadFactory = Thread.ofVirtual().name(name + "-vt-", 0).factory();

    // Use ThreadPoolExecutor for better monitoring and control
    ThreadPoolExecutor virtualExecutor =
        new ThreadPoolExecutor(
            0, // corePoolSize - start with 0
            maxVirtualThreads, // maximumPoolSize - limit virtual threads
            60L,
            TimeUnit.SECONDS, // keepAliveTime
            new SynchronousQueue<>(), // workQueue - direct handoff
            virtualThreadFactory, // threadFactory
            new ThreadPoolExecutor
                .CallerRunsPolicy() // rejectionHandler - run in caller thread if overwhelmed
            );

    // Allow core threads to timeout
    virtualExecutor.allowCoreThreadTimeOut(true);

    LOG.info(
        "Created controlled virtual thread executor '{}' with max threads: {}",
        name,
        maxVirtualThreads);

    return virtualExecutor;
  }

  private ScheduledExecutorService createScheduledVirtualThreadExecutor(
      String name, int corePoolSize) {
    // Create a ScheduledThreadPoolExecutor that uses virtual threads
    ThreadFactory virtualThreadFactory =
        Thread.ofVirtual().name(name + "-scheduled-vt-", 0).factory();

    ScheduledThreadPoolExecutor scheduledVirtualExecutor =
        new ScheduledThreadPoolExecutor(
            Math.min(corePoolSize, config.getMaxPlatformThreads()), // Limit core pool size
            virtualThreadFactory,
            new ThreadPoolExecutor.CallerRunsPolicy() // Handle rejections gracefully
            );

    // Allow core threads to timeout for better resource management
    scheduledVirtualExecutor.allowCoreThreadTimeOut(true);
    scheduledVirtualExecutor.setKeepAliveTime(60, TimeUnit.SECONDS);

    LOG.info(
        "Created scheduled virtual thread executor '{}' with core pool size: {}",
        name,
        corePoolSize);

    return scheduledVirtualExecutor;
  }

  private ThreadFactory createThreadFactory(String name) {
    return new ThreadFactory() {
      private final AtomicInteger threadNumber = new AtomicInteger(1);

      @Override
      public Thread newThread(Runnable r) {
        Thread t = new Thread(r, name + "-" + threadNumber.getAndIncrement());
        t.setDaemon(true);
        return t;
      }
    };
  }

  public Collection<ManagedExecutor> getAllExecutors() {
    return executors.values();
  }

  public ExecutorMonitor getMonitor() {
    return monitor;
  }

  @Override
  public void start() throws Exception {
    if (config.isEnableMonitoring()) {
      monitoringExecutor =
          Executors.newScheduledThreadPool(1, createThreadFactory("executor-monitor"));
      monitoringExecutor.scheduleAtFixedRate(
          monitor::collectMetrics, 0, config.getMonitoringIntervalSeconds(), TimeUnit.SECONDS);
      LOG.info(
          "ExecutorManager monitoring started with interval: {} seconds",
          config.getMonitoringIntervalSeconds());
    }
  }

  @Override
  public void stop() throws Exception {
    LOG.info("Shutting down ExecutorManager...");

    if (monitoringExecutor != null) {
      monitoringExecutor.shutdown();
      if (!monitoringExecutor.awaitTermination(5, TimeUnit.SECONDS)) {
        monitoringExecutor.shutdownNow();
      }
    }

    for (ManagedExecutor managedExecutor : executors.values()) {
      ExecutorService executor = managedExecutor.getExecutor();
      executor.shutdown();
      try {
        if (!executor.awaitTermination(10, TimeUnit.SECONDS)) {
          LOG.warn(
              "Executor {} did not terminate gracefully, forcing shutdown",
              managedExecutor.getName());
          executor.shutdownNow();
          if (!executor.awaitTermination(5, TimeUnit.SECONDS)) {
            LOG.error(
                "Executor {} did not terminate after forced shutdown", managedExecutor.getName());
          }
        }
      } catch (InterruptedException e) {
        LOG.warn(
            "Interrupted while waiting for executor {} to terminate", managedExecutor.getName());
        executor.shutdownNow();
        Thread.currentThread().interrupt();
      }
    }

    executors.clear();
    LOG.info("ExecutorManager shutdown complete");
  }
}
