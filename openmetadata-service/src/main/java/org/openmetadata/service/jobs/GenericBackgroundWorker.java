package org.openmetadata.service.jobs;

import io.dropwizard.lifecycle.Managed;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.jobs.BackgroundJob;
import org.openmetadata.service.Entity;
import org.openmetadata.service.socket.WebSocketManager;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class GenericBackgroundWorker implements Managed {
  private final JobDAO jobDao;
  private final JobHandlerRegistry handlerRegistry;
  private volatile boolean running = true;

  public GenericBackgroundWorker(JobDAO jobDao, JobHandlerRegistry handlerRegistry) {
    this.jobDao = jobDao;
    this.handlerRegistry = handlerRegistry;
  }

  @Override
  public void start() throws Exception {
    LOG.info("Starting background job worker");
    Thread workerThread = new Thread(this::runWorker, "background-job-worker");
    workerThread.setDaemon(true);
    workerThread.start();
  }

  @Override
  public void stop() throws Exception {
    running = false;
  }

  private void runWorker() {
    while (running) {
      try {
        Optional<BackgroundJob> jobOpt = jobDao.fetchPendingJob();
        if (jobOpt.isPresent()) {
          BackgroundJob job = jobOpt.get();
          jobDao.updateJobStatus(job.getId(), BackgroundJob.Status.RUNNING);
          JobHandler handler = handlerRegistry.getHandler(job.getMethodName());
          try {
            handler.runJob(job.getJobArgs());
            job.setStatus(BackgroundJob.Status.COMPLETED);
            jobDao.updateJobStatus(job.getId(), BackgroundJob.Status.COMPLETED);
            LOG.info(
                "Background Job {} completed successfully. Type: {}, Method: {}",
                job.getId(),
                job.getJobType(),
                job.getMethodName());
            if (handler.sendStatusToWebSocket()) {
              sendJobStatusUpdate(job);
            }
          } catch (Exception e) {
            job.setStatus(BackgroundJob.Status.FAILED);
            jobDao.updateJobStatus(job.getId(), BackgroundJob.Status.FAILED);
            if (handler.sendStatusToWebSocket()) {
              sendJobStatusUpdate(job);
            }
            LOG.error(
                "Background Job {} failed. Type: {}, Method: {}. Error: {}",
                job.getId(),
                job.getJobType(),
                job.getMethodName(),
                e.getMessage(),
                e);
          }
        } else {
          // No jobs, sleep
          Thread.sleep(10_000);
        }
      } catch (Exception e) {
        LOG.error("Unexpected error in background job worker: {}", e.getMessage(), e);
      }
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
