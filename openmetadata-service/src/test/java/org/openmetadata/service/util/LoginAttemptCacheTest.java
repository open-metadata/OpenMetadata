package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.security.auth.LoginAttemptCache;

@Slf4j
public class LoginAttemptCacheTest {
  @Test
  void testFailedLogin() throws InterruptedException {
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
    Thread.sleep(2000);
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
    Thread.sleep(2000);
    assertFalse(cache.isLoginBlocked(testKey));
  }
}
