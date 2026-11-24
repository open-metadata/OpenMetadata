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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.security.cert.CertificateException;
import java.security.cert.CertificateFactory;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.util.TestDatabaseImages;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

/**
 * Runs the 2.0.10 step against real MySQL and PostgreSQL. It must rewrite a single-line identity
 * provider certificate as standard PEM, change nothing else in the stored configuration or in the
 * other settings, and leave a standard, unreadable or missing certificate exactly as stored.
 */
@Testcontainers(disabledWithoutDocker = true)
class SamlIdpCertificateMigrationTest {
  private static final String PASSWORD = "saml-certificate-test";
  private static final String DATABASE = "saml_certificate_test";
  private static final String MYSQL_DIALECT = "mysql";
  private static final String POSTGRES_DIALECT = "postgres";
  private static final String AUTHENTICATION = "authenticationConfiguration";
  private static final String EMAIL = "emailConfiguration";
  private static final String BEGIN = "-----BEGIN CERTIFICATE-----";
  private static final String END = "-----END CERTIFICATE-----";
  private static final String MOCK_IDP = resource("/saml/mock-idp.crt").strip();
  private static final String SINGLE_LINE =
      BEGIN + MOCK_IDP.replace(BEGIN, "").replace(END, "").replaceAll("\\s+", "") + END;
  private static final String EMAIL_JSON =
      "{\"senderMail\":\"om@example.com\",\"serverEndpoint\":\"smtp.example.com\"}";

  @Container
  static final GenericContainer<?> MYSQL =
      new GenericContainer<>(DockerImageName.parse(TestDatabaseImages.mysql()))
          .withEnv("MYSQL_DATABASE", DATABASE)
          .withEnv("MYSQL_ROOT_PASSWORD", PASSWORD)
          .withEnv("MYSQL_ROOT_HOST", "%")
          .withExposedPorts(3306)
          .waitingFor(
              Wait.forSuccessfulCommand(
                  "mysql --protocol=TCP --host=127.0.0.1 --user=root --password="
                      + PASSWORD
                      + " --execute='SELECT 1'"));

  @Container
  static final GenericContainer<?> POSTGRES =
      new GenericContainer<>(DockerImageName.parse(TestDatabaseImages.postgres()))
          .withEnv("POSTGRES_DB", DATABASE)
          .withEnv("POSTGRES_PASSWORD", PASSWORD)
          .withExposedPorts(5432)
          .waitingFor(
              Wait.forLogMessage(".*database system is ready to accept connections.*\\n", 2));

  @ParameterizedTest
  @ValueSource(strings = {MYSQL_DIALECT, POSTGRES_DIALECT})
  void rewritesASingleLineCertificateAndNothingElse(final String dialect)
      throws CertificateException {
    try (Handle handle = open(dialect)) {
      final String before = seed(handle, dialect, samlConfiguration(SINGLE_LINE));
      final String emailBefore = stored(handle, EMAIL);

      SamlIdpCertificateMigration.rewriteAsPem(handle, connectionType(dialect));

      final JsonNode after = JsonUtils.readTree(stored(handle, AUTHENTICATION));
      final String certificate = certificateOf(after);
      assertEquals(MOCK_IDP, certificate);
      assertEquals(
          1,
          CertificateFactory.getInstance("X.509")
              .generateCertificates(
                  new ByteArrayInputStream(certificate.getBytes(StandardCharsets.US_ASCII)))
              .size());
      assertEquals(withoutCertificate(JsonUtils.readTree(before)), withoutCertificate(after));
      assertEquals(emailBefore, stored(handle, EMAIL), "other settings are untouched");
    }
  }

  @ParameterizedTest
  @ValueSource(strings = {MYSQL_DIALECT, POSTGRES_DIALECT})
  void aSecondRunChangesNothing(final String dialect) {
    try (Handle handle = open(dialect)) {
      seed(handle, dialect, samlConfiguration(SINGLE_LINE));
      SamlIdpCertificateMigration.rewriteAsPem(handle, connectionType(dialect));
      final String afterFirstRun = stored(handle, AUTHENTICATION);

      SamlIdpCertificateMigration.rewriteAsPem(handle, connectionType(dialect));

      assertEquals(afterFirstRun, stored(handle, AUTHENTICATION));
    }
  }

