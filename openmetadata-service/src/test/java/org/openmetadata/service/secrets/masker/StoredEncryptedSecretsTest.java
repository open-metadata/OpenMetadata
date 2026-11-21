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
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.service.secrets.masker.PasswordEntityMasker.PASSWORD_MASK;

import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.function.Executable;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.automations.TestServiceConnectionRequest;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.entity.automations.WorkflowType;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.common.basicAuth;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.EntityMaskException;
import org.openmetadata.service.fernet.Fernet;

/** A save keeps an encrypted secret only where it is the value already stored for that field. */
class StoredEncryptedSecretsTest {
  private static final String FERNET_KEY = "-uvd2sz2yfe3XoJZnBk3Aw9o_CjL36hHv_yFJlZL3-g=";

  private String storedToken;
  private String otherToken;

  @BeforeEach
  void createMasker() {
    Fernet.getInstance().setFernetKey(FERNET_KEY);
    EntityMaskerFactory.setEntityMasker(null);
    EntityMaskerFactory.createEntityMasker();
    storedToken = Fernet.getInstance().encrypt("stored-password");
    otherToken = Fernet.getInstance().encrypt("other-password");
  }

  @AfterEach
  void resetMasker() {
    EntityMaskerFactory.setEntityMasker(null);
  }

  @Test
  void aConnectionUpdateKeepsTheStoredEncryptedValueOfTheSameField() {
    MysqlConnection restored =
        (MysqlConnection) unmaskMysql(mysql(storedToken, "user"), mysql(storedToken, "user"));
    assertEquals("stored-password", passwordOf(restored));
  }

  @Test
  void aConnectionUpdateRefusesAnEncryptedValueThatIsNotStored() {
    assertRefused(() -> unmaskMysql(mysql(otherToken, "user"), mysql(storedToken, "user")));
  }

  @Test
  void aConnectionUpdateRefusesAStoredEncryptedValueMovedToAnotherField() {
    Map<String, Object> stored = mysql(storedToken, "user");
    Map<String, Object> incoming =
        Map.of(
            "type",
            "Mysql",
            "username",
            "user",
            "hostPort",
            "db.internal:3306",
            "authType",
            Map.of("password", PASSWORD_MASK),
            "sslConfig",
            Map.of("caCertificate", storedToken));
    assertRefused(() -> unmaskMysql(incoming, stored));
  }

  @Test
  void aConnectionUpdateKeepsTheMaskAndTakesANewSecret() {
    Map<String, Object> stored = mysql(storedToken, "user");
    assertEquals("stored-password", passwordOf(unmaskMysql(mysql(PASSWORD_MASK, "user"), stored)));
    assertEquals("typed-again", passwordOf(unmaskMysql(mysql("typed-again", "user"), stored)));
  }

  @Test
  void aNewConnectionRefusesAnyEncryptedValue() {
    assertRefused(
        () ->
            masker()
                .requireNoEncryptedSecrets(
                    mysql(storedToken, "user"), "Mysql", ServiceType.DATABASE));
  }

  @Test
  void aNewConnectionTakesItsSecretsAsTyped() {
    assertDoesNotThrow(
        () ->
            masker()
                .requireNoEncryptedSecrets(
                    mysql("typed-password", "user"), "Mysql", ServiceType.DATABASE));
  }

  @Test
  void aPipelineUpdateKeepsOnlyItsOwnStoredEncryptedValue() {
    assertDoesNotThrow(() -> masker().unmaskIngestionPipeline(dbt(storedToken), dbt(storedToken)));
    assertRefused(() -> masker().unmaskIngestionPipeline(dbt(otherToken), dbt(storedToken)));
  }

  @Test
  void aNewPipelineRefusesAnyEncryptedValue() {
    assertRefused(() -> masker().requireNoEncryptedSecrets(dbt(storedToken)));
    assertDoesNotThrow(() -> masker().requireNoEncryptedSecrets(dbt("typed-token")));
  }

  @Test
  void aWorkflowUpdateKeepsOnlyTheStoredEncryptedValue() {
    Workflow stored = testConnection(storedToken);
    Workflow restored = masker().unmaskWorkflow(testConnection(storedToken), stored);
    assertEquals(
        "stored-password",
        JsonUtils.valueToTree(restored)
            .at("/request/connection/config/authType/password")
            .asText());
    assertRefused(() -> masker().unmaskWorkflow(testConnection(otherToken), stored));
  }

  @Test
  void aNewWorkflowRefusesAnyEncryptedValue() {
    assertRefused(() -> masker().requireNoEncryptedSecrets(testConnection(storedToken)));
    assertDoesNotThrow(() -> masker().requireNoEncryptedSecrets(testConnection("typed")));
  }

  private static EntityMasker masker() {
    return EntityMaskerFactory.getEntityMasker();
  }

  private static Object unmaskMysql(Object incoming, Object stored) {
    return masker().unmaskServiceConnectionConfig(incoming, stored, "Mysql", ServiceType.DATABASE);
  }

  private static void assertRefused(Executable save) {
    EntityMaskException refused = assertThrows(EntityMaskException.class, save);
    assertEquals(400, refused.getResponse().getStatus());
  }

  private static String passwordOf(Object connection) {
    MysqlConnection mysql = (MysqlConnection) connection;
    return JsonUtils.convertValue(mysql.getAuthType(), basicAuth.class).getPassword();
  }

  private static Map<String, Object> mysql(String password, String username) {
    return Map.of(
        "type",
        "Mysql",
        "username",
        username,
        "hostPort",
        "db.internal:3306",
        "authType",
        Map.of("password", password));
  }

  private static IngestionPipeline dbt(String token) {
    return new IngestionPipeline()
        .withName("dbt")
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
                            "cloud",
                            "dbtCloudAuthToken",
                            token,
                            "dbtCloudAccountId",
                            "1",
                            "dbtCloudUrl",
                            "https://cloud.getdbt.com"))));
  }

  private static Workflow testConnection(String password) {
    return new Workflow()
        .withName("test-connection")
        .withWorkflowType(WorkflowType.TEST_CONNECTION)
        .withRequest(
            new TestServiceConnectionRequest()
                .withServiceType(ServiceType.DATABASE)
                .withConnectionType("Mysql")
                .withConnection(new DatabaseConnection().withConfig(mysql(password, "user"))));
  }
}
