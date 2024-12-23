package org.openmetadata.service.jobs;

import java.util.Map;

public interface JobHandler {
  void runJob(Map<String, Object> args) throws Exception;

  boolean sendStatusToWebSocket();
}
