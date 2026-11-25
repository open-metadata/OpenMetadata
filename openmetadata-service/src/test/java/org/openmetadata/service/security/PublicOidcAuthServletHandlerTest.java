package org.openmetadata.service.security;

import static org.assertj.core.api.Assertions.assertThat;

import com.nimbusds.openid.connect.sdk.op.OIDCProviderMetadata;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;

class PublicOidcAuthServletHandlerTest {
  @ParameterizedTest
  @CsvSource({
    "CUSTOM_OIDC, /realms/catalog/, /realms/catalog",
    "AUTH_0, /, ''",
    "AZURE, /tenant, /tenant/v2.0",
    "AZURE, /tenant/v2.0/, /tenant/v2.0"
  })
  void derivesDiscoveryFromThePublicAuthority(
      AuthProvider provider, String authorityPath, String discoveryPath) {
    String authority = "https://localhost" + authorityPath;
    String callback = "https://ui.example.com/auth/callback";
    AuthenticationConfiguration authentication =
        new AuthenticationConfiguration()
            .withProvider(provider)
            .withAuthority(authority)
            .withCallbackUrl(callback)
            .withClientId("public-client")
            .withOidcConfiguration(
                new OidcClientConfig().withId("old-client").withSecret("unused"));

    OidcClientConfig client =
        PublicOidcAuthServletHandler.publicCodeFlow(
            authentication, "https://catalog.example.com/catalog");
    assertThat(client.getDiscoveryUri())
        .isEqualTo("https://localhost" + discoveryPath + "/.well-known/openid-configuration");
    assertThat(client.getId()).isEqualTo("public-client");
    assertThat(client.getCallbackUrl())
        .isEqualTo("https://catalog.example.com/catalog/mcp/callback");
    assertThat(authentication.getCallbackUrl()).isEqualTo(callback);
    assertThat(client.getSecret()).isNull();
    assertThat(client.getDisablePkce()).isFalse();
  }

  @ParameterizedTest
  @ValueSource(strings = {"common", "organizations"})
  void readsTenantIndependentEntraDiscovery(String tenant) throws Exception {
    final String authority = "https://login.microsoftonline.com/" + tenant;
    final String document =
        """
        {
          "issuer": "https://login.microsoftonline.com/{tenantid}/v2.0",
          "authorization_endpoint": "%1$s/oauth2/v2.0/authorize",
          "token_endpoint": "%1$s/oauth2/v2.0/token",
          "jwks_uri": "%1$s/discovery/v2.0/keys",
          "subject_types_supported": ["pairwise"],
          "response_types_supported": ["code"],
          "id_token_signing_alg_values_supported": ["RS256"]
        }
        """
            .formatted(authority);

    final OIDCProviderMetadata metadata =
        PublicOidcAuthServletHandler.parseDiscovery(document, AuthProvider.AZURE);
    assertThat(metadata.getIssuer().getValue())
        .isEqualTo("https://login.microsoftonline.com/%7Btenantid%7D/v2.0");
    assertThat(metadata.getTokenEndpointURI().toString())
        .isEqualTo(authority + "/oauth2/v2.0/token");
  }
}
