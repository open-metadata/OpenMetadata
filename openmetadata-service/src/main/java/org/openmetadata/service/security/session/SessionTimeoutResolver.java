package org.openmetadata.service.security.session;

import org.openmetadata.schema.api.security.AuthenticationConfiguration;

public final class SessionTimeoutResolver {
  public static final int DEFAULT_SESSION_EXPIRY_SECONDS = 7 * 24 * 60 * 60;
  public static final int MIN_SESSION_EXPIRY_SECONDS = 60 * 60;

  private SessionTimeoutResolver() {}

  public static Integer getConfiguredSessionExpirySeconds(
      AuthenticationConfiguration authenticationConfiguration) {
    if (authenticationConfiguration == null) {
      return null;
    }
    if (authenticationConfiguration.getSessionExpiry() != null) {
      return authenticationConfiguration.getSessionExpiry();
    }
    if (authenticationConfiguration.getOidcConfiguration() != null) {
      return authenticationConfiguration.getOidcConfiguration().getSessionExpiry();
    }
    return null;
  }

  public static int resolveSessionExpirySeconds(
      AuthenticationConfiguration authenticationConfiguration) {
    Integer configuredSessionExpiry =
        getConfiguredSessionExpirySeconds(authenticationConfiguration);
    if (configuredSessionExpiry != null && configuredSessionExpiry >= MIN_SESSION_EXPIRY_SECONDS) {
      return configuredSessionExpiry;
    }
    return DEFAULT_SESSION_EXPIRY_SECONDS;
  }
}
