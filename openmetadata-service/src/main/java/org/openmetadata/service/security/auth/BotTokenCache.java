package org.openmetadata.service.security.auth;

import static org.openmetadata.schema.type.Include.NON_DELETED;

import java.util.Set;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.resources.teams.UserResource;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FreshReadScope;

/**
 * Reads a bot's stored JWT for server-side callers. It caches nothing; the name stays because other
 * distributions call it. Request authentication checks bot tokens through {@link
 * org.openmetadata.service.security.credentials.Credentials#verifier()}.
 */
public final class BotTokenCache {
  public static final String EMPTY_STRING = "";

  private BotTokenCache() {}

  /**
   * The bot's stored JWT, decrypted: {@link #EMPTY_STRING} when the bot has none, null when it
   * cannot be read.
   */
  public static String getToken(String botName) {
    try {
      return loadTokens(botName).stream().findFirst().orElse(EMPTY_STRING);
    } catch (RuntimeException ignored) {
      return null;
    }
  }

  private static Set<String> loadTokens(String botName) {
    // Fresh read on any thread, also those PerRequestContextCleanupFilter does not wrap: a bot user
    // left in the request cache would bring a revoked token back.
    try (FreshReadScope.Handle freshRead = FreshReadScope.enter()) {
      return loadExistingTokens(botName);
    } catch (EntityNotFoundException ignored) {
      return Set.of();
    }
  }

  private static Set<String> loadExistingTokens(String botName) {
    UserRepository userRepository = (UserRepository) Entity.getEntityRepository(Entity.USER);
    User user =
        userRepository.getByName(
            null,
            botName,
            new Fields(Set.of(UserResource.USER_PROTECTED_FIELDS)),
            NON_DELETED,
            false);
    AuthenticationMechanism authenticationMechanism = user.getAuthenticationMechanism();
    if (authenticationMechanism == null) {
      return Set.of();
    }

    SecretsManager secretsManager = SecretsManagerFactory.getSecretsManager();
    secretsManager.decryptAuthenticationMechanism(user.getName(), authenticationMechanism);
    JWTAuthMechanism jwtAuthMechanism =
        JsonUtils.convertValue(authenticationMechanism.getConfig(), JWTAuthMechanism.class);
    String token = jwtAuthMechanism == null ? null : jwtAuthMechanism.getJWTToken();
    return token == null || token.isEmpty() ? Set.of() : Set.of(token);
  }
}
