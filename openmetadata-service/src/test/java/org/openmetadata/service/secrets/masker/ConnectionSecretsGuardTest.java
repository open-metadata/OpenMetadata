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
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.services.ServiceType;

/**
 * A caller who sees a connection's secrets masked keeps them while the connection points where it
 * did; once it points elsewhere the secrets must be entered again.
 */
class ConnectionSecretsGuardTest {
  private static final String STORED_TOKEN = "fernet:stored-password-token";
  private static final Map<String, Object> STORED = mysql("db.internal:3306", STORED_TOKEN);

  @BeforeEach
  void createMasker() {
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
            Map.of("includes", java.util.List.of("sales")),
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

  private static void guard(Map<String, Object> incoming) {
    ConnectionSecretsGuard.requireSecretsReenteredOnRetarget(
        incoming, STORED, "Mysql", ServiceType.DATABASE);
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
