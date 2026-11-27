/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.security.auth.validator;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.BadRequestException;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.openmetadata.catalog.security.client.SamlSSOClientConfig;
import org.openmetadata.catalog.type.IdentityProviderConfig;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;

class SamlIdpCertificateGateTest {
  private static final String STANDARD_PEM = "standard PEM";
  private static final String CERTIFICATE_FIELD = "samlConfiguration.idp.idpX509Certificate";
  private static final String VALID = resource("/saml/mock-idp.crt");
  private static final String OTHER_VALID = resource("/saml/other-idp.crt");
  private static final String EXPIRED = resource("/saml/expired-idp.crt");
  private static final String NOT_A_CERTIFICATE =
      "-----BEGIN CERTIFICATE-----\nnot-a-certificate\n-----END CERTIFICATE-----";
  private static final String WHITESPACE_ONLY = "  \n\t ";

  @Test
  void refusesANewCertificateTheSaveCheckRefusesAndNamesTheField() {
    final BadRequestException refused =
        assertThrows(
            BadRequestException.class,
            () -> SamlIdpCertificateGate.requireUsable(saml(NOT_A_CERTIFICATE), null));

    assertTrue(refused.getMessage().contains(CERTIFICATE_FIELD));
    assertTrue(refused.getMessage().contains(STANDARD_PEM));
  }

  @Test
  void refusesAChangedCertificateTheSaveCheckRefuses() {
    assertThrows(
        BadRequestException.class,
        () -> SamlIdpCertificateGate.requireUsable(saml(NOT_A_CERTIFICATE), saml(VALID)));
    assertThrows(
        BadRequestException.class,
        () -> SamlIdpCertificateGate.requireUsable(saml(EXPIRED), saml(VALID)));
  }

  /** The server cannot start on a certificate of only whitespace, so a save refuses it. */
  @Test
  void refusesAWhitespaceOnlyCertificate() {
    final BadRequestException refused =
        assertThrows(
            BadRequestException.class,
            () -> SamlIdpCertificateGate.requireUsable(saml(WHITESPACE_ONLY), null));

    assertTrue(refused.getMessage().contains(CERTIFICATE_FIELD));
    assertThrows(
        BadRequestException.class,
        () -> SamlIdpCertificateGate.requireUsable(saml(WHITESPACE_ONLY), saml(VALID)));
  }

  @Test
  void acceptsANewOrChangedCertificateTheSaveCheckAccepts() {
    assertDoesNotThrow(() -> SamlIdpCertificateGate.requireUsable(saml(VALID), null));
    assertDoesNotThrow(() -> SamlIdpCertificateGate.requireUsable(saml(OTHER_VALID), saml(VALID)));
  }

  /** A certificate that expired after it was stored keeps working at runtime; a restart keeps it. */
  @Test
  void neverChecksACertificateTheDatabaseAlreadyHolds() {
    assertDoesNotThrow(() -> SamlIdpCertificateGate.requireUsable(saml(EXPIRED), saml(EXPIRED)));
  }

  @Test
  void checksTheCertificateWhenTheStoredConfigurationIsAnotherProvider() {
    final AuthenticationConfiguration storedBasic =
        saml(NOT_A_CERTIFICATE).withProvider(AuthProvider.BASIC);

    assertThrows(
        BadRequestException.class,
        () -> SamlIdpCertificateGate.requireUsable(saml(NOT_A_CERTIFICATE), storedBasic));
  }

  @Test
  void ignoresAnotherProviderOrAMissingCertificate() {
    assertDoesNotThrow(
        () ->
            SamlIdpCertificateGate.requireUsable(
                saml(NOT_A_CERTIFICATE).withProvider(AuthProvider.GOOGLE), null));
    assertDoesNotThrow(() -> SamlIdpCertificateGate.requireUsable(saml(""), null));
    assertDoesNotThrow(() -> SamlIdpCertificateGate.requireUsable(saml(null), null));
    assertDoesNotThrow(
        () ->
            SamlIdpCertificateGate.requireUsable(
                new AuthenticationConfiguration().withProvider(AuthProvider.SAML), null));
    assertDoesNotThrow(() -> SamlIdpCertificateGate.requireUsable(null, null));
  }

  private static AuthenticationConfiguration saml(final String idpCertificate) {
    return new AuthenticationConfiguration()
        .withProvider(AuthProvider.SAML)
        .withSamlConfiguration(
            new SamlSSOClientConfig()
                .withIdp(
                    new IdentityProviderConfig()
                        .withEntityId("https://idp.example.com/metadata")
                        .withIdpX509Certificate(idpCertificate)));
  }

  private static String resource(final String path) {
    try (InputStream stream = SamlIdpCertificateGateTest.class.getResourceAsStream(path)) {
      return new String(stream.readAllBytes(), StandardCharsets.US_ASCII);
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
  }
}
