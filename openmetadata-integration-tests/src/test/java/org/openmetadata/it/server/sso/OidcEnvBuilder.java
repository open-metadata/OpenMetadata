package org.openmetadata.it.server.sso;

import java.util.HashMap;
import java.util.Map;

/**
 * Builds the OM container env-var map for an OIDC SSO provider, factoring out the
 * boilerplate that's identical across {@link GoogleProfile}, {@link OktaProfile}, and
 * {@link CustomOidcProfile}.
 *
 * <p>Only the values the OM YAML changes per-provider — {@code AUTHENTICATION_PROVIDER},
 * {@code OIDC_TYPE}, and (for custom OIDC) {@code CUSTOM_OIDC_AUTHENTICATION_PROVIDER_NAME}
 * — vary; the rest of the OAuth2 config is the same shape.
 */
final class OidcEnvBuilder {

  private OidcEnvBuilder() {}

  /**
   * @param providerKey value for {@code AUTHENTICATION_PROVIDER} and {@code OIDC_TYPE}
   *     (e.g. {@code "google"}, {@code "okta"}, {@code "custom-oidc"})
   * @param customProviderName populated only for custom-OIDC; sets
   *     {@code CUSTOM_OIDC_AUTHENTICATION_PROVIDER_NAME}; pass {@code null} otherwise
   */
  static Map<String, String> build(
      final String providerKey,
      final String issuerId,
      final ClientType clientType,
      final String clientId,
      final String clientSecret,
      final MockOidcServer idp,
      final int omHostPort,
      final String customProviderName) {
    final String issuer = idp.issuerUrl(issuerId).toString();
    final String jwks = idp.jwksUrl(issuerId).toString();
    final String discovery = idp.discoveryUrl(issuerId).toString();
    final String callback = "http://localhost:" + omHostPort + "/callback";
    final String serverUrl = "http://localhost:" + omHostPort;

    // OM still mints/validates its own internal & bot JWTs in SSO mode, so its own JWKS
    // endpoint must remain in the list alongside the mock IdP's — dropping it (as a bare
    // "[<idpJwks>]" would) breaks validation of OM-issued tokens. Matches the existing SSO
    // CI config which lists both.
    final String omJwks = serverUrl + "/api/v1/system/config/jwks";
    final Map<String, String> env = new HashMap<>();
    env.put("AUTHENTICATION_PROVIDER", providerKey);
    env.put("AUTHENTICATION_AUTHORITY", issuer);
    env.put("AUTHENTICATION_CLIENT_ID", clientId);
    env.put("AUTHENTICATION_CALLBACK_URL", callback);
    env.put("AUTHENTICATION_PUBLIC_KEYS", "[" + omJwks + "," + jwks + "]");
    env.put("AUTHENTICATION_CLIENT_TYPE", clientTypeValue(clientType));
    env.put("AUTHENTICATION_RESPONSE_TYPE", responseTypeValue(clientType));
    if (customProviderName != null && !customProviderName.isBlank()) {
      env.put("CUSTOM_OIDC_AUTHENTICATION_PROVIDER_NAME", customProviderName);
    }
    if (clientType == ClientType.CONFIDENTIAL) {
      env.put("OIDC_TYPE", providerKey);
      env.put("OIDC_CLIENT_ID", clientId);
      env.put("OIDC_CLIENT_SECRET", clientSecret);
      env.put("OIDC_DISCOVERY_URI", discovery);
      env.put("OIDC_CALLBACK", callback);
      env.put("OIDC_SERVER_URL", serverUrl);
      env.put("OIDC_RESPONSE_TYPE", "code");
    }
    return env;
  }

  private static String clientTypeValue(final ClientType clientType) {
    return clientType == ClientType.CONFIDENTIAL ? "confidential" : "public";
  }

  private static String responseTypeValue(final ClientType clientType) {
    return clientType == ClientType.CONFIDENTIAL ? "code" : "id_token";
  }
}
