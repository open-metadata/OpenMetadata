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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.ws.rs.BadRequestException;
import java.util.Optional;
import org.openmetadata.catalog.security.client.SamlSSOClientConfig;
import org.openmetadata.catalog.type.IdentityProviderConfig;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.system.FieldError;

/**
 * Lets a SAML identity provider certificate reach the database only after it passed the check a
 * save of the configuration runs ({@link SamlValidator#validateIdpCertificate}). Its one caller is
 * the step every settings write passes through before it is stored, so every way in, now or later,
 * is covered: an API save, an administration command, a seed or a reconciled deployment value.
 *
 * <p>Only a certificate that is new or differs from the stored one is checked. A stored certificate
 * that expired since it was saved keeps working at runtime, so an unchanged value is never refused
 * again. ADR:2026-11-20-the-stored-saml-idp-certificate-is-standard-pem
 */
public final class SamlIdpCertificateGate {
  private static final String REFUSED =
      "The SAML IdP certificate samlConfiguration.idp.idpX509Certificate (SAML_IDP_CERTIFICATE"
          + " in a deployment) was refused: %s. Give it in standard PEM, each BEGIN and END"
          + " CERTIFICATE line on its own line, or in an environment variable as the base64 body"
          + " alone on one line, without those lines. It must hold a certificate valid today.";

  private SamlIdpCertificateGate() {}

  /**
   * Throws a {@link BadRequestException} naming the field when {@code candidate} uses SAML with a
   * new or changed IdP certificate that the save check refuses. {@code stored} is the configuration
   * in the database, or null when there is none.
   */
  public static void requireUsable(
      final AuthenticationConfiguration candidate, final AuthenticationConfiguration stored) {
    final Optional<String> certificate = activeIdpCertificate(candidate);
    final boolean changed =
        certificate.isPresent() && !certificate.equals(activeIdpCertificate(stored));
    // validateIdpCertificate reads the certificate with the strict parser the server uses at
    // startup; loosening it would let through certificates the server cannot read.
    final FieldError error =
        changed
            ? new SamlValidator().validateIdpCertificate(candidate.getSamlConfiguration())
            : null;
    if (error != null) {
      throw new BadRequestException(String.format(REFUSED, error.getError()));
    }
  }

  private static Optional<String> activeIdpCertificate(final AuthenticationConfiguration config) {
    return Optional.ofNullable(config)
        .filter(authConfig -> authConfig.getProvider() == AuthProvider.SAML)
        .map(AuthenticationConfiguration::getSamlConfiguration)
        .map(SamlSSOClientConfig::getIdp)
        .map(IdentityProviderConfig::getIdpX509Certificate)
        // The same test as the save check and the startup reader: a value of only whitespace is a
        // certificate they try to read, so it is checked here too instead of being let through.
        .filter(value -> !nullOrEmpty(value));
  }
}
