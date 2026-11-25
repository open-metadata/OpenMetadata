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

package org.openmetadata.service.secrets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.InvalidServiceConnectionException;
import org.openmetadata.service.fernet.Fernet;

/**
 * A Test Connection workflow carries a service connection in its request, so its {@code oneOf}
 * values follow the same rule as a service's: one must match an option to be saved.
 */
class UnmatchedOptionWorkflowSecretsTest {

  private static final String FERNET_KEY = "jJ/9sz0g0OHxsfxOoSfdFdmk3ysNmPRnH3TUAbz3IHA=";
  private static final String TOKEN = "unmatched-option-workflow-token";

  private static SecretsManager secretsManager;

  @BeforeAll
  static void setUp() {
    Fernet.getInstance().setFernetKey(FERNET_KEY);
    secretsManager =
        DBSecretsManager.getInstance(
            SecretsManagerProvider.DB,
            new SecretsManager.SecretsConfig("openmetadata", "prefix", List.of(), null));
    secretsManager.setFernet(Fernet.getInstance());
  }

  @AfterAll
  static void tearDown() {
    Fernet.getInstance().setFernetKey((String) null);
  }

  @Test
  void refusesATestConnectionWorkflowWhoseAuthTypeMatchesNoOption() {
    Workflow workflow = testConnection(Map.of("token", TOKEN, "region", "eu"));

    InvalidServiceConnectionException e =
        assertThrows(
            InvalidServiceConnectionException.class,
            () -> secretsManager.encryptWorkflow(workflow));

    assertFalse(e.getMessage().contains(TOKEN), e.getMessage());
  }

  @Test
  void savesATestConnectionWorkflowWhoseAuthTypeMatchesAnOption() {
    Workflow encrypted = secretsManager.encryptWorkflow(testConnection(Map.of("token", TOKEN)));

    assertTrue(Fernet.isTokenized((String) authType(encrypted).get("token")));
  }

  @Test
  void decryptsTheEncryptedLeavesOfAStoredWorkflowValueThatMatchesNoOption() {
    Workflow stored =
        testConnection(Map.of("token", Fernet.getInstance().encrypt(TOKEN), "region", "eu"));

    Workflow decrypted = secretsManager.decryptWorkflow(stored);

    assertEquals(Map.of("token", TOKEN, "region", "eu"), authType(decrypted));
  }

  static Workflow testConnection(Map<String, Object> authType) {
    Map<String, Object> config =
        Map.of(
            "type",
            "DatabricksPipeline",
            "hostPort",
            "databricks.example:443",
            "authType",
            authType);
    Map<String, Object> request =
        Map.of(
            "connection", Map.of("config", config),
            "serviceType", "Pipeline",
            "connectionType", "DatabricksPipeline",
            "serviceName", "databricks");
    return JsonUtils.convertValue(
        Map.of(
            "id", "7b4d0b6e-2f0f-4c39-9d1e-0d1c4b1e9a10",
            "name", "test-connection",
            "workflowType", "TEST_CONNECTION",
            "request", request),
        Workflow.class);
  }

  @SuppressWarnings("unchecked")
  static Map<String, Object> authType(Workflow workflow) {
    Map<String, Object> json = JsonUtils.readValue(JsonUtils.pojoToJson(workflow), Map.class);
    Map<String, Object> request = (Map<String, Object>) json.get("request");
    Map<String, Object> connection = (Map<String, Object>) request.get("connection");
    Map<String, Object> config = (Map<String, Object>) connection.get("config");
    return (Map<String, Object>) config.get("authType");
  }
}
