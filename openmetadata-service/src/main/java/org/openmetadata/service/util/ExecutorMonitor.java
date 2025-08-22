package org.openmetadata.service.util;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.lang.management.ManagementFactory;
import java.lang.management.ThreadInfo;
import java.lang.management.ThreadMXBean;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.atomic.AtomicLong;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;

@Slf4j
public class ExecutorMonitor {
  private final ThreadMXBean threadMXBean;
  private final Map<String, ExecutorMetrics> metricsHistory = new ConcurrentHashMap<>();
  private final AtomicLong lastCollectionTime = new AtomicLong(System.currentTimeMillis());

  public ExecutorMonitor() {
    this.threadMXBean = ManagementFactory.getThreadMXBean();
  }

  @Data
  public static class ExecutorMetrics {
    @JsonProperty private String name;
    @JsonProperty private String type;
    @JsonProperty private Instant timestamp;
    @JsonProperty private long submittedTasks;
    @JsonProperty private long completedTasks;
    @JsonProperty private long rejectedTasks;
    @JsonProperty private int activeThreads;
    @JsonProperty private int poolSize;
    @JsonProperty private int corePoolSize;
    @JsonProperty private int maximumPoolSize;
    @JsonProperty private long queueSize;
    @JsonProperty private boolean isShutdown;
    @JsonProperty private boolean isTerminated;
    @JsonProperty private double cpuTime;
    @JsonProperty private double userTime;
  }

  @Data
  public static class SystemThreadMetrics {
    @JsonProperty private Instant timestamp;
    @JsonProperty private int totalThreads;
    @JsonProperty private int virtualThreads;
    @JsonProperty private int platformThreads;
    @JsonProperty private int daemonThreads;
    @JsonProperty private long totalStartedThreads;
    @JsonProperty private int peakThreads;
    @JsonProperty private Map<Thread.State, Integer> threadsByState;
    @JsonProperty private List<ThreadInfo> blockedThreads;
    @JsonProperty private List<ThreadInfo> waitingThreads;
  }

  @Data
  public static class ExecutorSummary {
    @JsonProperty private Instant timestamp;
    @JsonProperty private int totalExecutors;
    @JsonProperty private long totalSubmittedTasks;
    @JsonProperty private long totalCompletedTasks;
    @JsonProperty private long totalRejectedTasks;
    @JsonProperty private int totalActiveThreads;
    @JsonProperty private int totalPoolSize;
    @JsonProperty private List<ExecutorMetrics> executorMetrics;
    @JsonProperty private SystemThreadMetrics systemMetrics;
  }

  public void collectMetrics() {
    try {
      ExecutorManager manager = ExecutorManager.getInstance();
      Collection<ExecutorManager.ManagedExecutor> executors = manager.getAllExecutors();

      long currentTime = System.currentTimeMillis();
      for (ExecutorManager.ManagedExecutor managedExecutor : executors) {
        ExecutorMetrics metrics = collectExecutorMetrics(managedExecutor);
        metricsHistory.put(managedExecutor.getName(), metrics);
      }

      lastCollectionTime.set(currentTime);

      if (LOG.isDebugEnabled()) {
        LOG.debug("Collected metrics for {} executors", executors.size());
      }
    } catch (Exception e) {
      LOG.error("Error collecting executor metrics", e);
    }
  }

  private ExecutorMetrics collectExecutorMetrics(ExecutorManager.ManagedExecutor managedExecutor) {
    ExecutorMetrics metrics = new ExecutorMetrics();
    metrics.setName(managedExecutor.getName());
    metrics.setType(managedExecutor.getType().toString());
    metrics.setTimestamp(Instant.now());
    metrics.setSubmittedTasks(managedExecutor.getSubmittedTasks().get());
    metrics.setCompletedTasks(managedExecutor.getCompletedTasks().get());
    metrics.setRejectedTasks(managedExecutor.getRejectedTasks().get());

    ExecutorService executor = managedExecutor.getExecutor();
    metrics.setShutdown(executor.isShutdown());
    metrics.setTerminated(executor.isTerminated());

    if (executor instanceof ThreadPoolExecutor) {
      ThreadPoolExecutor tpe = (ThreadPoolExecutor) executor;
      metrics.setActiveThreads(tpe.getActiveCount());
      metrics.setPoolSize(tpe.getPoolSize());
      metrics.setCorePoolSize(tpe.getCorePoolSize());
      metrics.setMaximumPoolSize(tpe.getMaximumPoolSize());
      metrics.setQueueSize(tpe.getQueue().size());

      // Enhanced logging for virtual thread executors
      if (managedExecutor.getType() == ExecutorManager.ExecutorType.VIRTUAL_THREAD
          || managedExecutor.getType() == ExecutorManager.ExecutorType.SCHEDULED_VIRTUAL_THREAD) {
        LOG.debug(
            "Virtual thread executor '{}' [{}]: active={}, pool={}, max={}",
            managedExecutor.getName(),
            managedExecutor.getType(),
            tpe.getActiveCount(),
            tpe.getPoolSize(),
            tpe.getMaximumPoolSize());
      }
    } else {
      metrics.setActiveThreads(-1);
      metrics.setPoolSize(-1);
      metrics.setCorePoolSize(-1);
      metrics.setMaximumPoolSize(-1);
      metrics.setQueueSize(-1);
    }

    return metrics;
  }

