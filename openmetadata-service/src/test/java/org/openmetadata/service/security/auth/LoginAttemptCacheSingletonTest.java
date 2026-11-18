package org.openmetadata.service.security.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.google.common.cache.LoadingCache;
import java.lang.reflect.Field;
import java.util.concurrent.ExecutionException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.configuration.LoginConfiguration;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.service.resources.settings.SettingsCache;

/**
 * Covers the {@link LoginAttemptCache} singleton lifecycle ({@link LoginAttemptCache#getInstance}
 * and {@link LoginAttemptCache#updateLoginConfiguration()}) and the defensive {@code catch}
 * branches in {@link LoginAttemptCache#isLoginBlocked} and {@link LoginAttemptCache#getUserFailedLoginCount},
 * which the concurrency test does not reach on its own because the {@code CacheLoader} never
 * throws.
 */
class LoginAttemptCacheSingletonTest {
  private LoginAttemptCache previous;

  @BeforeEach
  void saveInstance() throws Exception {
    previous = swapInstance(null);
  }

  @AfterEach
  void restoreInstance() throws Exception {
    swapInstance(previous);
  }

  @Test
  void getInstanceBuildsTheSingletonFromSettingsCache() {
    LoginConfiguration configured =
        new LoginConfiguration().withMaxLoginFailAttempts(7).withAccessBlockTime(120);

    try (MockedStatic<SettingsCache> settingsCache =
        org.mockito.Mockito.mockStatic(SettingsCache.class)) {
      settingsCache
          .when(
              () ->
                  SettingsCache.getSetting(
                      SettingsType.LOGIN_CONFIGURATION, LoginConfiguration.class))
          .thenReturn(configured);

      LoginAttemptCache instance = LoginAttemptCache.getInstance();

      assertNotNull(instance);
      assertSame(
          instance, LoginAttemptCache.getInstance(), "getInstance must return the same singleton");
      // The configured LoginConfiguration feeds the private constructor: 7 failures trips the
      // lockout.
      for (int i = 0; i < 7; i++) {
        instance.recordFailedLogin("attacker");
      }
      assertTrue(instance.isLoginBlocked("attacker"));
    }
  }

  @Test
  void getInstanceFallsBackToDefaultsWhenSettingsCacheReturnsNull() {
    try (MockedStatic<SettingsCache> settingsCache =
        org.mockito.Mockito.mockStatic(SettingsCache.class)) {
      settingsCache
          .when(
              () ->
                  SettingsCache.getSetting(
                      SettingsType.LOGIN_CONFIGURATION, LoginConfiguration.class))
          .thenReturn(null);

      LoginAttemptCache instance = LoginAttemptCache.getInstance();

      assertNotNull(instance);
      // Default maxAttempt is 3.
      instance.recordFailedLogin("attacker");
      instance.recordFailedLogin("attacker");
      assertFalse(instance.isLoginBlocked("attacker"));
      instance.recordFailedLogin("attacker");
      assertTrue(instance.isLoginBlocked("attacker"));
    }
  }

  @Test
  void updateLoginConfigurationReplacesTheSingleton() {
    LoginConfiguration first =
        new LoginConfiguration().withMaxLoginFailAttempts(3).withAccessBlockTime(600);
    LoginConfiguration second =
        new LoginConfiguration().withMaxLoginFailAttempts(5).withAccessBlockTime(600);

    try (MockedStatic<SettingsCache> settingsCache =
        org.mockito.Mockito.mockStatic(SettingsCache.class)) {
      settingsCache
          .when(
              () ->
                  SettingsCache.getSetting(
                      SettingsType.LOGIN_CONFIGURATION, LoginConfiguration.class))
          .thenReturn(first, second);

      LoginAttemptCache original = LoginAttemptCache.getInstance();
      assertNotNull(original);
      // The first cache trips the lockout at 3 failures.
      original.recordFailedLogin("attacker");
      original.recordFailedLogin("attacker");
      original.recordFailedLogin("attacker");
      assertTrue(original.isLoginBlocked("attacker"), "first config trips at 3 failures");

      LoginAttemptCache.updateLoginConfiguration();
      LoginAttemptCache after = LoginAttemptCache.getInstance();

      assertNotSame(original, after, "updateLoginConfiguration must swap the singleton");
      // The replacement cache reads the second configuration: 3 failures are no longer
      // enough, and the lockout trips only at 5.
      after.recordFailedLogin("attacker");
      after.recordFailedLogin("attacker");
      after.recordFailedLogin("attacker");
      assertFalse(after.isLoginBlocked("attacker"), "second config does not trip at 3");
      after.recordFailedLogin("attacker");
      after.recordFailedLogin("attacker");
      assertTrue(after.isLoginBlocked("attacker"), "second config trips at 5 failures");
    }
  }

  @Test
  void isLoginBlockedReturnsFalseWhenTheLoaderThrows() throws Exception {
    LoginAttemptCache cache = new LoginAttemptCache(3, 600);
    injectThrowingCache(cache);

    assertFalse(cache.isLoginBlocked("anyone"), "a thrown loader must not block login");
  }

  @Test
  void getUserFailedLoginCountReturnsMinusOneWhenTheLoaderThrows() throws Exception {
    LoginAttemptCache cache = new LoginAttemptCache(3, 600);
    injectThrowingCache(cache);

    assertEquals(-1, cache.getUserFailedLoginCount("anyone"), "a thrown loader reports -1");
  }

  private static void injectThrowingCache(LoginAttemptCache cache) throws Exception {
    @SuppressWarnings("unchecked")
    LoadingCache<String, Integer> throwing = mock(LoadingCache.class);
    when(throwing.get(org.mockito.ArgumentMatchers.anyString()))
        .thenThrow(new ExecutionException("boom", new RuntimeException()));
    Field f = LoginAttemptCache.class.getDeclaredField("attemptsCache");
    f.setAccessible(true);
    f.set(cache, throwing);
  }

  private static LoginAttemptCache swapInstance(LoginAttemptCache replacement) throws Exception {
    Field instance = LoginAttemptCache.class.getDeclaredField("INSTANCE");
    instance.setAccessible(true);
    LoginAttemptCache previous = (LoginAttemptCache) instance.get(null);
    instance.set(null, replacement);
    return previous;
  }
}