  @ParameterizedTest
  @ValueSource(strings = {MYSQL_DIALECT, POSTGRES_DIALECT})
  void leavesAStandardCertificateAsStored(final String dialect) {
    assertUnchanged(dialect, samlConfiguration(MOCK_IDP + "\n"));
  }

  @ParameterizedTest
  @ValueSource(strings = {MYSQL_DIALECT, POSTGRES_DIALECT})
  void leavesAnUnreadableCertificateAsStored(final String dialect) {
    assertUnchanged(dialect, samlConfiguration(BEGIN + "not-a-certificate" + END));
  }

  @ParameterizedTest
  @ValueSource(strings = {MYSQL_DIALECT, POSTGRES_DIALECT})
  void leavesAnEmptyCertificateAsStored(final String dialect) {
    assertUnchanged(dialect, samlConfiguration(""));
  }

  @ParameterizedTest
  @ValueSource(strings = {MYSQL_DIALECT, POSTGRES_DIALECT})
  void leavesANullCertificateAsStored(final String dialect) {
    final ObjectNode configuration = samlConfiguration("");
    ((ObjectNode) configuration.path("samlConfiguration").path("idp"))
        .putNull("idpX509Certificate");
    assertUnchanged(dialect, configuration);
  }

  @ParameterizedTest
  @ValueSource(strings = {MYSQL_DIALECT, POSTGRES_DIALECT})
  void leavesAConfigurationWithoutSamlAsStored(final String dialect) {
    final ObjectNode configuration = samlConfiguration(SINGLE_LINE);
    configuration.put("provider", "google");
    configuration.remove("samlConfiguration");
    assertUnchanged(dialect, configuration);
  }

  @ParameterizedTest
  @ValueSource(strings = {MYSQL_DIALECT, POSTGRES_DIALECT})
  void doesNothingWithoutAStoredConfiguration(final String dialect) {
    try (Handle handle = open(dialect)) {
      createTable(handle, dialect);

      SamlIdpCertificateMigration.rewriteAsPem(handle, connectionType(dialect));

      assertNull(stored(handle, AUTHENTICATION));
    }
  }

  private static void assertUnchanged(final String dialect, final ObjectNode configuration) {
    try (Handle handle = open(dialect)) {
      seed(handle, dialect, configuration);
      final String before = stored(handle, AUTHENTICATION);

      SamlIdpCertificateMigration.rewriteAsPem(handle, connectionType(dialect));

      assertEquals(before, stored(handle, AUTHENTICATION));
    }
  }

  private static ObjectNode samlConfiguration(final String idpCertificate) {
    return (ObjectNode)
        JsonUtils.readTree(
            "{\"provider\":\"saml\",\"providerName\":\"Okta\",\"clientType\":\"public\","
                + "\"publicKeyUrls\":[\"http://localhost:8585/api/v1/system/config/jwks\"],"
                + "\"authority\":\"http://localhost:8585/api/v1/saml/login\","
                + "\"callbackUrl\":\"http://localhost:8585/saml/acs\","
                + "\"jwtPrincipalClaims\":[\"email\",\"preferred_username\",\"sub\"],"
                + "\"enableSelfSignup\":true,"
                + "\"samlConfiguration\":{\"debugMode\":false,"
                + "\"idp\":{\"entityId\":\"http://www.okta.com/exk1\","
                + "\"ssoLoginUrl\":\"https://example.okta.com/app/sso/saml\","
                + "\"idpX509Certificate\":"
                + JsonUtils.pojoToJson(idpCertificate)
                + ",\"authorityUrl\":\"http://localhost:8585/api/v1/saml/login\","
                + "\"nameId\":\"urn:oasis:names:tc:SAML:2.0:nameid-format:emailAddress\"},"
                + "\"sp\":{\"entityId\":\"http://localhost:8585/api/v1/saml/metadata\","
                + "\"acs\":\"http://localhost:8585/api/v1/saml/acs\","
                + "\"spX509Certificate\":\"MIIC sp certificate kept as is\","
                + "\"spPrivateKey\":\"fernet:gAAAAABkept\","
                + "\"callback\":\"http://localhost:8585/saml/callback\"},"
                + "\"security\":{\"strictMode\":false,\"tokenValidity\":3600,"
                + "\"sendSignedAuthRequest\":false,\"wantAssertionsSigned\":true}}}");
  }

