package org.openmetadata.service.security.auth;

import static org.openmetadata.schema.type.Include.NON_DELETED;

import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import com.google.common.util.concurrent.UncheckedExecutionException;
import java.util.Set;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import javax.annotation.CheckForNull;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.cache.CacheInvalidationPubSub;
import org.openmetadata.service.cache.Invalidatable;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.resources.teams.UserResource;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.util.EntityUtil.Fields;

@Slf4j
public class BotTokenCache {
  public static final String EMPTY_STRING = "";
  private static final LoadingCache<String, String> BOTS_TOKEN_CACHE =
      CacheBuilder.newBuilder()
          .maximumSize(1000)
          .expireAfterWrite(2, TimeUnit.MINUTES)
          .build(new BotTokenLoader());
  // Remote-pod hook, registered with CacheBundle: a peer that revoked or rotated a bot token
  // publishes its name as fqn, and this pod drops its cached copy so the next request reloads.
  private static final Invalidatable INVALIDATOR =
      (type, id, fqn) -> {
        if (CacheInvalidationPubSub.TYPE_BOT_TOKEN.equals(type) && fqn != null) {
          BOTS_TOKEN_CACHE.invalidate(fqn);
        }
      };

  private BotTokenCache() {
    // Private constructor for utility class
  }

  public static Invalidatable invalidator() {
    return INVALIDATOR;
  }

  public static String getToken(String botName) {
    try {
      if (BOTS_TOKEN_CACHE.get(botName).equals(EMPTY_STRING)) {
        BOTS_TOKEN_CACHE.invalidate(botName);
      }
      return BOTS_TOKEN_CACHE.get(botName);
    } catch (ExecutionException | UncheckedExecutionException ex) {
      return null;
    }
  }

  public static void invalidateToken(String botName) {
    try {
      BOTS_TOKEN_CACHE.invalidate(botName);
      publishRevocation(botName);
    } catch (Exception ex) {
      LOG.error("Failed to invalidate Bot token cache for Bot {}", botName, ex);
    }
  }

  /**
   * The cache is per-JVM, so on its own {@link #invalidateToken} only takes effect on the pod that
   * handled the revoke; every other pod would keep accepting the old token until the 2-minute TTL.
   * Publishing on the cache-invalidation channel evicts the peers too. No-op without Redis pub/sub.
   */
  private static void publishRevocation(String botName) {
    CacheInvalidationPubSub pubSub = CacheBundle.getCacheInvalidationPubSub();
    if (pubSub != null) {
      pubSub.publish(
          CacheInvalidationPubSub.TYPE_BOT_TOKEN, null, botName, CacheInvalidationPubSub.OP_REVOKE);
    }
  }

  static class BotTokenLoader extends CacheLoader<String, String> {
    @Override
    public String load(@CheckForNull String botName) {
      UserRepository userRepository = (UserRepository) Entity.getEntityRepository(Entity.USER);
      User user =
          userRepository.getByName(
              null,
              botName,
              new Fields(Set.of(UserResource.USER_PROTECTED_FIELDS)),
              NON_DELETED,
              true);
      AuthenticationMechanism authenticationMechanism = user.getAuthenticationMechanism();
      SecretsManager secretsManager = SecretsManagerFactory.getSecretsManager();
      secretsManager.decryptAuthenticationMechanism(user.getName(), authenticationMechanism);
      if (authenticationMechanism != null) {
        JWTAuthMechanism jwtAuthMechanism =
            JsonUtils.convertValue(authenticationMechanism.getConfig(), JWTAuthMechanism.class);
        return jwtAuthMechanism.getJWTToken();
      }
      return null;
    }
  }
}
