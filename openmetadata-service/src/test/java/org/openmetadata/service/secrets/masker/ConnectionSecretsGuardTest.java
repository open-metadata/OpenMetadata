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

package org.openmetadata.service.secrets.masker;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.service.secrets.masker.PasswordEntityMasker.PASSWORD_MASK;

import jakarta.ws.rs.BadRequestException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.service.fernet.Fernet;

/**
 * A caller who sees a connection's secrets masked keeps them while the connection points where it
 * did; once it points elsewhere the secrets must be entered again.
 */
class ConnectionSecretsGuardTest {
  private static final String STORED_TOKEN = "fernet:stored-password-token";
  private static final Map<String, Object> STORED = mysql("db.internal:3306", STORED_TOKEN);
  private static final String FERNET_KEY = "-uvd2sz2yfe3XoJZnBk3Aw9o_CjL36hHv_yFJlZL3-g=";
  private static final String IDP_URL = "https://idp.corp.example/token";
  private static final String ATTACKER_URL = "https://attacker.example/token";

  @BeforeEach
  void createMasker() {
    Fernet.getInstance().setFernetKey(FERNET_KEY);
    EntityMaskerFactory.setEntityMasker(null);
    EntityMaskerFactory.createEntityMasker();
  }

  @AfterEach
  void resetMasker() {
    EntityMaskerFactory.setEntityMasker(null);
  }

  @Test
  void theSameEndpointKeepsItsMaskedSecret() {
    assertDoesNotThrow(() -> guard(mysql("db.internal:3306", PASSWORD_MASK)));
  }

  @Test
  void aNewSecretForTheSameEndpointIsAccepted() {
    assertDoesNotThrow(() -> guard(mysql("db.internal:3306", "new-password")));
  }

  @Test
  void aNewEndpointWithItsOwnSecretIsAccepted() {
    assertDoesNotThrow(() -> guard(mysql("elsewhere.example:3306", "entered-again")));
  }

  @Test
  void aNewEndpointCannotKeepTheMaskedSecret() {
    assertThrows(
        BadRequestException.class, () -> guard(mysql("elsewhere.example:3306", PASSWORD_MASK)));
  }

  @Test
  void aNewEndpointCannotKeepTheStoredEncryptedSecret() {
    assertThrows(
        BadRequestException.class, () -> guard(mysql("elsewhere.example:3306", STORED_TOKEN)));
  }

  @Test
  void aNewEndpointCannotTakeAnyEncryptedSecret() {
    assertThrows(
        BadRequestException.class,
        () -> guard(mysql("elsewhere.example:3306", "fernet:another-secret")));
  }

  @Test
  void aNewEndpointCannotKeepAnExternalSecretReference() {
    assertThrows(
        BadRequestException.class,
        () ->
            guard(mysql("elsewhere.example:3306", "secret:/openmetadata/database/other/password")));
  }

  /** Changing a non-endpoint field keeps the same target, so the masked secret need not be re-entered. */
  @Test
  void aNonEndpointChangeKeepsTheMaskedSecret() {
    Map<String, Object> filterChanged =
        Map.of(
            "type",
            "Mysql",
            "username",
            "openmetadata",
            "hostPort",
            "db.internal:3306",
            "databaseFilterPattern",
            Map.of("includes", List.of("sales")),
            "authType",
            Map.of("password", PASSWORD_MASK));

    assertDoesNotThrow(() -> guard(filterChanged));
  }

  /** A capability flag cannot redirect the connection, so toggling it keeps the masked secret. */
  @Test
  void aSupportsFlagChangeKeepsTheMaskedSecret() {
    Map<String, Object> flagToggled =
        Map.of(
            "type",
            "Mysql",
            "username",
            "openmetadata",
            "hostPort",
            "db.internal:3306",
            "supportsProfiler",
            false,
            "authType",
            Map.of("password", PASSWORD_MASK));

    assertDoesNotThrow(() -> guard(flagToggled));
  }

