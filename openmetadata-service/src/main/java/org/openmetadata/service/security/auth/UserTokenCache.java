package org.openmetadata.service.security.auth;

import static org.openmetadata.schema.type.Include.NON_DELETED;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.function.Supplier;
import org.openmetadata.schema.TokenInterface;
import org.openmetadata.schema.auth.PersonalAccessToken;
import org.openmetadata.schema.auth.TokenType;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.TokenRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.resources.teams.UserResource;
import org.openmetadata.service.util.EntityUtil.Fields;

public final class UserTokenCache {
  private UserTokenCache() {}

  /** Retained for callers compiled against the former eagerly initialized cache. */
  public static void initialize() {}

  public static Set<String> getToken(String userName) {
    try {
      return loadTokens(userName);
    } catch (RuntimeException ignored) {
      return null;
    }
  }

  public static boolean isTokenValid(String userName, String presentedToken) {
    return CredentialTokenState.fromCacheBundle()
        .isTokenValid(
            CredentialTokenState.Kind.PERSONAL_ACCESS_TOKEN,
            userName,
            presentedToken,
            () -> loadTokens(userName));
  }

  public static <T> T mutateToken(String userName, Supplier<T> mutation) {
    return CredentialTokenState.fromCacheBundle()
        .mutate(
            CredentialTokenState.Kind.PERSONAL_ACCESS_TOKEN,
            userName,
            mutation,
            () -> loadTokens(userName));
  }

  public static void invalidateToken(String userName) {
    CredentialTokenState.fromCacheBundle()
        .invalidate(CredentialTokenState.Kind.PERSONAL_ACCESS_TOKEN, userName);
  }

  public static Runnable denyToken(String userName) {
    return CredentialTokenState.fromCacheBundle()
        .denyUntilReload(
            CredentialTokenState.Kind.PERSONAL_ACCESS_TOKEN, userName, () -> loadTokens(userName));
  }

  public static void reloadToken(String userName) {
    CredentialTokenState.fromCacheBundle()
        .reload(
            CredentialTokenState.Kind.PERSONAL_ACCESS_TOKEN, userName, () -> loadTokens(userName));
  }

  private static Set<String> loadTokens(String userName) {
    try {
      return loadExistingTokens(userName);
    } catch (EntityNotFoundException ignored) {
      return Set.of();
    }
  }

  private static Set<String> loadExistingTokens(String userName) {
    UserRepository userRepository = (UserRepository) Entity.getEntityRepository(Entity.USER);
    User user =
        userRepository.getByName(
            null,
            userName,
            new Fields(Set.of(UserResource.USER_PROTECTED_FIELDS)),
            NON_DELETED,
            false);
    TokenRepository tokenRepository = Entity.getTokenRepository();
    List<TokenInterface> tokens =
        tokenRepository.findByUserIdAndType(user.getId(), TokenType.PERSONAL_ACCESS_TOKEN.value());
    Set<String> result = new HashSet<>();
    tokens.forEach(token -> result.add(((PersonalAccessToken) token).getJwtToken()));
    return result;
  }
}
