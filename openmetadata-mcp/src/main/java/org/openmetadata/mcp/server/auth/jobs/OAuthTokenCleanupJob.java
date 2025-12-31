package org.openmetadata.mcp.server.auth.jobs;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.mcp.server.auth.repository.OAuthAuthorizationCodeRepository;
import org.openmetadata.mcp.server.auth.repository.OAuthTokenRepository;
import org.quartz.Job;
import org.quartz.JobExecutionContext;

@Slf4j
public class OAuthTokenCleanupJob implements Job {

  @Override
  public void execute(JobExecutionContext context) {
    LOG.debug("Starting OAuth token cleanup job");

    try {
      OAuthTokenRepository tokenRepository = new OAuthTokenRepository();
      tokenRepository.deleteExpiredTokens();

      OAuthAuthorizationCodeRepository codeRepository = new OAuthAuthorizationCodeRepository();
      codeRepository.deleteExpired();

      LOG.info("OAuth token cleanup completed successfully");
    } catch (Exception e) {
      LOG.error("OAuth token cleanup failed", e);
    }
  }
}
