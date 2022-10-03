package org.openmetadata.service.security.auth;

import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import org.openmetadata.schema.api.configuration.LoginConfiguration;
import org.openmetadata.service.util.ConfigurationHolder;

public class LoginAttemptCache {
  private final int MAX_ATTEMPT;
  private final LoadingCache<String, Integer> attemptsCache;

  public LoginAttemptCache() {
    super();
    LoginConfiguration loginConfiguration =
        ConfigurationHolder.getInstance()
            .getConfig(ConfigurationHolder.ConfigurationType.LOGIN_CONFIG, LoginConfiguration.class);
    MAX_ATTEMPT = 3;
    attemptsCache =
        CacheBuilder.newBuilder()
            .maximumSize(1000)
            .expireAfterWrite(loginConfiguration.getAccessBlockTime(), TimeUnit.SECONDS)
            .build(
                new CacheLoader<>() {
                  public Integer load(String key) {
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
                  public Integer load(String key) {
                    return 0;
                  }
                });
  }

  public void recordSuccessfulLogin(String key) {
    attemptsCache.invalidate(key);
  }

  public void recordFailedLogin(String key) {
    int attempts = 0;
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
