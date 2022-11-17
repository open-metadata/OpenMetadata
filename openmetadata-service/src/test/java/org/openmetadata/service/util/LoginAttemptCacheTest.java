package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import lombok.extern.slf4j.Slf4j;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.security.auth.LoginAttemptCache;

@Slf4j
public class LoginAttemptCacheTest {
  @Test
  void testFailedLogin() {
    String testKey = "test";
    LoginAttemptCache cache = new LoginAttemptCache(3, 1);

    // Check Failed Login
    cache.recordFailedLogin(testKey);
    assertFalse(cache.isLoginBlocked(testKey));
    cache.recordFailedLogin(testKey);
    assertFalse(cache.isLoginBlocked(testKey));
    cache.recordFailedLogin(testKey);
    assertTrue(cache.isLoginBlocked(testKey));
    cache.recordFailedLogin(testKey);
    assertTrue(cache.isLoginBlocked(testKey));

    // Check Eviction
    Awaitility.await().pollDelay(Duration.ofSeconds(2L)).untilAsserted(() -> assertTrue(true));
    assertFalse(cache.isLoginBlocked(testKey));

    // Check Successful Login
    cache.recordFailedLogin(testKey);
    assertFalse(cache.isLoginBlocked(testKey));
    cache.recordFailedLogin(testKey);
    assertFalse(cache.isLoginBlocked(testKey));
    cache.recordFailedLogin(testKey);
    assertTrue(cache.isLoginBlocked(testKey));
    cache.recordSuccessfulLogin(testKey);
    assertFalse(cache.isLoginBlocked(testKey));

    // Check Eviction
    Awaitility.await().pollDelay(Duration.ofSeconds(2L)).untilAsserted(() -> assertTrue(true));
    assertFalse(cache.isLoginBlocked(testKey));
  }
}
