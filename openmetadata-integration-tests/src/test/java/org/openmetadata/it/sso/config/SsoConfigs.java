package org.openmetadata.it.sso.config;

import java.util.List;
import org.openmetadata.it.sso.oidc.MockOidcProvider;
import org.openmetadata.schema.api.security.ClientType;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Security configurations that point the server under test at a mock identity provider. Each
 * starts from a copy of the live configuration, so the authorizer settings (admins, domains) stay
 * as the rest of the suite expects unless a test changes them.
 */
public final class SsoConfigs {
  /** The schema requires a tenant for every OIDC client, even where the provider has none. */
  public static final String TENANT = "sso-it";

  public static final String SCOPE_WITH_REFRESH_TOKEN = "openid email profile offline_access";
  private static final String PROVIDER_NAME = "Mock OIDC";

  private SsoConfigs() {}

  public static SecurityConfiguration confidentialOidc(
      SecurityConfiguration live, MockOidcProvider provider) {
    SecurityConfiguration config = copyOf(live);
    config
        .getAuthenticationConfiguration()
        .withProvider(provider.profile().provider())
        .withProviderName(PROVIDER_NAME)
        .withClientType(ClientType.CONFIDENTIAL)
        .withAuthority(provider.issuer())
        .withClientId(MockOidcProvider.CLIENT_ID)
        .withCallbackUrl(SsoServer.url(SsoServer.CALLBACK_PATH))
        .withOidcConfiguration(confidentialClient(provider));
    return config;
  }

  /**
   * A public client: the single-page app signs in at the provider itself and presents the
   * provider's ID token, which the server validates against the provider's JWKS.
   */
  public static SecurityConfiguration publicOidc(
      SecurityConfiguration live, MockOidcProvider provider) {
    SecurityConfiguration config = copyOf(live);
    config
        .getAuthenticationConfiguration()
        .withProvider(provider.profile().provider())
        .withProviderName(PROVIDER_NAME)
        .withClientType(ClientType.PUBLIC)
        .withAuthority(provider.issuer())
        .withClientId(MockOidcProvider.CLIENT_ID)
        .withCallbackUrl(SsoServer.url(SsoServer.CALLBACK_PATH))
        .withPublicKeyUrls(List.of(provider.jwksUri()));
    return config;
  }

  private static OidcClientConfig confidentialClient(MockOidcProvider provider) {
    return new OidcClientConfig()
        .withType(provider.profile().clientType())
        .withId(MockOidcProvider.CLIENT_ID)
        .withSecret(MockOidcProvider.CLIENT_SECRET)
        .withDiscoveryUri(provider.discoveryUri())
        .withTenant(TENANT)
        .withScope(SCOPE_WITH_REFRESH_TOKEN)
        .withCallbackUrl(SsoServer.url(SsoServer.CALLBACK_PATH))
        .withServerUrl(SsoServer.root());
  }

  public static SecurityConfiguration copyOf(SecurityConfiguration config) {
    return JsonUtils.readValue(JsonUtils.pojoToJson(config), SecurityConfiguration.class);
  }
}
