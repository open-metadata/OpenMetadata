package org.openmetadata.service.security;

import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import com.google.common.util.concurrent.UncheckedExecutionException;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import javax.annotation.CheckForNull;
import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.UnhandledServerException;
import org.openmetadata.service.jdbi3.UserRepository;

@Slf4j
public class UserRolesCache {
  private static final LoadingCache<String, User> CACHE =
      CacheBuilder.newBuilder()
          .maximumSize(1000)
          .expireAfterWrite(2, TimeUnit.MINUTES)
          .build(new UserWithRolesLoader());

  private UserRolesCache() {
    /* Private constructor for singleton */
  }

  public static User getUserWithRoles(String userName) {
    try {
      User cachedUser = CACHE.get(userName);
      User lastUpdatedUser =
          Entity.getEntityByName(Entity.USER, userName, "id", Include.NON_DELETED, true);
      if (lastUpdatedUser.getUpdatedAt() > cachedUser.getUpdatedAt()) {
        CACHE.invalidate(userName);
        cachedUser = CACHE.get(userName);
      }
      return cachedUser;
    } catch (ExecutionException | UncheckedExecutionException ex) {
      throw new UnhandledServerException("User not found", ex);
    }
  }

  static class UserWithRolesLoader extends CacheLoader<String, User> {
    @Override
    public @NonNull User load(@CheckForNull String userName) {
      UserRepository userRepository = (UserRepository) Entity.getEntityRepository(Entity.USER);
      return userRepository.getByName(null, userName, userRepository.getFields("roles"));
    }
  }
}
