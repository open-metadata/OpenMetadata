package org.openmetadata.service.security.auth;

import static org.openmetadata.schema.type.Include.NON_DELETED;

import java.util.Set;
import java.util.function.Supplier;
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

public final class BotTokenCache {
  public static final String EMPTY_STRING = "";

  private BotTokenCache() {}

  public static String getToken(String botName) {
    try {
      return loadTokens(botName).stream().findFirst().orElse(EMPTY_STRING);
    } catch (RuntimeException ignored) {
      return null;
    }
  }

  public static boolean isTokenValid(String botName, String presentedToken) {
    return CredentialTokenState.fromCacheBundle()
        .isTokenValid(
            CredentialTokenState.Kind.BOT, botName, presentedToken, () -> loadTokens(botName));
  }

  public static <T> T mutateToken(String botName, Supplier<T> mutation) {
    return CredentialTokenState.fromCacheBundle()
        .mutate(CredentialTokenState.Kind.BOT, botName, mutation, () -> loadTokens(botName));
  }

  public static void invalidateToken(String botName) {
    CredentialTokenState.fromCacheBundle().invalidate(CredentialTokenState.Kind.BOT, botName);
  }

  public static Runnable denyToken(String botName) {
    return CredentialTokenState.fromCacheBundle()
        .denyUntilReload(CredentialTokenState.Kind.BOT, botName, () -> loadTokens(botName));
  }

  public static void reloadToken(String botName) {
    CredentialTokenState.fromCacheBundle()
        .reload(CredentialTokenState.Kind.BOT, botName, () -> loadTokens(botName));
  }

  private static Set<String> loadTokens(String botName) {
    try {
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
