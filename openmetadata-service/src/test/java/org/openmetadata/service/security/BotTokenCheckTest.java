package org.openmetadata.service.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.BiFunction;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.exception.BotUserNotFoundException;
import org.openmetadata.service.exception.SecretsManagerException;
import org.openmetadata.service.security.BotTokenCheck.TokenProblem;
import org.openmetadata.service.security.BotTokenCheck.UnusableBot;

class BotTokenCheckTest {

  private final OpenMetadataApplicationConfig config = mock(OpenMetadataApplicationConfig.class);
  private final JwtFilter jwtFilter = mock(JwtFilter.class);

  private List<UnusableBot> check(
      BiFunction<OpenMetadataApplicationConfig, String, String> decryptedTokenOf,
      List<String> botNames) {
    return new BotTokenCheck(decryptedTokenOf).unusableBots(botNames, config, jwtFilter);
  }

  private static BiFunction<OpenMetadataApplicationConfig, String, String> failingWith(
      RuntimeException failure) {
    return (cfg, bot) -> {
      throw failure;
    };
  }

  @Test
  void validTokensAreUsable() {
    assertEquals(List.of(), check((cfg, bot) -> "token-" + bot, List.of("ingestion-bot")));
  }

  @Test
  void undecryptableTokenIsReportedAsCannotBeDecrypted() {
    SecretsManagerException failure =
        new SecretsManagerException(
            Response.Status.BAD_REQUEST, "Failed to decrypt JWT Client Config instance.");

    assertEquals(
        List.of(new UnusableBot("automator-bot", TokenProblem.CANNOT_BE_DECRYPTED)),
        check(failingWith(failure), List.of("automator-bot")));
  }

  @Test
  void botWithoutJwtAuthIsReportedAsNoJwtConfigured() {
    IllegalArgumentException failure =
        new IllegalArgumentException("Not supported authentication mechanism type: [SSO]");

    assertEquals(
        List.of(new UnusableBot("sso-bot", TokenProblem.NO_JWT_CONFIGURED)),
        check(failingWith(failure), List.of("sso-bot")));
  }

  @Test
  void brokenBotUserLinkIsReportedAsBotUserNotFound() {
    BotUserNotFoundException failure =
        new BotUserNotFoundException("Please, verify that the bot [usage-bot] is present.");

    assertEquals(
        List.of(new UnusableBot("usage-bot", TokenProblem.BOT_USER_NOT_FOUND)),
        check(failingWith(failure), List.of("usage-bot")));
  }

  @Test
  void otherLoadingFailureIsReportedAsCannotBeLoaded() {
    assertEquals(
        List.of(new UnusableBot("usage-bot", TokenProblem.CANNOT_BE_LOADED)),
        check(failingWith(new IllegalStateException("connection refused")), List.of("usage-bot")));
  }

  @Test
  void tokenRejectedByJwtFilterIsReportedAsRejected() {
    when(jwtFilter.validateJwtAndGetClaims("stale"))
        .thenThrow(new AuthenticationException("Expired token!"));

    assertEquals(
        List.of(new UnusableBot("profiler-bot", TokenProblem.REJECTED)),
        check((cfg, bot) -> "stale", List.of("profiler-bot")));
  }

  @Test
  void oneUnusableBotDoesNotHideTheOthers() {
    BiFunction<OpenMetadataApplicationConfig, String, String> tokens =
        (cfg, bot) -> {
          if ("automator-bot".equals(bot)) {
            throw new SecretsManagerException(Response.Status.BAD_REQUEST, "Failed to decrypt");
          }
          return "token-" + bot;
        };

    assertEquals(
        List.of(new UnusableBot("automator-bot", TokenProblem.CANNOT_BE_DECRYPTED)),
        check(tokens, List.of("automator-bot", "ingestion-bot")));
  }

  @Test
  void resultIsCachedPerBot() {
    AtomicInteger decryptions = new AtomicInteger();
    BotTokenCheck botTokenCheck =
        new BotTokenCheck(
            (cfg, bot) -> {
              decryptions.incrementAndGet();
              return "token-" + bot;
            });

    botTokenCheck.unusableBots(List.of("ingestion-bot"), config, jwtFilter);
    botTokenCheck.unusableBots(List.of("ingestion-bot"), config, jwtFilter);

    assertEquals(1, decryptions.get());
  }

  @Test
  void eachProblemHasAFixedReason() {
    assertEquals("no JWT configured", TokenProblem.NO_JWT_CONFIGURED.reason);
    assertEquals("bot user not found", TokenProblem.BOT_USER_NOT_FOUND.reason);
    assertEquals("cannot be decrypted", TokenProblem.CANNOT_BE_DECRYPTED.reason);
    assertEquals("could not be loaded", TokenProblem.CANNOT_BE_LOADED.reason);
    assertEquals("rejected by JWT validation", TokenProblem.REJECTED.reason);
  }
}
