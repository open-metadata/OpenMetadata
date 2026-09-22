package org.openmetadata.service.jobs;

import io.dropwizard.lifecycle.Managed;
import java.time.Duration;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.jobs.BackgroundJob;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.socket.WebSocketManager;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class GenericBackgroundWorker implements Managed {

  private static final int INITIAL_BACKOFF_SECONDS = 1;
  private static final int MAX_BACKOFF_SECONDS = 600; // 10 minutes
  public static final int NO_JOB_SLEEP_SECONDS = 10; // Sleep if no jobs are available
  // A single long-running job (e.g. a recursive CSV export of a large service)
  // must not head-of-line-block every other queued job, so jobs execute on a
  // small pool. Jobs are claimed atomically before submission, which also
  // prevents double execution across pool threads and across servers.
  public static final int WORKER_POOL_SIZE = 3;

  static final Duration RUNNING_JOB_STALE_AFTER = Duration.ofMinutes(5);

  // Keep this comfortably below RUNNING_JOB_STALE_AFTER so cleanup cannot claim work owned by a
  // live server.
  private static final long HEARTBEAT_SECONDS = 60L;

  private final JobDAO jobDao;
  private final JobHandlerRegistry handlerRegistry;
  private final Semaphore workerSlots = new Semaphore(WORKER_POOL_SIZE);
  // Bounded by WORKER_POOL_SIZE — a job is added when claimed and removed when it finishes.
  private final Set<Long> inFlightJobIds = ConcurrentHashMap.newKeySet();
  private volatile boolean running = true;
  private Thread pollerThread;
  private ExecutorService workerPool;
  private ScheduledExecutorService heartbeatScheduler;

  public GenericBackgroundWorker(JobDAO jobDao, JobHandlerRegistry handlerRegistry) {
    this.jobDao = jobDao;
    this.handlerRegistry = handlerRegistry;
  }

  @Override
  public void start() {
    LOG.info("Starting background job worker with {} executor threads", WORKER_POOL_SIZE);
    running = true;
    workerPool = createWorkerPool();
    heartbeatScheduler = createHeartbeatScheduler();
    pollerThread = new Thread(this::runWorker, "background-job-poller");
    pollerThread.setDaemon(true);
    pollerThread.start();
  }

  private ScheduledExecutorService createHeartbeatScheduler() {
    ScheduledExecutorService scheduler =
        Executors.newSingleThreadScheduledExecutor(
            runnable -> {
              Thread thread = new Thread(runnable, "background-job-heartbeat");
              thread.setDaemon(true);
              return thread;
            });
    scheduler.scheduleWithFixedDelay(
        this::heartbeatInFlightJobs, HEARTBEAT_SECONDS, HEARTBEAT_SECONDS, TimeUnit.SECONDS);
    return scheduler;
  }

  // Tells the cluster these jobs still have a live owner. Without it a long export
  // that reports no progress for a while — the gather phase of a large recursive
  // export, say — would look orphaned and be failed out from under itself.
  private void heartbeatInFlightJobs() {
    long now = System.currentTimeMillis();
    for (Long jobId : inFlightJobIds) {
      try {
        jobDao.touchJob(jobId, now);
      } catch (Exception e) {
        LOG.warn("Failed to heartbeat background job {}", jobId, e);
      }
    }
  }

  @Override
  public void stop() {
    running = false;
    if (heartbeatScheduler != null) {
      heartbeatScheduler.shutdownNow();
    }
    if (pollerThread != null) {
      pollerThread.interrupt();
      try {
        pollerThread.join(TimeUnit.SECONDS.toMillis(5));
        if (pollerThread.isAlive()) {
          LOG.warn("Background job poller did not terminate within timeout.");
        }
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
      }
    }
    if (workerPool != null) {
      workerPool.shutdownNow();
      try {
        if (!workerPool.awaitTermination(5, TimeUnit.SECONDS)) {
          LOG.warn("Background job worker pool did not terminate within timeout.");
        }
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
      }
    }
  }

  private ExecutorService createWorkerPool() {
    AtomicInteger threadSequence = new AtomicInteger();
    return Executors.newFixedThreadPool(
        WORKER_POOL_SIZE,
        runnable -> {
          Thread thread =
              new Thread(runnable, "background-job-worker-" + threadSequence.incrementAndGet());
          thread.setDaemon(true);
          return thread;
        });
  }

  private void runWorker() {
    int backoff = INITIAL_BACKOFF_SECONDS;

    while (running) {
      try {
        boolean dispatched = pollAndDispatch();
        if (dispatched) {
          backoff = INITIAL_BACKOFF_SECONDS; // Reset backoff after successful dispatch
        }
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        running = false;
      } catch (Exception e) {
        LOG.error("Unexpected error in background job worker: {}", e.getMessage(), e);
        backoff = Math.min(backoff * 5, MAX_BACKOFF_SECONDS); // Exponential backoff with max limit
        try {
          sleep(backoff);
        } catch (InterruptedException interruptedException) {
          Thread.currentThread().interrupt();
          running = false;
        }
      }
    }

    LOG.info("Background job worker terminated successfully.");
  }

  // Claims at most one PENDING job and hands it to the pool. Holds a worker
  // slot only while a claimed job is in flight; when the queue is empty the
  // slot is released and the poller sleeps.
  private boolean pollAndDispatch() throws InterruptedException {
    boolean dispatched = false;
    workerSlots.acquire();
    boolean slotHandedToTask = false;
    try {
      if (!running) {
        return false;
      }
      Optional<BackgroundJob> jobOpt = jobDao.fetchPendingJob();
      if (running && jobOpt.isPresent() && jobDao.claimPendingJob(jobOpt.get().getId()) > 0) {
        BackgroundJob job = jobOpt.get();
        workerPool.submit(() -> runClaimedJob(job));
        slotHandedToTask = true;
        dispatched = true;
      } else if (jobOpt.isEmpty()) {
        sleep(NO_JOB_SLEEP_SECONDS);
      }
      // A present-but-unclaimed job was taken by another worker/server; loop
      // again immediately to pick up the next pending job.
    } finally {
      if (!slotHandedToTask) {
        workerSlots.release();
      }
    }
    return dispatched;
  }

  private void runClaimedJob(BackgroundJob job) {
    inFlightJobIds.add(job.getId());
    try {
      processJob(job);
    } catch (Exception e) {
      LOG.error("Background Job {} failed with unexpected error", job.getId(), e);
      jobDao.updateJobStatus(job.getId(), BackgroundJob.Status.FAILED);
    } finally {
      inFlightJobIds.remove(job.getId());
      workerSlots.release();
    }
  }

  private void processJob(BackgroundJob job) {
    try {
      JobHandler handler = handlerRegistry.getHandler(job);
      handler.runJob(job);
      if (isTerminal(job)) {
        if (handler.sendStatusToWebSocket()) {
          sendJobStatusUpdate(job);
        }
        return;
      }
      markJobAsCompleted(job);

      if (handler.sendStatusToWebSocket()) {
        sendJobStatusUpdate(job);
      }
    } catch (BackgroundJobException e) {
      markJobAsFailed(job, e);
      sendJobStatusUpdate(job);
    }
  }

  private void markJobAsCompleted(BackgroundJob job) {
    job.setStatus(BackgroundJob.Status.COMPLETED);
    jobDao.updateJobStatus(job.getId(), BackgroundJob.Status.COMPLETED);
    LOG.info(
        "Background Job {} completed successfully. Type: {}, Method: {}",
        job.getId(),
        job.getJobType(),
        job.getMethodName());
  }

  private boolean isTerminal(BackgroundJob job) {
    Optional<BackgroundJob> updatedJob = jobDao.fetchJobById(job.getId());
    if (updatedJob.isEmpty()) {
      return false;
    }
    BackgroundJob.Status status = updatedJob.get().getStatus();
    return status == BackgroundJob.Status.COMPLETED
        || status == BackgroundJob.Status.FAILED
        || status == BackgroundJob.Status.CANCELLED;
  }

  private void markJobAsFailed(BackgroundJob job, Exception e) {
    job.setStatus(BackgroundJob.Status.FAILED);
    jobDao.updateJobStatus(job.getId(), BackgroundJob.Status.FAILED);
    LOG.error(
        "Background Job {} failed. Type: {}, Method: {}. Error: {}",
        job.getId(),
        job.getJobType(),
        job.getMethodName(),
        e.getMessage(),
        e);
  }

  private void sleep(int seconds) throws InterruptedException {
    Thread.sleep(seconds * 1000L);
  }

  private void sendJobStatusUpdate(BackgroundJob job) {
    String jsonMessage = JsonUtils.pojoToJson(job);
    User user =
        Entity.getCollectionDAO()
            .userDAO()
            .findEntityByName(FullyQualifiedName.quoteName(job.getCreatedBy()));
    WebSocketManager.getInstance()
        .sendToOne(user.getId(), WebSocketManager.BACKGROUND_JOB_CHANNEL, jsonMessage);
  }
}
