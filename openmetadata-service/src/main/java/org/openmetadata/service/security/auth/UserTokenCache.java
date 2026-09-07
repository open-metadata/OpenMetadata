package org.openmetadata.service.security.auth;

import static org.openmetadata.schema.type.Include.NON_DELETED;

import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import com.google.common.util.concurrent.UncheckedExecutionException;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import javax.annotation.CheckForNull;
import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.TokenInterface;
import org.openmetadata.schema.auth.PersonalAccessToken;
import org.openmetadata.schema.auth.TokenType;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.cache.CacheInvalidationPubSub;
import org.openmetadata.service.cache.Invalidatable;
import org.openmetadata.service.jdbi3.TokenRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.resources.teams.UserResource;
import org.openmetadata.service.util.EntityUtil.Fields;

@Slf4j
public class UserTokenCache {
  private static final LoadingCache<String, HashSet<String>> CACHE =
      CacheBuilder.newBuilder()
          .maximumSize(1000)
          .expireAfterWrite(2, TimeUnit.MINUTES)
          .build(new UserTokenLoader());
  // Remote-pod hook, registered with CacheBundle: a peer that revoked a personal access token
  // publishes the owner's name as fqn, and this pod drops its cached token set for that user.
  private static final Invalidatable INVALIDATOR =
      (type, id, fqn) -> {
        if (CacheInvalidationPubSub.TYPE_USER_TOKEN.equals(type) && fqn != null) {
          CACHE.invalidate(fqn);
        }
      };
  private static volatile boolean initialized = false;
  private static TokenRepository tokenRepository;

  private UserTokenCache() {
    /* Private constructor for singleton */
  }

  public static void initialize() {
    if (!initialized) {
      tokenRepository = Entity.getTokenRepository();
      initialized = true;
      LOG.info("User Token cache is initialized");
    } else {
      LOG.debug("User Token cache is already initialized");
    }
  }

  public static Set<String> getToken(String userName) {
    try {
      return CACHE.get(userName);
    } catch (ExecutionException | UncheckedExecutionException ex) {
      LOG.error("Token not found", ex);
      return null;
    }
  }

  public static Invalidatable invalidator() {
    return INVALIDATOR;
  }

  public static void invalidateToken(String userName) {
    try {
      CACHE.invalidate(userName);
      publishRevocation(userName);
    } catch (Exception ex) {
      LOG.error("Failed to invalidate User token cache for User {}", userName, ex);
    }
  }

  /** See {@code BotTokenCache#publishRevocation}: same per-JVM cache, same cross-pod gap. */
  private static void publishRevocation(String userName) {
    CacheInvalidationPubSub pubSub = CacheBundle.getCacheInvalidationPubSub();
    if (pubSub != null) {
      pubSub.publish(
          CacheInvalidationPubSub.TYPE_USER_TOKEN,
          null,
          userName,
          CacheInvalidationPubSub.OP_REVOKE);
    }
  }

  static class UserTokenLoader extends CacheLoader<String, HashSet<String>> {
    @Override
    public @NonNull HashSet<String> load(@CheckForNull String userName) {
      HashSet<String> result = new HashSet<>();
      UserRepository userRepository = (UserRepository) Entity.getEntityRepository(Entity.USER);
      User user =
          userRepository.getByName(
              null,
              userName,
              new Fields(Set.of(UserResource.USER_PROTECTED_FIELDS)),
              NON_DELETED,
              true);
      List<TokenInterface> tokens =
          tokenRepository.findByUserIdAndType(
              user.getId(), TokenType.PERSONAL_ACCESS_TOKEN.value());
      tokens.forEach(t -> result.add(((PersonalAccessToken) t).getJwtToken()));
      return result;
    }
  }
}