  /**
   * A field the guard does not recognise as safe is treated as a redirect and blocks, so a
   * connector-specific target outside any endpoint-name list (here {@code databaseName}; in practice
   * an Oracle TNS descriptor or Domo {@code instanceDomain}) cannot keep the masked secret.
   */
  @Test
  void aChangeToAnUnrecognisedFieldCannotKeepTheMaskedSecret() {
    Map<String, Object> retargeted =
        Map.of(
            "type",
            "Mysql",
            "username",
            "openmetadata",
            "hostPort",
            "db.internal:3306",
            "databaseName",
            "someone_elses_db",
            "authType",
            Map.of("password", PASSWORD_MASK));

    assertThrows(BadRequestException.class, () -> guard(retargeted));
  }

  /**
   * Dropping a stored override moves the connection as surely as setting one: a host in {@code
   * connectionArguments} wins over {@code hostPort}, so removing it points the driver elsewhere.
   */
  @Test
  void removingAStoredOverrideCannotKeepTheMaskedSecret() {
    Map<String, Object> stored =
        with(STORED, "connectionArguments", Map.of("host", "db.internal", "connect_timeout", 10));
    Map<String, Object> overrideRemoved =
        with(
            mysql("db.internal:3306", PASSWORD_MASK),
            "connectionArguments",
            Map.of("connect_timeout", 10));

    assertThrows(BadRequestException.class, () -> guard(overrideRemoved, stored));
  }

  @Test
  void removingAStoredFilterKeepsTheMaskedSecret() {
    Map<String, Object> stored =
        with(STORED, "databaseFilterPattern", Map.of("includes", List.of("sales")));

    assertDoesNotThrow(() -> guard(mysql("db.internal:3306", PASSWORD_MASK), stored));
  }

  /** An empty map of overrides says nothing, so a client that leaves it out changes nothing. */
  @Test
  void leavingOutAnEmptyStoredOverrideMapKeepsTheMaskedSecret() {
    Map<String, Object> stored = with(STORED, "connectionArguments", Map.of());

    assertDoesNotThrow(() -> guard(mysql("db.internal:3306", PASSWORD_MASK), stored));
  }

  @Test
  void aDbtSourcePointedElsewhereCannotKeepTheMaskedToken() {
    assertThrows(
        BadRequestException.class,
        () ->
            ConnectionSecretsGuard.requireSecretsReenteredOnRetarget(
                dbt("https://elsewhere.example", PASSWORD_MASK, false),
                dbt("https://cloud.getdbt.com", STORED_TOKEN, false)));
  }

  @Test
  void aDbtSourcePointedElsewhereTakesANewToken() {
    assertDoesNotThrow(
        () ->
            ConnectionSecretsGuard.requireSecretsReenteredOnRetarget(
                dbt("https://elsewhere.example", "entered-again", false),
                dbt("https://cloud.getdbt.com", STORED_TOKEN, false)));
  }

  /** Only the source the secrets belong to is compared, not the pipeline's other settings. */
  @Test
  void aDbtPipelineKeepsItsMaskedTokenWhileItsOtherSettingsChange() {
    assertDoesNotThrow(
        () ->
            ConnectionSecretsGuard.requireSecretsReenteredOnRetarget(
                dbt("https://cloud.getdbt.com", PASSWORD_MASK, true),
                dbt("https://cloud.getdbt.com", STORED_TOKEN, false)));
  }

  @Test
  void aStorageManifestPointedElsewhereCannotKeepTheMaskedKey() {
    assertThrows(
        BadRequestException.class,
        () ->
            ConnectionSecretsGuard.requireSecretsReenteredOnRetarget(
                storageManifest("https://elsewhere.example", PASSWORD_MASK),
                storageManifest("https://s3.amazonaws.com", STORED_TOKEN)));
  }

