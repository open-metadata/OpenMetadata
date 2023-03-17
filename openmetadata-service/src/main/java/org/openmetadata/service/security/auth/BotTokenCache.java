package org.openmetadata.service.security.auth;

import static org.openmetadata.schema.type.Include.NON_DELETED;

import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import com.google.common.util.concurrent.UncheckedExecutionException;
import java.io.IOException;
import java.util.List;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import javax.annotation.CheckForNull;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.resources.teams.UserResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class BotTokenCache {
  public static final String EMPTY_STRING = "";
  private static BotTokenCache INSTANCE;
  private final LoadingCache<String, String> BOTS_TOKEN_CACHE;

  public BotTokenCache() {
    BOTS_TOKEN_CACHE =
        CacheBuilder.newBuilder().maximumSize(1000).expireAfterWrite(2, TimeUnit.MINUTES).build(new BotTokenLoader());
  }

  public String getToken(String botName) {
    try {
      if (BOTS_TOKEN_CACHE.get(botName).equals(EMPTY_STRING)) {
        BOTS_TOKEN_CACHE.invalidate(botName);
      }
      return BOTS_TOKEN_CACHE.get(botName);
    } catch (ExecutionException | UncheckedExecutionException ex) {
      return null;
    }
  }

  public void invalidateToken(String botName) {
    try {
      BOTS_TOKEN_CACHE.invalidate(botName);
    } catch (Exception ex) {
      LOG.error("Failed to invalidate Bot token cache for Bot {}", botName, ex);
    }
  }

  public static BotTokenCache getInstance() {
    if (INSTANCE == null) {
      INSTANCE = new BotTokenCache();
    }
    return INSTANCE;
  }

  static class BotTokenLoader extends CacheLoader<String, String> {
    @Override
    public String load(@CheckForNull String botName) throws IOException {
      UserRepository userRepository = (UserRepository) Entity.getEntityRepository(Entity.USER);
      User user =
          userRepository.getByName(
              null, botName, new EntityUtil.Fields(List.of(UserResource.USER_PROTECTED_FIELDS)), NON_DELETED);
      AuthenticationMechanism authenticationMechanism = user.getAuthenticationMechanism();
      if (authenticationMechanism != null) {
        JWTAuthMechanism jwtAuthMechanism =
            JsonUtils.convertValue(authenticationMechanism.getConfig(), JWTAuthMechanism.class);
        return jwtAuthMechanism.getJWTToken();
      }
      return null;
    }
  }
}
