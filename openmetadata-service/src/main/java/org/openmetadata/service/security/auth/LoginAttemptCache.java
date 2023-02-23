package org.openmetadata.service.security.auth;

import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import lombok.NonNull;
import org.openmetadata.schema.api.configuration.LoginConfiguration;
import org.openmetadata.service.OpenMetadataApplicationConfig;

public class LoginAttemptCache {
  private int MAX_ATTEMPT = 3;
  private final LoadingCache<String, Integer> attemptsCache;

  public LoginAttemptCache(OpenMetadataApplicationConfig config) {
    super();
    LoginConfiguration loginConfiguration = config.getApplicationConfiguration().getLoginConfig();
    long accessBlockTime = 600;
    if (loginConfiguration != null) {
      MAX_ATTEMPT = loginConfiguration.getMaxLoginFailAttempts();
      accessBlockTime = loginConfiguration.getAccessBlockTime();
    }
    attemptsCache =
        CacheBuilder.newBuilder()
            .maximumSize(1000)
            .expireAfterWrite(accessBlockTime, TimeUnit.SECONDS)
            .build(
                new CacheLoader<>() {
                  public Integer load(@NonNull String key) {
                    return 0;
                  }
                });
  }

  public LoginAttemptCache(int maxAttempt, int blockTimeInSec) {
    super();
    MAX_ATTEMPT = maxAttempt;
    attemptsCache =
        CacheBuilder.newBuilder()
            .maximumSize(1000)
            .expireAfterWrite(blockTimeInSec, TimeUnit.SECONDS)
            .build(
                new CacheLoader<>() {
                  public Integer load(@NonNull String key) {
                    return 0;
                  }
                });
  }

  public void recordSuccessfulLogin(String key) {
    attemptsCache.invalidate(key);
  }

  public void recordFailedLogin(String key) {
    int attempts;
    try {
      attempts = attemptsCache.get(key);
    } catch (ExecutionException e) {
      attempts = 0;
    }
    attempts++;
    attemptsCache.put(key, attempts);
  }

  public boolean isLoginBlocked(String key) {
    try {
      return attemptsCache.get(key) >= MAX_ATTEMPT;
    } catch (ExecutionException e) {
      return false;
    }
  }

  public int getUserFailedLoginCount(String key) {
    try {
      return attemptsCache.get(key);
    } catch (ExecutionException e) {
      return -1;
    }
  }
}
