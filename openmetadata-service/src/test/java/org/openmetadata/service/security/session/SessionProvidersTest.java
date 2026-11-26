package org.openmetadata.service.security.session;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;

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

  @ParameterizedTest(name = "session {0}, configured {1} -> from another provider: {2}")
  @MethodSource("sessionAndConfiguredProviders")
  void isFromAnotherProvider_judgesOnlyAKnownSessionProviderAgainstAConfiguredOne(
      String sessionProvider, AuthProvider configuredProvider, boolean fromAnotherProvider) {
    assertEquals(
        fromAnotherProvider,
        SessionProviders.isFromAnotherProvider(sessionProvider, configuredProvider));
  }

  private static Stream<Arguments> sessionAndConfiguredProviders() {
    return Stream.of(
        Arguments.of("basic", AuthProvider.GOOGLE, true),
        Arguments.of("okta", AuthProvider.SAML, true),
        Arguments.of("ldap", AuthProvider.BASIC, true),
        Arguments.of("basic", AuthProvider.LDAP, true),
        Arguments.of("openmetadata", AuthProvider.BASIC, false),
        Arguments.of("GOOGLE", AuthProvider.GOOGLE, false),
        // A tenant or issuer change within one provider type is not visible here (#38246).
        Arguments.of("custom-oidc", AuthProvider.CUSTOM_OIDC, false),
        Arguments.of(null, AuthProvider.BASIC, false),
        Arguments.of("", AuthProvider.BASIC, false),
        Arguments.of("google", null, false));
  }
}
