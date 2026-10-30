package org.openmetadata.service.security.auth;

import org.openmetadata.service.security.credentials.Credentials;

/** Kept for other distributions that call {@link #invalidateToken}. */
public final class UserTokenCache {
  private UserTokenCache() {}

  /**
   * @deprecated use {@link Credentials#changed(String)}.
   */
  @Deprecated
  public static void invalidateToken(String userName) {
    Credentials.changed(userName);
  }
}
