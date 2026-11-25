package org.openmetadata.service.security.auth;

import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import io.dropwizard.logback.shaded.guava.annotations.VisibleForTesting;
import java.util.Locale;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import lombok.NonNull;
import org.jetbrains.annotations.NotNull;
import org.openmetadata.schema.api.configuration.LoginConfiguration;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.service.resources.settings.SettingsCache;

public class LoginAttemptCache {
  private static LoginAttemptCache INSTANCE;
  private int maxAttempt = 3;
  private final LoadingCache<String, Integer> attemptsCache;
  // Attempts for identities the provider doesn't know, kept apart so a flood of made-up names can
  // never evict a real account's counter and reset its lockout.
  private final LoadingCache<String, Integer> unknownAttemptsCache;

  private LoginAttemptCache() {
    LoginConfiguration loginConfiguration =
        SettingsCache.getSetting(SettingsType.LOGIN_CONFIGURATION, LoginConfiguration.class);
    long accessBlockTime = 600;
    if (loginConfiguration != null) {
      maxAttempt = loginConfiguration.getMaxLoginFailAttempts();
      accessBlockTime = loginConfiguration.getAccessBlockTime();
    }
    attemptsCache = newCounter(accessBlockTime);
    unknownAttemptsCache = newCounter(accessBlockTime);
  }

  public static LoginAttemptCache getInstance() {
    if (INSTANCE == null) {
      INSTANCE = new LoginAttemptCache();
    }
    return INSTANCE;
  }

  public static void updateLoginConfiguration() {
    INSTANCE = new LoginAttemptCache();
  }

  @VisibleForTesting
  public LoginAttemptCache(int maxAttempt, int blockTimeInSec) {
    this.maxAttempt = maxAttempt;
    attemptsCache = newCounter(blockTimeInSec);
    unknownAttemptsCache = newCounter(blockTimeInSec);
  }

  private static LoadingCache<String, Integer> newCounter(long expireAfterSeconds) {
    return CacheBuilder.newBuilder()
        .maximumSize(1000)
        .expireAfterWrite(expireAfterSeconds, TimeUnit.SECONDS)
        .build(
            new CacheLoader<>() {
              public @NotNull Integer load(@NonNull String username) {
                return 0;
              }
            });
  }

  public void recordSuccessfulLogin(String username) {
    attemptsCache.invalidate(cacheKey(username));
    unknownAttemptsCache.invalidate(cacheKey(username));
  }

  public void recordFailedLogin(String username) {
    increment(attemptsCache, username);
  }

  /** A failed login for an identity the provider doesn't know; locks it out like a real one. */
  public void recordFailedUnknownLogin(String username) {
    increment(unknownAttemptsCache, username);
  }

  private static void increment(LoadingCache<String, Integer> counter, String username) {
    String key = cacheKey(username);
    int attempts;
    try {
      attempts = counter.get(key);
    } catch (ExecutionException e) {
      attempts = 0;
    }
    attempts++;
    counter.put(key, attempts);
  }

  public boolean isLoginBlocked(String username) {
    try {
      String key = cacheKey(username);
      return attemptsCache.get(key) >= maxAttempt || unknownAttemptsCache.get(key) >= maxAttempt;
    } catch (ExecutionException e) {
      return false;
    }
  }

  public int getUserFailedLoginCount(String username) {
    try {
      return attemptsCache.get(cacheKey(username));
    } catch (ExecutionException e) {
      return -1;
    }
  }

  private static String cacheKey(String username) {
    return username.toLowerCase(Locale.ROOT);
  }
}