  /** A dbt HTTP source's headers are a password map, so an edited header is a retarget too. */
  @Test
  void editingADbtHttpHeaderCannotKeepTheMaskedToken() {
    IngestionPipeline stored =
        dbtHttp(Fernet.getInstance().encrypt(IDP_URL), Fernet.getInstance().encrypt("glpat-1"));

    assertThrows(
        BadRequestException.class,
        () ->
            ConnectionSecretsGuard.requireSecretsReenteredOnRetarget(
                dbtHttp(ATTACKER_URL, PASSWORD_MASK), stored));
    assertDoesNotThrow(
        () ->
            ConnectionSecretsGuard.requireSecretsReenteredOnRetarget(
                dbtHttp(PASSWORD_MASK, PASSWORD_MASK), stored));
  }

  private static IngestionPipeline dbtHttp(String forwardedHost, String token) {
    return new IngestionPipeline()
        .withName("dbt-http")
        .withPipelineType(PipelineType.DBT)
        .withSourceConfig(
            new SourceConfig()
                .withConfig(
                    Map.of(
                        "type",
                        "DBT",
                        "dbtConfigSource",
                        Map.of(
                            "dbtConfigType",
                            "http",
                            "dbtManifestHttpPath",
                            "https://gitlab.example/manifest.json",
                            "dbtHttpHeaders",
                            Map.of("X-Forwarded-Host", forwardedHost, "PRIVATE-TOKEN", token)))));
  }

  private static IngestionPipeline dbt(String url, String token, boolean updateDescriptions) {
    return new IngestionPipeline()
        .withName("dbt")
        .withPipelineType(PipelineType.DBT)
        .withSourceConfig(
            new SourceConfig()
                .withConfig(
                    Map.of(
                        "type",
                        "DBT",
                        "dbtUpdateDescriptions",
                        updateDescriptions,
                        "dbtConfigSource",
                        Map.of(
                            "dbtConfigType",
                            "cloud",
                            "dbtCloudAuthToken",
                            token,
                            "dbtCloudAccountId",
                            "1",
                            "dbtCloudUrl",
                            url))));
  }

  private static IngestionPipeline storageManifest(String endpoint, String secretKey) {
    return new IngestionPipeline()
        .withName("manifest")
        .withPipelineType(PipelineType.METADATA)
        .withSourceConfig(
            new SourceConfig()
                .withConfig(
                    Map.of(
                        "type",
                        "StorageMetadata",
                        "storageMetadataConfigSource",
                        Map.of(
                            "securityConfig",
                            Map.of(
                                "awsAccessKeyId",
                                "manifest-key",
                                "awsSecretAccessKey",
                                secretKey,
                                "awsRegion",
                                "us-east-1",
                                "endPointURL",
                                endpoint),
                            "prefixConfig",
                            Map.of("containerName", "manifests")))));
  }

  /**
   * Every string entry of a password-valued map masks to the same placeholder, so an edit to a
   * non-secret entry - the OAuth token endpoint URL next to the client secret - no longer shows
   * in the masked comparison. Typing over a masked map entry must still count as a retarget.
   */
  @Test
  void editingAStringEntryInsideAMaskedConfigMapCannotKeepTheMaskedSecret() {
    Map<String, Object> stored = storedKafka(IDP_URL);
    Map<String, Object> incoming = kafka(ATTACKER_URL, PASSWORD_MASK);

    assertThrows(BadRequestException.class, () -> guardKafka(incoming, stored));
  }

  /** A reference other than the stored one cannot be shown to be the stored entry. */
  @Test
  void replacingAMapEntryWithAnotherSecretReferenceCannotKeepTheMaskedSecret() {
    Map<String, Object> stored = kafka("secret:/om/kafka/token_endpoint", "fernet:stored-secret");

    assertThrows(
        BadRequestException.class,
        () -> guardKafka(kafka("secret:/attacker/token_endpoint", PASSWORD_MASK), stored));
    assertDoesNotThrow(
        () -> guardKafka(kafka("secret:/om/kafka/token_endpoint", PASSWORD_MASK), stored));
  }

