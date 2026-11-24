package org.openmetadata.service.security.session;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

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

  /**
   * The one provider-currency check: REST, refresh, the push-feed handshake, its sweep and the
   * reload that closes sockets on a switch all decide through it. Both values are always present
   * in practice (every session creator stamps the provider, and the configuration schema requires
   * one); the guards only keep {@link #isSameProvider} from throwing.
   * ADR:2026-10-20-a-refresh-ends-sessions-issued-by-a-provider-no-longer-configured
   */
  public static boolean isFromAnotherProvider(
      String sessionProvider, AuthProvider configuredProvider) {
    return !nullOrEmpty(sessionProvider)
        && configuredProvider != null
        && !isSameProvider(sessionProvider, configuredProvider.value());
  }

  private static boolean isNativePasswordProvider(String provider) {
    return NATIVE_PASSWORD_PROVIDER_VALUES.contains(provider.toLowerCase(Locale.ROOT));
  }
}
