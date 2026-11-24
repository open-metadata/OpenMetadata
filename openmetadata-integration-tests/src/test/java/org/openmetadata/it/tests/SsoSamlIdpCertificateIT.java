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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeFalse;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.sso.config.SecurityConfigSwap;
import org.openmetadata.it.sso.config.SecurityConfigSwap.Answer;
import org.openmetadata.it.sso.config.SsoConfigs;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;
import org.openmetadata.service.config.source.SettingsSecrets;
import org.openmetadata.service.resources.settings.SettingsCache;

/**
 * Every API save of the security configuration stores a SAML IdP certificate only after it passed
 * the check a save runs, so an administrator cannot store one that stops the next restart. A
 * certificate the database already holds is not checked again, so an expired one stays usable.
 * ADR:2026-11-20-the-stored-saml-idp-certificate-is-standard-pem
 */
@Isolated
@Execution(ExecutionMode.SAME_THREAD)
class SsoSamlIdpCertificateIT {
  private static final String NOT_APPLIED = "could not be applied";
  private static final String IDP_ENTITY_ID = "https://idp.saml-certificate-it.invalid";
  private static final String SP_ENTITY_ID = "openmetadata-saml-certificate-it";
  private static final String CERTIFICATE_FIELD = "samlConfiguration.idp.idpX509Certificate";
  private static final String CERTIFICATE_POINTER =
      "/authenticationConfiguration/samlConfiguration/idp/idpX509Certificate";
  private static final String VALID = resource("/saml/mock-idp.crt");
  private static final String OTHER_VALID = resource("/saml/other-idp.crt");
  private static final String EXPIRED = resource("/saml/expired-idp.crt");
  private static final String NOT_A_CERTIFICATE =
      "-----BEGIN CERTIFICATE-----\nnot-a-certificate\n-----END CERTIFICATE-----";
  private static final String PEM_BEGIN = "-----BEGIN CERTIFICATE-----";
  private static final String PEM_END = "-----END CERTIFICATE-----";

  /** The layouts the server cannot read at startup: one line, or spaces for line breaks. */
  private static final String OTHER_VALID_SINGLE_LINE =
      PEM_BEGIN
          + OTHER_VALID.replace(PEM_BEGIN, "").replace(PEM_END, "").replaceAll("\\s+", "")
          + PEM_END;

  private static final String OTHER_VALID_SPACED = OTHER_VALID.strip().replace("\n", " ");

  /** Whitespace only: the startup reader tries to read it and fails, so a save must refuse it. */
  private static final String WHITESPACE_ONLY = "  \n\t ";

  private static SecurityConfigSwap securityConfig;

  @BeforeAll
  static void startFromSaml() {
    assumeFalse(OssTestServer.isExternalMode(), "Reconfigures the embedded server's SSO");
    securityConfig = SecurityConfigSwap.snapshotLiveConfig();
    securityConfig.applyBaseline(withIdpCertificate(securityConfig.originalCopy(), VALID));
  }

  @AfterAll
  static void restoreTheLiveConfiguration() {
    if (securityConfig != null) {
      securityConfig.close();
    }
  }

  @Test
  @DisplayName(
      "A PUT with an unusable or old-layout IdP certificate is refused with a 400 and writes"
          + " nothing")
  void putRefusesAnUnusableCertificateAndWritesNothing() {
    final JsonNode stored = SecurityConfigSwap.storedConfig();

    for (final String unusable :
        new String[] {
          NOT_A_CERTIFICATE, EXPIRED, OTHER_VALID_SINGLE_LINE, OTHER_VALID_SPACED, WHITESPACE_ONLY
        }) {
      final Answer answer =
          SecurityConfigSwap.attemptPut(
              withIdpCertificate(securityConfig.baselineCopy(), unusable));

      assertEquals(400, answer.status(), answer.body());
      assertTrue(answer.body().contains(CERTIFICATE_FIELD), answer.body());
      assertEquals(stored, SecurityConfigSwap.storedConfig(), "a refused PUT stores nothing");
    }
  }

