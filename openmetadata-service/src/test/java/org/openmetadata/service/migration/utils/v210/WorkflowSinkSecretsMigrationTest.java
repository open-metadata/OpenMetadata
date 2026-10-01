package org.openmetadata.service.migration.utils.v210;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.migration.utils.v210.WorkflowSinkSecretsMigration.StoredRow;

class WorkflowSinkSecretsMigrationTest {
  private static final String FERNET_KEY = "jJ/9sz0g0OHxsfxOoSfdFdmk3ysNmPRnH3TUAbz3IHA=";
  private static final String GIT_TOKEN = "ghp_storedPlaintextToken";
  private static final String PASSPHRASE = "storedPlaintextPassphrase";
  private static final String ROW_ID = "3f1c2a4e-0000-4000-8000-000000000001";
  private static final String VERSION_EXTENSION = "workflowDefinition.version.0.2";
  private static final String GIT_SINK_CONFIG = "/nodes/0/config/sinkConfig";
  private static final String STORED_DEFINITION =
      """
      {
        "id": "%s",
        "name": "gitSinkWorkflow",
        "fullyQualifiedName": "gitSinkWorkflow",
        "nodes": [
          {
            "type": "automatedTask",
            "subType": "sinkTask",
            "name": "gitSink",
            "config": {
              "sinkType": "git",
              "sinkConfig": {
                "repositoryUrl": "https://github.com/org/repo.git",
                "credentials": {"type": "token", "token": "%s"},
                "signingKey": {"privateKey": "secret:/git/key", "passphrase": "%s"}
              }
            }
          }
        ]
      }
      """
          .formatted(ROW_ID, GIT_TOKEN, PASSPHRASE);

  @BeforeEach
  void setUp() {
    Fernet.getInstance().setFernetKey(FERNET_KEY);
  }

  @AfterEach
  void tearDown() {
    Fernet.getInstance().setFernetKey((String) null);
  }

  @Test
  void aPlaintextRowIsEncryptedAndASecondRunLeavesItAlone() {
    JsonNode encrypted =
        WorkflowSinkSecretsMigration.encryptedOrNull(
            new StoredRow(ROW_ID, VERSION_EXTENSION, STORED_DEFINITION));

    assertNotNull(encrypted);
    String encryptedJson = encrypted.toString();
    assertFalse(encryptedJson.contains(GIT_TOKEN));
    assertFalse(encryptedJson.contains(PASSPHRASE));
    JsonNode sinkConfig = encrypted.at(GIT_SINK_CONFIG);
    assertEquals(
        GIT_TOKEN, Fernet.getInstance().decrypt(sinkConfig.at("/credentials/token").asText()));
    assertEquals(
        "secret:/git/key",
        Fernet.getInstance().decrypt(sinkConfig.at("/signingKey/privateKey").asText()));
    assertEquals("https://github.com/org/repo.git", sinkConfig.at("/repositoryUrl").asText());

    assertNull(
        WorkflowSinkSecretsMigration.encryptedOrNull(
            new StoredRow(ROW_ID, VERSION_EXTENSION, encryptedJson)),
        "a row that only holds ciphertext needs no update");
  }

  @Test
  void aRowWithoutSinkSecretsIsNotUpdated() {
    String withoutSink =
        """
        {"id": "%s", "name": "plain", "nodes": [
          {"type": "startEvent", "subType": "startEvent", "name": "start"}]}
        """
            .formatted(ROW_ID);

    assertNull(
        WorkflowSinkSecretsMigration.encryptedOrNull(new StoredRow(ROW_ID, null, withoutSink)));
  }

  @Test
  void anUnreadableRowIsSkipped() {
    assertNull(
        WorkflowSinkSecretsMigration.encryptedOrNull(
            new StoredRow(ROW_ID, VERSION_EXTENSION, "{not json")));
  }

  @Test
  void withoutAFernetKeyRowsAreLeftAsStored() {
    Fernet.getInstance().setFernetKey((String) null);

    assertNull(
        WorkflowSinkSecretsMigration.encryptedOrNull(
            new StoredRow(ROW_ID, null, STORED_DEFINITION)));
    assertTrue(STORED_DEFINITION.contains(GIT_TOKEN));
  }
}
