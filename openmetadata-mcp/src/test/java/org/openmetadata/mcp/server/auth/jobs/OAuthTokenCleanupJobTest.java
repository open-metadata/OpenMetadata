package org.openmetadata.mcp.server.auth.jobs;

import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.MockedConstruction;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.mcp.server.auth.repository.McpPendingAuthRequestRepository;
import org.openmetadata.mcp.server.auth.repository.OAuthAuthorizationCodeRepository;
import org.openmetadata.mcp.server.auth.repository.OAuthTokenRepository;
import org.quartz.JobExecutionContext;

@ExtendWith(MockitoExtension.class)
class OAuthTokenCleanupJobTest {

  @Test
  void testAllCleanupStepsSucceed() {
    try (MockedConstruction<OAuthTokenRepository> tokenRepoMock =
            Mockito.mockConstruction(OAuthTokenRepository.class);
        MockedConstruction<OAuthAuthorizationCodeRepository> codeRepoMock =
            Mockito.mockConstruction(OAuthAuthorizationCodeRepository.class);
        MockedConstruction<McpPendingAuthRequestRepository> pendingRepoMock =
            Mockito.mockConstruction(McpPendingAuthRequestRepository.class)) {

      OAuthTokenCleanupJob job = new OAuthTokenCleanupJob();
      job.execute(mock(JobExecutionContext.class));

      verify(tokenRepoMock.constructed().get(0)).deleteExpiredTokens();
      verify(codeRepoMock.constructed().get(0)).deleteExpired();
      verify(pendingRepoMock.constructed().get(0)).deleteExpired();
    }
  }

  @Test
  void testTokenCleanupFails_othersStillRun() {
    try (MockedConstruction<OAuthTokenRepository> tokenRepoMock =
            Mockito.mockConstruction(
                OAuthTokenRepository.class,
                (repo, ctx) ->
                    doThrow(new RuntimeException("DB error")).when(repo).deleteExpiredTokens());
        MockedConstruction<OAuthAuthorizationCodeRepository> codeRepoMock =
            Mockito.mockConstruction(OAuthAuthorizationCodeRepository.class);
        MockedConstruction<McpPendingAuthRequestRepository> pendingRepoMock =
            Mockito.mockConstruction(McpPendingAuthRequestRepository.class)) {

      OAuthTokenCleanupJob job = new OAuthTokenCleanupJob();
      job.execute(mock(JobExecutionContext.class));

      verify(codeRepoMock.constructed().get(0)).deleteExpired();
      verify(pendingRepoMock.constructed().get(0)).deleteExpired();
    }
  }

  @Test
  void testAuthCodeCleanupFails_othersStillRun() {
    try (MockedConstruction<OAuthTokenRepository> tokenRepoMock =
            Mockito.mockConstruction(OAuthTokenRepository.class);
        MockedConstruction<OAuthAuthorizationCodeRepository> codeRepoMock =
            Mockito.mockConstruction(
                OAuthAuthorizationCodeRepository.class,
                (repo, ctx) ->
                    doThrow(new RuntimeException("DB error")).when(repo).deleteExpired());
        MockedConstruction<McpPendingAuthRequestRepository> pendingRepoMock =
            Mockito.mockConstruction(McpPendingAuthRequestRepository.class)) {

      OAuthTokenCleanupJob job = new OAuthTokenCleanupJob();
      job.execute(mock(JobExecutionContext.class));

      verify(tokenRepoMock.constructed().get(0)).deleteExpiredTokens();
      verify(pendingRepoMock.constructed().get(0)).deleteExpired();
    }
  }

  @Test
  void testAllCleanupStepsFail_jobStillCompletes() {
    try (MockedConstruction<OAuthTokenRepository> tokenRepoMock =
            Mockito.mockConstruction(
                OAuthTokenRepository.class,
                (repo, ctx) ->
                    doThrow(new RuntimeException("DB error")).when(repo).deleteExpiredTokens());
        MockedConstruction<OAuthAuthorizationCodeRepository> codeRepoMock =
            Mockito.mockConstruction(
                OAuthAuthorizationCodeRepository.class,
                (repo, ctx) ->
                    doThrow(new RuntimeException("DB error")).when(repo).deleteExpired());
        MockedConstruction<McpPendingAuthRequestRepository> pendingRepoMock =
            Mockito.mockConstruction(
                McpPendingAuthRequestRepository.class,
                (repo, ctx) ->
                    doThrow(new RuntimeException("DB error")).when(repo).deleteExpired())) {

      OAuthTokenCleanupJob job = new OAuthTokenCleanupJob();
      job.execute(mock(JobExecutionContext.class));

      verify(tokenRepoMock.constructed().get(0)).deleteExpiredTokens();
      verify(codeRepoMock.constructed().get(0)).deleteExpired();
      verify(pendingRepoMock.constructed().get(0)).deleteExpired();
    }
  }
}
