package org.openmetadata.service.security;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.function.BiFunction;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.exception.BotUserNotFoundException;
import org.openmetadata.service.exception.SecretsManagerException;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.util.OpenMetadataConnectionBuilder;

/**
 * Whether a bot can be used: the JWKS status check's ingestion-bot logic, for any bot. Its server
 * connection is built the way ingestion runs get it, its JWT is decrypted through the secrets
 * manager, and the token must pass the server's own JWT validation.
 */
@Slf4j
public final class BotTokenCheck {

  /** Fixed, safe reasons: the card is readable by any signed-in user, so no exception text. */
  public enum TokenProblem {
    NO_JWT_CONFIGURED("no JWT configured"),
    BOT_USER_NOT_FOUND("bot user not found"),
    CANNOT_BE_DECRYPTED("cannot be decrypted"),
    CANNOT_BE_LOADED("could not be loaded"),
    REJECTED("rejected by JWT validation");

    public final String reason;

    TokenProblem(String reason) {
      this.reason = reason;
    }
  }

  public record UnusableBot(String name, TokenProblem problem) {}

  private static final Duration RESULT_TTL = Duration.ofMinutes(5);
  private static final int MAX_CACHED_BOTS = 500;

  private final BiFunction<OpenMetadataApplicationConfig, String, String> decryptedTokenOf;
  // /system/status is polled and each check reads the secrets manager, so results are reused.
  private final Cache<String, Optional<TokenProblem>> problemByBot =
      Caffeine.newBuilder().maximumSize(MAX_CACHED_BOTS).expireAfterWrite(RESULT_TTL).build();

  public BotTokenCheck(BiFunction<OpenMetadataApplicationConfig, String, String> decryptedTokenOf) {
    this.decryptedTokenOf = decryptedTokenOf;
  }

  public static BotTokenCheck forSystemBots() {
    return new BotTokenCheck(BotTokenCheck::decryptedToken);
  }

  public static String decryptedToken(OpenMetadataApplicationConfig config, String botName) {
    OpenMetadataConnection connection = new OpenMetadataConnectionBuilder(config, botName).build();
    return SecretsManagerFactory.getSecretsManager()
        .decryptJWTConfig(connection.getSecurityConfig())
        .getJwtToken();
  }

  public List<UnusableBot> unusableBots(
      List<String> botNames, OpenMetadataApplicationConfig config, JwtFilter jwtFilter) {
    return botNames.stream()
        .flatMap(
            botName ->
                problemByBot
                    .get(botName, name -> problemOf(name, config, jwtFilter))
                    .map(problem -> new UnusableBot(botName, problem))
                    .stream())
        .toList();
  }

  private Optional<TokenProblem> problemOf(
      String botName, OpenMetadataApplicationConfig config, JwtFilter jwtFilter) {
    Optional<TokenProblem> problem;
    try {
      problem = validationProblem(botName, decryptedTokenOf.apply(config, botName), jwtFilter);
    } catch (RuntimeException e) {
      LOG.error("System bot {} token could not be loaded: {}", botName, e.getMessage(), e);
      problem = Optional.of(loadingProblem(e));
    }
    return problem;
  }

  private static Optional<TokenProblem> validationProblem(
      String botName, String token, JwtFilter jwtFilter) {
    Optional<TokenProblem> problem = Optional.empty();
    try {
      jwtFilter.validateJwtAndGetClaims(token);
    } catch (Exception e) {
      // Not RuntimeException: validateJwtAndGetClaims is @SneakyThrows, and a JWKS key lookup
      // throws the checked JwkException through it. Same catch as the JWKS status step.
      LOG.error("System bot {} token was rejected: {}", botName, e.getMessage(), e);
      problem = Optional.of(TokenProblem.REJECTED);
    }
    return problem;
  }

  private static TokenProblem loadingProblem(RuntimeException failure) {
    return switch (failure) {
      case SecretsManagerException decryptFailure -> TokenProblem.CANNOT_BE_DECRYPTED;
      case BotUserNotFoundException missingBotUser -> TokenProblem.BOT_USER_NOT_FOUND;
      case IllegalArgumentException noJwtAuth -> TokenProblem.NO_JWT_CONFIGURED;
      default -> TokenProblem.CANNOT_BE_LOADED;
    };
  }
}
