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

package org.openmetadata.service.migration.utils.v2010;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/**
 * Rewrites the stored SAML identity provider certificate as standard PEM.
 *
 * <p>Until 2.0.10 the server read that certificate leniently, so a value pasted on a single line, or
 * with spaces where the line breaks belong, worked. From 2.0.10 the server reads it with the JDK
 * certificate parser, which rejects those layouts and stops the server from starting. This step
 * gives such a value the standard layout once, so the server keeps starting after the upgrade. A
 * value it cannot read as certificates is left as stored.
 *
 * <p>ADR:2026-11-20-the-stored-saml-idp-certificate-is-standard-pem
 */
@Slf4j
public final class SamlIdpCertificateMigration {
  public static final String STEP_NAME = "rewriteSamlIdpCertificateAsPem";

  private static final String AUTHENTICATION_CONFIGURATION = "authenticationConfiguration";
  private static final String SAML_CONFIGURATION = "samlConfiguration";
  private static final String IDP = "idp";
  private static final String IDP_CERTIFICATE = "idpX509Certificate";

  private static final String SELECT_CONFIGURATION =
      "SELECT json FROM openmetadata_settings WHERE configType = :configType";
  private static final String UPDATE_CERTIFICATE_MYSQL =
      "UPDATE openmetadata_settings"
          + " SET json = JSON_SET(json, '$.samlConfiguration.idp.idpX509Certificate', :certificate)"
          + " WHERE configType = :configType";
  private static final String UPDATE_CERTIFICATE_POSTGRES =
      "UPDATE openmetadata_settings"
          + " SET json = jsonb_set(json, '{samlConfiguration,idp,idpX509Certificate}',"
          + " to_jsonb(CAST(:certificate AS TEXT)))"
          + " WHERE configType = :configType";

  private SamlIdpCertificateMigration() {}

  public static void rewriteAsPem(final Handle handle, final ConnectionType connectionType) {
    storedCertificate(handle)
        .ifPresent(stored -> rewriteIfNotStandard(handle, connectionType, stored));
  }

  private static Optional<String> storedCertificate(final Handle handle) {
    return handle
        .createQuery(SELECT_CONFIGURATION)
        .bind("configType", AUTHENTICATION_CONFIGURATION)
        .mapTo(String.class)
        .findOne()
        .map(JsonUtils::readTree)
        .map(
            configuration -> configuration.path(SAML_CONFIGURATION).path(IDP).path(IDP_CERTIFICATE))
        .filter(JsonNode::isTextual)
        .map(JsonNode::asText)
        .filter(certificate -> !certificate.isBlank());
  }

  private static void rewriteIfNotStandard(
      final Handle handle, final ConnectionType connectionType, final String stored) {
    final Optional<String> standard = IdpCertificatePem.standardPem(stored);
    standard
        .filter(pem -> !pem.equals(stored.stripTrailing()))
        .ifPresent(pem -> write(handle, connectionType, pem));
    if (standard.isEmpty()) {
      LOG.warn(
          "The SAML identity provider certificate is left as stored: it holds something other than"
              + " X.509 certificates. If the server does not start, enter the certificate again in"
              + " standard PEM.");
    }
  }

  private static void write(
      final Handle handle, final ConnectionType connectionType, final String certificate) {
    handle
        .createUpdate(
            connectionType == ConnectionType.MYSQL
                ? UPDATE_CERTIFICATE_MYSQL
                : UPDATE_CERTIFICATE_POSTGRES)
        .bind("configType", AUTHENTICATION_CONFIGURATION)
        .bind("certificate", certificate)
        .execute();
    LOG.info("Rewrote the SAML identity provider certificate as standard PEM");
  }
}
