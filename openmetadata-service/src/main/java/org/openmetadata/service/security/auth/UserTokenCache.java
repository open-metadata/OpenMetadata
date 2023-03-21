package org.openmetadata.service.security.auth;

import static org.openmetadata.schema.type.Include.NON_DELETED;

import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import com.google.common.util.concurrent.UncheckedExecutionException;
import java.io.IOException;
import java.util.HashSet;
import java.util.List;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import javax.annotation.CheckForNull;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.TokenInterface;
import org.openmetadata.schema.auth.PersonalAccessToken;
import org.openmetadata.schema.auth.TokenType;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.TokenRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.resources.teams.UserResource;
import org.openmetadata.service.util.EntityUtil;

@Slf4j
public class UserTokenCache {
  private static UserTokenCache INSTANCE;
  private static LoadingCache<String, HashSet<String>> USER_TOKEN_CACHE;
  private static volatile boolean INITIALIZED = false;
  private static TokenRepository tokenRepository;

  public static void initialize(CollectionDAO dao) {
    if (!INITIALIZED) {
      USER_TOKEN_CACHE =
          CacheBuilder.newBuilder()
              .maximumSize(1000)
              .expireAfterWrite(2, TimeUnit.MINUTES)
              .build(new UserTokenLoader());
      tokenRepository = new TokenRepository(dao);
      INSTANCE = new UserTokenCache();
      INITIALIZED = true;
      LOG.info("User Token cache is initialized");
    } else {
      LOG.info("User Token cache is already initialized");
    }
  }

  public HashSet<String> getToken(String userName) {
    try {
      return USER_TOKEN_CACHE.get(userName);
    } catch (ExecutionException | UncheckedExecutionException ex) {
      return null;
    }
  }

  public void invalidateToken(String userName) {
    try {
      USER_TOKEN_CACHE.invalidate(userName);
    } catch (Exception ex) {
      LOG.error("Failed to invalidate User token cache for User {}", userName, ex);
    }
  }

  public static UserTokenCache getInstance() {
    return INSTANCE;
  }

  static class UserTokenLoader extends CacheLoader<String, HashSet<String>> {
    @Override
    public HashSet<String> load(@CheckForNull String userName) throws IOException {
      HashSet<String> result = new HashSet<>();
      UserRepository userRepository = (UserRepository) Entity.getEntityRepository(Entity.USER);
      User user =
          userRepository.getByName(
              null, userName, new EntityUtil.Fields(List.of(UserResource.USER_PROTECTED_FIELDS)), NON_DELETED);
      List<TokenInterface> tokens =
          tokenRepository.findByUserIdAndType(user.getId().toString(), TokenType.PERSONAL_ACCESS_TOKEN.value());
      tokens.forEach((t) -> result.add(((PersonalAccessToken) t).getJwtToken()));
      return result;
    }
  }
}
