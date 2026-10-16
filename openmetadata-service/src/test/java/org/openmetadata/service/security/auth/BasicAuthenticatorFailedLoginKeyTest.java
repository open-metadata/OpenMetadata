package org.openmetadata.service.security.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import at.favre.lib.crypto.bcrypt.BCrypt;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.User;

class BasicAuthenticatorFailedLoginKeyTest {
  private static final String EMAIL = "alice@example.com";

  @Test
  void aNewPasswordIsNotLockedOutByFailuresAgainstTheOldOne() {
    LoginAttemptCache cache = new LoginAttemptCache(3, 60);
    User beforeReset = userWithStoredHash(EMAIL, hash("Old@Passw0rd"));
    User afterReset = userWithStoredHash(EMAIL, hash("New@Passw0rd"));

    for (int attempt = 0; attempt < 3; attempt++) {
      cache.recordFailedLogin(BasicAuthenticator.failedLoginKey(beforeReset));
    }

    assertTrue(cache.isLoginBlocked(BasicAuthenticator.failedLoginKey(beforeReset)));
    assertFalse(cache.isLoginBlocked(BasicAuthenticator.failedLoginKey(afterReset)));
  }

  @Test
  void everyLoginAgainstTheSameStoredPasswordSharesOneKey() {
    String storedHash = hash("Same@Passw0rd");

    assertEquals(
        BasicAuthenticator.failedLoginKey(userWithStoredHash(EMAIL, storedHash)),
        BasicAuthenticator.failedLoginKey(userWithStoredHash(EMAIL, storedHash)));
    assertNotEquals(
        BasicAuthenticator.failedLoginKey(userWithStoredHash(EMAIL, storedHash)),
        BasicAuthenticator.failedLoginKey(userWithStoredHash("bob@example.com", storedHash)));
  }

  @Test
  void theKeyDoesNotExposeTheStoredHash() {
    String storedHash = hash("Secret@Passw0rd");

    String key = BasicAuthenticator.failedLoginKey(userWithStoredHash(EMAIL, storedHash));

    assertFalse(key.contains(storedHash));
    assertTrue(key.startsWith(EMAIL));
  }

  @Test
  void aUserWithoutAPasswordStillGetsAKey() {
    User withoutPassword = new User().withName("sso-only").withEmail(EMAIL);

    assertTrue(BasicAuthenticator.failedLoginKey(withoutPassword).startsWith(EMAIL));
  }

  private static User userWithStoredHash(String email, String storedHash) {
    return new User()
        .withName(email.substring(0, email.indexOf('@')))
        .withEmail(email)
        .withAuthenticationMechanism(
            new AuthenticationMechanism()
                .withAuthType(AuthenticationMechanism.AuthType.BASIC)
                .withConfig(new LinkedHashMap<>(Map.of("password", storedHash))));
  }

  private static String hash(String password) {
    return BCrypt.withDefaults().hashToString(4, password.toCharArray());
  }
}