  private static String certificateOf(final JsonNode configuration) {
    return configuration.path("samlConfiguration").path("idp").path("idpX509Certificate").asText();
  }

  private static JsonNode withoutCertificate(final JsonNode configuration) {
    final JsonNode copy = configuration.deepCopy();
    ((ObjectNode) copy.path("samlConfiguration").path("idp")).remove("idpX509Certificate");
    return copy;
  }

  /** Stores the configuration and an unrelated setting, and returns the stored configuration. */
  private static String seed(
      final Handle handle, final String dialect, final ObjectNode configuration) {
    createTable(handle, dialect);
    insert(handle, dialect, AUTHENTICATION, JsonUtils.pojoToJson(configuration));
    insert(handle, dialect, EMAIL, EMAIL_JSON);
    final String stored = stored(handle, AUTHENTICATION);
    assertNotNull(stored);
    return stored;
  }

  private static String stored(final Handle handle, final String configType) {
    return handle
        .createQuery("SELECT json FROM openmetadata_settings WHERE configType = :configType")
        .bind("configType", configType)
        .mapTo(String.class)
        .findOne()
        .orElse(null);
  }

  private static void createTable(final Handle handle, final String dialect) {
    handle.execute("DROP TABLE IF EXISTS openmetadata_settings");
    handle.execute(
        POSTGRES_DIALECT.equals(dialect)
            ? "CREATE TABLE openmetadata_settings (id SERIAL NOT NULL, configType VARCHAR(36)"
                + " NOT NULL, json JSONB NOT NULL, PRIMARY KEY (id, configType),"
                + " UNIQUE (configType))"
            : "CREATE TABLE openmetadata_settings (id MEDIUMINT NOT NULL AUTO_INCREMENT,"
                + " configType VARCHAR(36) NOT NULL, json JSON NOT NULL,"
                + " PRIMARY KEY (id, configType), UNIQUE (configType))");
  }

  private static void insert(
      final Handle handle, final String dialect, final String configType, final String json) {
    final String value = POSTGRES_DIALECT.equals(dialect) ? "CAST(:json AS JSONB)" : ":json";
    handle
        .createUpdate(
            "INSERT INTO openmetadata_settings (configType, json) VALUES (:configType, "
                + value
                + ")")
        .bind("configType", configType)
        .bind("json", json)
        .execute();
  }

  private static Handle open(final String dialect) {
    return POSTGRES_DIALECT.equals(dialect)
        ? Jdbi.create(
                "jdbc:postgresql://"
                    + POSTGRES.getHost()
                    + ":"
                    + POSTGRES.getMappedPort(5432)
                    + "/"
                    + DATABASE,
                "postgres",
                PASSWORD)
            .open()
        : Jdbi.create(
                "jdbc:mysql://"
                    + MYSQL.getHost()
                    + ":"
                    + MYSQL.getMappedPort(3306)
                    + "/"
                    + DATABASE
                    + "?allowPublicKeyRetrieval=true&useSSL=false",
                "root",
                PASSWORD)
            .open();
  }

  private static ConnectionType connectionType(final String dialect) {
    return POSTGRES_DIALECT.equals(dialect) ? ConnectionType.POSTGRES : ConnectionType.MYSQL;
  }

  private static String resource(final String path) {
    try (InputStream stream = SamlIdpCertificateMigrationTest.class.getResourceAsStream(path)) {
      return new String(stream.readAllBytes(), StandardCharsets.US_ASCII);
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
  }
}
