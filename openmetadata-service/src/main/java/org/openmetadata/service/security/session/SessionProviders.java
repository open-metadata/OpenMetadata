package org.openmetadata.service.security.session;

import java.util.Locale;
import java.util.Set;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;

/** Whether a session was issued by the identity provider the deployment is configured with now. */
public final class SessionProviders {
  private static final Set<String> NATIVE_PASSWORD_PROVIDER_VALUES =
      Set.of(AuthProvider.BASIC.value(), AuthProvider.OPENMETADATA.value());

  private SessionProviders() {}

  /**
   * {@code basic} and {@code openmetadata} are two historical names for the same native-password
   * authenticator, and one servlet handler serves both. Renaming one to the other is not a provider
   * swap and must not log the whole deployment out.
   */
  public static boolean isSameProvider(String sessionProvider, String configuredProvider) {
    return sessionProvider.equalsIgnoreCase(configuredProvider)
        || (isNativePasswordProvider(sessionProvider)
            && isNativePasswordProvider(configuredProvider));
  }

  private static boolean isNativePasswordProvider(String provider) {
    return NATIVE_PASSWORD_PROVIDER_VALUES.contains(provider.toLowerCase(Locale.ROOT));
  }
}
