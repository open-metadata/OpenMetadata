package org.openmetadata.service.security.session;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.security.client.OidcClientConfig;

class SessionTimeoutResolverTest {

  @Test
  void resolveSessionExpirySeconds_prefersTopLevelConfiguration() {
    AuthenticationConfiguration authConfig =
        new AuthenticationConfiguration()
            .withSessionExpiry(7_200)
            .withOidcConfiguration(new OidcClientConfig().withSessionExpiry(10_800));

    assertEquals(7_200, SessionTimeoutResolver.resolveSessionExpirySeconds(authConfig));
  }

  @Test
  void resolveSessionExpirySeconds_fallsBackToLegacyOidcSetting() {
    AuthenticationConfiguration authConfig =
        new AuthenticationConfiguration()
            .withOidcConfiguration(new OidcClientConfig().withSessionExpiry(10_800));

    assertEquals(10_800, SessionTimeoutResolver.resolveSessionExpirySeconds(authConfig));
  }

  @Test
  void resolveSessionExpirySeconds_usesDefaultWhenConfiguredValueIsBelowMinimum() {
    AuthenticationConfiguration authConfig =
        new AuthenticationConfiguration().withSessionExpiry(900);

    assertEquals(
        SessionTimeoutResolver.DEFAULT_SESSION_EXPIRY_SECONDS,
        SessionTimeoutResolver.resolveSessionExpirySeconds(authConfig));
  }
}