  @Test
  @DisplayName("A PUT with a usable new IdP certificate stores it")
  void putStoresAUsableCertificate() {
    try {
      final Answer answer =
          SecurityConfigSwap.attemptPut(
              withIdpCertificate(securityConfig.baselineCopy(), OTHER_VALID));

      assertEquals(200, answer.status(), answer.body());
      assertEquals(OTHER_VALID, SecurityConfigSwap.storedConfig().at(CERTIFICATE_POINTER).asText());
    } finally {
      securityConfig.restoreBaseline();
    }
  }

  /** A certificate can expire after it was stored; sending it back unchanged must still work. */
  @Test
  @DisplayName("A PUT that sends the stored expired IdP certificate back unchanged is accepted")
  void putAcceptsTheStoredExpiredCertificateUnchanged() {
    final SecurityConfiguration expired =
        withIdpCertificate(securityConfig.baselineCopy(), EXPIRED);
    storeWithoutChecks(expired);
    try {
      final Answer answer = SecurityConfigSwap.attemptPut(expired);

      assertEquals(200, answer.status(), answer.body());
      assertEquals(EXPIRED, SecurityConfigSwap.storedConfig().at(CERTIFICATE_POINTER).asText());
    } finally {
      securityConfig.restoreBaseline();
    }
  }

  /**
   * A save the server cannot apply is undone by putting back the rows it replaced. They go back as
   * they were read: checked again against the refused save, the expired certificate would be
   * refused and the refused save left stored.
   */
  @Test
  @DisplayName("A refused save over a stored expired IdP certificate puts the rows back unchanged")
  void aRefusedSaveOverAStoredExpiredCertificatePutsTheRowsBack(@TempDir Path directory)
      throws IOException {
    storeWithoutChecks(withIdpCertificate(securityConfig.baselineCopy(), EXPIRED));
    final String storedRow = storedAuthenticationRow();
    final Path notAKeyStore = Files.writeString(directory.resolve("saml-sp.jks"), "not a keystore");
    final SecurityConfiguration cannotBeApplied = securityConfig.baselineCopy();
    cannotBeApplied
        .getAuthenticationConfiguration()
        .getSamlConfiguration()
        .getSecurity()
        .withSendSignedAuthRequest(true)
        .withKeyStoreFilePath(notAKeyStore.toString())
        .withKeyStoreAlias("sp")
        .withKeyStorePassword("keystore-password");
    try {
      final Answer answer = SecurityConfigSwap.attemptPut(cannotBeApplied);

      assertEquals(400, answer.status(), answer.body());
      assertTrue(answer.body().contains(NOT_APPLIED), answer.body());
      assertEquals(storedRow, storedAuthenticationRow());
    } finally {
      securityConfig.restoreBaseline();
    }
  }

  @Test
  @DisplayName(
      "A PATCH with an unusable or old-layout IdP certificate is refused with a 400 and writes"
          + " nothing")
  void patchRefusesAnUnusableCertificateAndWritesNothing() {
    final JsonNode stored = SecurityConfigSwap.storedConfig();

    for (final String unusable :
        new String[] {
          NOT_A_CERTIFICATE, EXPIRED, OTHER_VALID_SINGLE_LINE, OTHER_VALID_SPACED, WHITESPACE_ONLY
        }) {
      final Answer answer = SecurityConfigSwap.attemptPatch(replaceCertificate(unusable));

      assertEquals(400, answer.status(), answer.body());
      assertTrue(answer.body().contains(CERTIFICATE_FIELD), answer.body());
      assertEquals(stored, SecurityConfigSwap.storedConfig(), "a refused PATCH stores nothing");
    }
  }