  @Test
  void aLocallyWrappedReferenceCanKeepTheMaskedSecretsOnlyWhenUnchanged() {
    String reference = "secret:/om/kafka/token_endpoint";
    Map<String, Object> stored = storedKafka(reference);

    assertDoesNotThrow(() -> guardKafka(kafka(reference, PASSWORD_MASK), stored));
    assertDoesNotThrow(
        () -> guardKafka(kafka(Fernet.getInstance().encrypt(reference), PASSWORD_MASK), stored));
    assertThrows(
        BadRequestException.class,
        () -> guardKafka(kafka("secret:/attacker/token_endpoint", PASSWORD_MASK), stored));
    assertThrows(
        BadRequestException.class,
        () ->
            guardKafka(
                kafka(
                    Fernet.getInstance().encrypt("secret:/attacker/token_endpoint"), PASSWORD_MASK),
                stored));
  }

  /** A fresh Fernet token of the stored cleartext is the same entry; another token is an edit. */
  @Test
  void aMapEntryTokenCountsAsUnchangedOnlyWhenItDecryptsToTheStoredValue() {
    Map<String, Object> stored = storedKafka(IDP_URL);

    assertDoesNotThrow(
        () -> guardKafka(kafka(Fernet.getInstance().encrypt(IDP_URL), PASSWORD_MASK), stored));
    assertThrows(
        BadRequestException.class,
        () -> guardKafka(kafka(Fernet.getInstance().encrypt(ATTACKER_URL), PASSWORD_MASK), stored));
  }

  /** A caller echoing the masked config it read changes nothing and keeps the masked secrets. */
  @Test
  void aFullyMaskedEchoOfTheConfigMapKeepsItsSecrets() {
    Map<String, Object> stored = storedKafka(IDP_URL);

    assertDoesNotThrow(() -> guardKafka(kafka(PASSWORD_MASK, PASSWORD_MASK), stored));
  }

  /** A plaintext entry that still equals the stored one is a replay, not an edit. */
  @Test
  void anUnchangedPlaintextEntryKeepsTheMaskedSecrets() {
    Map<String, Object> stored = storedKafka(IDP_URL);

    assertDoesNotThrow(() -> guardKafka(kafka(IDP_URL, PASSWORD_MASK), stored));
  }

  @Test
  void editingAConfigMapEntryIsAcceptedWithFreshSecrets() {
    Map<String, Object> stored = storedKafka(IDP_URL);

    assertDoesNotThrow(() -> guardKafka(kafka(ATTACKER_URL, "re-entered-secret"), stored));
  }

  /** Rows saved before maps were encrypted hold plaintext entries; the same rules apply. */
  @Test
  void aLegacyPlaintextStoredMapKeepsAnUnchangedEntry() {
    Map<String, Object> stored = kafka(IDP_URL, "legacy-plain-secret");

    assertDoesNotThrow(() -> guardKafka(kafka(IDP_URL, PASSWORD_MASK), stored));
  }

  @Test
  void aLegacyPlaintextStoredMapCannotBeRedirectedEither() {
    Map<String, Object> stored = kafka(IDP_URL, "legacy-plain-secret");

    assertThrows(
        BadRequestException.class, () -> guardKafka(kafka(ATTACKER_URL, PASSWORD_MASK), stored));
  }

  /** A typed value at a scalar password field is a re-entered secret, not a retarget. */
  @Test
  void rotatingAScalarSecretInsideAConnectionIsNotARetarget() {
    Map<String, Object> stored = storedKafka(IDP_URL);
    Map<String, Object> rotated =
        Map.of(
            "type", "Kafka",
            "bootstrapServers", "broker:9092",
            "saslPassword", "new-password",
            "consumerConfig",
                Map.of(
                    "sasl.oauthbearer.token.endpoint.url", PASSWORD_MASK,
                    "sasl.oauthbearer.client.secret", PASSWORD_MASK));

    assertDoesNotThrow(() -> guardKafka(rotated, stored));
  }

