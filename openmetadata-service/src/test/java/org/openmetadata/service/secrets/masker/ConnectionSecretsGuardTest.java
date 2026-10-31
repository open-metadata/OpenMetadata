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
   * Rotating one secret inside the map is indistinguishable from retargeting a setting: both are
   * typed values at a masked map entry. The guard fails closed and asks for every secret again -
   * the same rule the unmasked maps produced before they were declared secret.
   */
  @Test
  void rotatingOneSecretInsideTheConfigMapRequiresReenteringTheOthers() {
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