  public SystemThreadMetrics collectSystemThreadMetrics() {
    SystemThreadMetrics metrics = new SystemThreadMetrics();
    metrics.setTimestamp(Instant.now());

    ThreadInfo[] allThreads = threadMXBean.dumpAllThreads(false, false);
    metrics.setTotalThreads(allThreads.length);
    metrics.setTotalStartedThreads(threadMXBean.getTotalStartedThreadCount());
    metrics.setPeakThreads(threadMXBean.getPeakThreadCount());
    metrics.setDaemonThreads(threadMXBean.getDaemonThreadCount());

    int virtualThreads = 0;
    int platformThreads = 0;
    Map<Thread.State, Integer> stateCount = new HashMap<>();
    List<ThreadInfo> blockedThreads = new ArrayList<>();
    List<ThreadInfo> waitingThreads = new ArrayList<>();

    for (ThreadInfo thread : allThreads) {
      if (thread != null) {
        if (thread.getThreadName().contains("VirtualThread")) {
          virtualThreads++;
        } else {
          platformThreads++;
        }

        Thread.State state = thread.getThreadState();
        stateCount.merge(state, 1, Integer::sum);

        if (state == Thread.State.BLOCKED) {
          blockedThreads.add(thread);
        } else if (state == Thread.State.WAITING || state == Thread.State.TIMED_WAITING) {
          waitingThreads.add(thread);
        }
      }
    }

    metrics.setVirtualThreads(virtualThreads);
    metrics.setPlatformThreads(platformThreads);
    metrics.setThreadsByState(stateCount);
    metrics.setBlockedThreads(blockedThreads);
    metrics.setWaitingThreads(waitingThreads);

    return metrics;
  }

  public ExecutorSummary getExecutorSummary() {
    ExecutorSummary summary = new ExecutorSummary();
    summary.setTimestamp(Instant.now());

    Collection<ExecutorMetrics> metrics = metricsHistory.values();
    summary.setExecutorMetrics(new ArrayList<>(metrics));
    summary.setTotalExecutors(metrics.size());

    long totalSubmitted = 0;
    long totalCompleted = 0;
    long totalRejected = 0;
    int totalActive = 0;
    int totalPoolSize = 0;

    for (ExecutorMetrics metric : metrics) {
      totalSubmitted += metric.getSubmittedTasks();
      totalCompleted += metric.getCompletedTasks();
      totalRejected += metric.getRejectedTasks();
      if (metric.getActiveThreads() > 0) {
        totalActive += metric.getActiveThreads();
      }
      if (metric.getPoolSize() > 0) {
        totalPoolSize += metric.getPoolSize();
      }
    }

    summary.setTotalSubmittedTasks(totalSubmitted);
    summary.setTotalCompletedTasks(totalCompleted);
    summary.setTotalRejectedTasks(totalRejected);
    summary.setTotalActiveThreads(totalActive);
    summary.setTotalPoolSize(totalPoolSize);
    summary.setSystemMetrics(collectSystemThreadMetrics());

    return summary;
  }

  public List<ExecutorMetrics> getExecutorMetrics(String executorName) {
    ExecutorMetrics metrics = metricsHistory.get(executorName);
    return metrics != null ? Arrays.asList(metrics) : new ArrayList<>();
  }

  public Map<String, ExecutorMetrics> getAllExecutorMetrics() {
    return new HashMap<>(metricsHistory);
  }

  public void logSummary() {
    ExecutorSummary summary = getExecutorSummary();
    SystemThreadMetrics systemMetrics = summary.getSystemMetrics();

    LOG.info("=== Executor Summary ===");
    LOG.info("Total Executors: {}", summary.getTotalExecutors());
    LOG.info("Total Submitted Tasks: {}", summary.getTotalSubmittedTasks());
    LOG.info("Total Completed Tasks: {}", summary.getTotalCompletedTasks());
    LOG.info("Total Rejected Tasks: {}", summary.getTotalRejectedTasks());
    LOG.info("Total Active Threads: {}", summary.getTotalActiveThreads());
    LOG.info("Total Pool Size: {}", summary.getTotalPoolSize());

    LOG.info("=== System Thread Metrics ===");
    LOG.info(
        "Total Threads: {} (Virtual: {}, Platform: {})",
        systemMetrics.getTotalThreads(),
        systemMetrics.getVirtualThreads(),
        systemMetrics.getPlatformThreads());
    LOG.info("Peak Threads: {}", systemMetrics.getPeakThreads());
    LOG.info("Daemon Threads: {}", systemMetrics.getDaemonThreads());
    LOG.info("Total Started Threads: {}", systemMetrics.getTotalStartedThreads());

    if (systemMetrics.getThreadsByState() != null) {
      LOG.info("Threads by State: {}", systemMetrics.getThreadsByState());
    }

    if (!systemMetrics.getBlockedThreads().isEmpty()) {
      LOG.warn("Blocked Threads Count: {}", systemMetrics.getBlockedThreads().size());
    }

    if (!systemMetrics.getWaitingThreads().isEmpty()) {
      LOG.info("Waiting Threads Count: {}", systemMetrics.getWaitingThreads().size());
    }

    LOG.info("=== Individual Executor Metrics ===");
    for (ExecutorMetrics metric : summary.getExecutorMetrics()) {
      LOG.info(
          "Executor: {} [{}] - Submitted: {}, Completed: {}, Rejected: {}, Active: {}, Pool: {}",
          metric.getName(),
          metric.getType(),
          metric.getSubmittedTasks(),
          metric.getCompletedTasks(),
          metric.getRejectedTasks(),
          metric.getActiveThreads() >= 0 ? metric.getActiveThreads() : "N/A",
          metric.getPoolSize() >= 0 ? metric.getPoolSize() : "N/A");
    }
  }
}