  /**
   * A key the schema declares as a password ({@code sasl.oauthbearer.client.secret}) is a secret
   * field like {@code saslPassword}: typing a new value rotates it and keeps the others masked.
   */
  @Test
  void rotatingADeclaredSecretInsideTheConfigMapKeepsTheOthersMasked() {
    Map<String, Object> stored = storedKafka(IDP_URL);
    Map<String, Object> rotated =
        Map.of(
            "type",
            "Kafka",
            "bootstrapServers",
            "broker:9092",
            "saslPassword",
            PASSWORD_MASK,
            "consumerConfig",
            Map.of(
                "sasl.oauthbearer.token.endpoint.url",
                PASSWORD_MASK,
                "sasl.oauthbearer.client.secret",
                "rotated-secret"));

    assertDoesNotThrow(() -> guardKafka(rotated, stored));
  }

  /**
   * An entry the schema does not declare is masked with the rest of the map, so a typed value
   * there may be a rotated secret or a retargeted setting. The guard fails closed and asks for
   * every secret again - the same rule the unmasked maps produced before they were declared secret.
   */
  @Test
  void rotatingAnUndeclaredMapEntryRequiresReenteringTheOthers() {
    Map<String, Object> stored = storedKafka(IDP_URL);
    Map<String, Object> rotated =
        Map.of(
            "type",
            "Kafka",
            "bootstrapServers",
            "broker:9092",
            "saslPassword",
            PASSWORD_MASK,
            "consumerConfig",
            Map.of(
                "sasl.oauthbearer.token.endpoint.url",
                "rotated-value",
                "sasl.oauthbearer.client.secret",
                PASSWORD_MASK));

    assertThrows(BadRequestException.class, () -> guardKafka(rotated, stored));
  }

  private static void guardKafka(Map<String, Object> incoming, Map<String, Object> stored) {
    ConnectionSecretsGuard.requireSecretsReenteredOnRetarget(
        incoming, stored, "Kafka", ServiceType.MESSAGING);
  }

  /** A stored Kafka config as written since maps were encrypted: every string entry is a Fernet token. */
  private static Map<String, Object> storedKafka(String tokenEndpointUrl) {
    return Map.of(
        "type",
        "Kafka",
        "bootstrapServers",
        "broker:9092",
        "saslPassword",
        "fernet:stored-sasl-password",
        "consumerConfig",
        Map.of(
            "sasl.oauthbearer.token.endpoint.url",
            Fernet.getInstance().encrypt(tokenEndpointUrl),
            "sasl.oauthbearer.client.secret",
            "fernet:stored-oauth-secret"));
  }

  private static Map<String, Object> kafka(String tokenEndpointUrl, String secret) {
    return Map.of(
        "type",
        "Kafka",
        "bootstrapServers",
        "broker:9092",
        "saslPassword",
        secret,
        "consumerConfig",
        Map.of(
            "sasl.oauthbearer.token.endpoint.url", tokenEndpointUrl,
            "sasl.oauthbearer.client.secret", secret));
  }

  private static void guard(Map<String, Object> incoming) {
    guard(incoming, STORED);
  }

  private static void guard(Map<String, Object> incoming, Map<String, Object> stored) {
    ConnectionSecretsGuard.requireSecretsReenteredOnRetarget(
        incoming, stored, "Mysql", ServiceType.DATABASE);
  }

  private static Map<String, Object> with(Map<String, Object> config, String field, Object value) {
    Map<String, Object> extended = new HashMap<>(config);
    extended.put(field, value);
    return extended;
  }

  private static Map<String, Object> mysql(String hostPort, String password) {
    return Map.of(
        "type",
        "Mysql",
        "username",
        "openmetadata",
        "hostPort",
        hostPort,
        "authType",
        Map.of("password", password));
  }
}
