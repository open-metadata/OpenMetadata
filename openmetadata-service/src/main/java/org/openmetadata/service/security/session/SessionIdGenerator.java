package org.openmetadata.service.security.session;

import java.security.SecureRandom;
import java.util.Base64;

public final class SessionIdGenerator {
  private static final int SESSION_ID_BYTES = 32;
  private static final SecureRandom SECURE_RANDOM = new SecureRandom();

  private SessionIdGenerator() {}

  public static String newSessionId() {
    byte[] bytes = new byte[SESSION_ID_BYTES];
    SECURE_RANDOM.nextBytes(bytes);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  }
}
