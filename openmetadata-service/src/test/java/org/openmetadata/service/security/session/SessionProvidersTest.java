package org.openmetadata.service.security.session;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class SessionProvidersTest {
  @Test
  void aProviderIsItselfWhateverTheCase() {
    assertTrue(SessionProviders.isSameProvider("custom-oidc", "CUSTOM-OIDC"));
  }

  @Test
  void basicAndOpenMetadataAreOneNativePasswordProvider() {
    assertTrue(SessionProviders.isSameProvider("basic", "openmetadata"));
    assertTrue(SessionProviders.isSameProvider("openmetadata", "basic"));
  }

  @Test
  void differentProvidersAreNotTheSame() {
    assertFalse(SessionProviders.isSameProvider("custom-oidc", "basic"));
    assertFalse(SessionProviders.isSameProvider("saml", "ldap"));
  }
}
