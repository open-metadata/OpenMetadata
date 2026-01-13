package org.openmetadata.service.jobs;

import io.dropwizard.lifecycle.Managed;
import java.util.Optional;
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

  private final JobDAO jobDao;
  private final JobHandlerRegistry handlerRegistry;
  private volatile boolean running = true;

  public GenericBackgroundWorker(JobDAO jobDao, JobHandlerRegistry handlerRegistry) {
    this.jobDao = jobDao;
    this.handlerRegistry = handlerRegistry;
  }

  @Override
  public void start() {
    LOG.info("Starting background job worker");
    Thread workerThread = new Thread(this::runWorker, "background-job-worker");
    workerThread.setDaemon(true);
    workerThread.start();
  }

  @Override
  public void stop() {
    running = false;
  }

  private void runWorker() {
    int backoff = INITIAL_BACKOFF_SECONDS;

    while (running) {
      try {
        Optional<BackgroundJob> jobOpt = jobDao.fetchPendingJob();
        if (jobOpt.isPresent()) {
          processJob(jobOpt.get());
          backoff = INITIAL_BACKOFF_SECONDS; // Reset backoff after successful processing
        } else {
          sleep(NO_JOB_SLEEP_SECONDS);
        }
      } catch (BackgroundJobException e) {
        long jobId = e.getJobId();
        jobDao.updateJobStatus(jobId, BackgroundJob.Status.FAILED);
        LOG.error("Background Job {} failed. Error: {}", jobId, e.getMessage(), e);
      } catch (Exception e) {
        LOG.error("Unexpected error in background job worker: {}", e.getMessage(), e);
        backoff = Math.min(backoff * 5, MAX_BACKOFF_SECONDS); // Exponential backoff with max limit
        sleep(backoff);
      }
    }

    LOG.info("Background job worker terminated successfully.");
  }

  private void processJob(BackgroundJob job) {
    try {
      jobDao.updateJobStatus(job.getId(), BackgroundJob.Status.RUNNING);
      JobHandler handler = handlerRegistry.getHandler(job);
      handler.runJob(job);
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

  private void sleep(int seconds) {
    try {
      Thread.sleep(seconds * 1000L);
    } catch (InterruptedException ie) {
      LOG.error("Worker interrupted during sleep");
      Thread.currentThread().interrupt();
    }
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
