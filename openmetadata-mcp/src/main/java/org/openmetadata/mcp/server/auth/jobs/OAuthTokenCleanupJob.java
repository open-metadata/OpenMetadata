package org.openmetadata.mcp.server.auth.jobs;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.mcp.server.auth.repository.McpPendingAuthRequestRepository;
import org.openmetadata.mcp.server.auth.repository.OAuthAuthorizationCodeRepository;
import org.openmetadata.mcp.server.auth.repository.OAuthTokenRepository;
import org.quartz.Job;
import org.quartz.JobExecutionContext;

@Slf4j
public class OAuthTokenCleanupJob implements Job {

  @Override
  public void execute(JobExecutionContext context) {
    LOG.debug("Starting OAuth token cleanup job");
    boolean allSucceeded = true;

    // Each cleanup step runs independently so a failure in one doesn't block the others
    try {
      new OAuthTokenRepository().deleteExpiredTokens();
    } catch (Exception e) {
      LOG.error("Failed to delete expired tokens", e);
      allSucceeded = false;
    }

    try {
      new OAuthAuthorizationCodeRepository().deleteExpired();
    } catch (Exception e) {
      LOG.error("Failed to delete expired authorization codes", e);
      allSucceeded = false;
    }

    try {
      new McpPendingAuthRequestRepository().deleteExpired();
    } catch (Exception e) {
      LOG.error("Failed to delete expired pending auth requests", e);
      allSucceeded = false;
    }

    if (allSucceeded) {
      LOG.info("OAuth token cleanup completed successfully");
    } else {
      LOG.warn("OAuth token cleanup completed with errors — some expired data was not removed");
    }
  }
}
