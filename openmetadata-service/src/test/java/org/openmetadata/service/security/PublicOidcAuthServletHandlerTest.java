package org.openmetadata.service.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
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
    String callback = "https://catalog.example.com/callback";
    AuthenticationConfiguration authentication =
        new AuthenticationConfiguration()
            .withProvider(provider)
            .withAuthority(authority)
            .withCallbackUrl(callback)
            .withClientId("public-client")
            .withOidcConfiguration(
                new OidcClientConfig().withId("old-client").withSecret("unused"));

    OidcClientConfig client =
        PublicOidcAuthServletHandler.publicCodeFlow(authentication, "https://catalog.example.com");
    assertThat(client.getDiscoveryUri())
        .isEqualTo("https://localhost" + discoveryPath + "/.well-known/openid-configuration");
    assertThat(client.getId()).isEqualTo("public-client");
    assertThat(client.getCallbackUrl()).isEqualTo(callback);
    assertThat(client.getSecret()).isNull();
    assertThat(client.getDisablePkce()).isFalse();
  }
}
