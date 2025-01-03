package org.openmetadata.service.jobs;

public interface JobHandler {
  void runJob(Object jobArgs) throws Exception;

  boolean sendStatusToWebSocket();
}
