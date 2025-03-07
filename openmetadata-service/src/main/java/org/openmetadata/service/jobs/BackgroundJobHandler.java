package org.openmetadata.service.jobs;

import org.openmetadata.schema.jobs.BackgroundJob;

public interface BackgroundJobHandler {
  void runJob(BackgroundJob job) throws BackgroundJobException;

  boolean sendStatusToWebSocket();
}
