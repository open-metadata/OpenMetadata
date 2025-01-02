package org.openmetadata.service.jobs;

import org.openmetadata.schema.jobs.JobArgs;

public interface JobHandler {
  void runJob(JobArgs jobArgs) throws Exception;

  boolean sendStatusToWebSocket();
}