  @Test
  @DisplayName("A PATCH with a usable new IdP certificate stores it")
  void patchStoresAUsableCertificate() {
    try {
      final Answer answer = SecurityConfigSwap.attemptPatch(replaceCertificate(OTHER_VALID));

      assertEquals(204, answer.status(), answer.body());
      assertEquals(OTHER_VALID, SecurityConfigSwap.storedConfig().at(CERTIFICATE_POINTER).asText());
    } finally {
      securityConfig.restoreBaseline();
    }
  }

  /** A PATCH of a login switch alone is not validated in full; the write step still runs. */
  @Test
  @DisplayName("A PATCH that keeps the stored expired IdP certificate is accepted")
  void patchKeepsTheStoredExpiredCertificate() {
    storeWithoutChecks(withIdpCertificate(securityConfig.baselineCopy(), EXPIRED));
    try {
      final Answer answer =
          SecurityConfigSwap.attemptPatch(
              "[{\"op\":\"replace\",\"path\":\"/authenticationConfiguration/enableSelfSignup\","
                  + "\"value\":false}]");

      assertEquals(204, answer.status(), answer.body());
      assertEquals(EXPIRED, SecurityConfigSwap.storedConfig().at(CERTIFICATE_POINTER).asText());
    } finally {
      securityConfig.restoreBaseline();
    }
  }

  @Test
  @DisplayName("The generic settings endpoints refuse the authentication configuration")
  void genericSettingsEndpointsRefuseTheAuthenticationConfiguration() {
    final JsonNode stored = SecurityConfigSwap.storedConfig();
    final Settings settings =
        new Settings()
            .withConfigType(SettingsType.AUTHENTICATION_CONFIGURATION)
            .withConfigValue(
                withIdpCertificate(securityConfig.baselineCopy(), NOT_A_CERTIFICATE)
                    .getAuthenticationConfiguration());

    assertThrows(
        Exception.class,
        () ->
            SdkClients.adminClient()
                .getHttpClient()
                .executeForString(
                    HttpMethod.PUT,
                    "/v1/system/settings",
                    JsonUtils.pojoToJson(settings),
                    RequestOptions.builder().build()));
    assertEquals(stored, SecurityConfigSwap.storedConfig());
  }

  private static String replaceCertificate(final String idpCertificate) {
    return "[{\"op\":\"replace\",\"path\":\"/authenticationConfiguration/samlConfiguration/idp/"
        + "idpX509Certificate\",\"value\":"
        + JsonUtils.pojoToJson(idpCertificate)
        + "}]";
  }

  private static SecurityConfiguration withIdpCertificate(
      final SecurityConfiguration base, final String idpCertificate) {
    return SsoConfigs.saml(base, IDP_ENTITY_ID, idpCertificate, SP_ENTITY_ID);
  }

  /**
   * Stands for a certificate that was valid when it was saved and has expired since: the row is
   * written as time would leave it, past the settings write step that refuses a new expired one.
   */
  private static void storeWithoutChecks(final SecurityConfiguration config) {
    Entity.getCollectionDAO()
        .systemDAO()
        .insertSettings(
            SettingsType.AUTHENTICATION_CONFIGURATION.value(),
            JsonUtils.pojoToJson(
                SettingsSecrets.encrypted(
                    SettingsType.AUTHENTICATION_CONFIGURATION,
                    JsonUtils.valueToTree(config.getAuthenticationConfiguration()))));
    SettingsCache.invalidateSettings(SettingsType.AUTHENTICATION_CONFIGURATION.value());
  }

  private static String storedAuthenticationRow() {
    return Entity.getCollectionDAO()
        .systemDAO()
        .getConfigJsonWithKey(SettingsType.AUTHENTICATION_CONFIGURATION.value());
  }

  private static String resource(final String path) {
    try (InputStream stream = SsoSamlIdpCertificateIT.class.getResourceAsStream(path)) {
      return new String(stream.readAllBytes(), StandardCharsets.US_ASCII);
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
  }
}
