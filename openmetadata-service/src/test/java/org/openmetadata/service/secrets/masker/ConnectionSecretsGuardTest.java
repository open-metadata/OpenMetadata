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
  void anotherUserNameIsANewEndpointToo() {
    Map<String, Object> otherUser =
        Map.of(
            "type",
            "Mysql",
            "username",
            "someone-else",
            "hostPort",
            "db.internal:3306",
            "authType",
            Map.of("password", PASSWORD_MASK));

    assertThrows(BadRequestException.class, () -> guard(otherUser));
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
