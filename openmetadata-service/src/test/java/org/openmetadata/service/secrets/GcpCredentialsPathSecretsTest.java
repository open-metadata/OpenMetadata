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
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.InvalidServiceConnectionException;
import org.openmetadata.service.fernet.Fernet;

/**
 * A BigQuery connection's {@code gcpConfig} offers credential values, a credentials file path, an
 * external account and application default credentials. Each saves and reads back, and a value
 * that matches none of them is refused.
 */
class GcpCredentialsPathSecretsTest {

  private static final String FERNET_KEY = "jJ/9sz0g0OHxsfxOoSfdFdmk3ysNmPRnH3TUAbz3IHA=";
  private static final String BIG_QUERY = "BigQuery";
  private static final String PRIVATE_KEY = "gcp-credentials-path-private-key";

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
  void savesAndReadsBackACredentialsPathConfig() {
    Map<String, Object> path =
        Map.of(
            "type",
            "gcp_credential_path",
            "path",
            "/keys/service-account.json",
            "projectId",
            "analytics");

    assertEquals(path, gcpConfig(roundTrip(path)));
  }

  @Test
  void savesCredentialValuesWithThePrivateKeyEncrypted() {
    Map<String, Object> values =
        Map.of("type", "service_account", "projectId", "analytics", "privateKey", PRIVATE_KEY);

    Map<String, Object> stored = json(encrypt(values));

    assertTrue(Fernet.isTokenized((String) gcpConfig(stored).get("privateKey")));
    assertEquals(PRIVATE_KEY, gcpConfig(roundTrip(values)).get("privateKey"));
  }

  @Test
  void refusesAGcpConfigThatMatchesNoOption() {
    Map<String, Object> mixed =
        Map.of(
            "type",
            "service_account",
            "privateKey",
            PRIVATE_KEY,
            "path",
            "/keys/service-account.json");

    InvalidServiceConnectionException e =
        assertThrows(InvalidServiceConnectionException.class, () -> encrypt(mixed));

    assertFalse(e.getMessage().contains(PRIVATE_KEY), e.getMessage());
  }

  private static Object encrypt(Map<String, Object> gcpConfig) {
    return secretsManager.encryptServiceConnectionConfig(
        bigQuery(gcpConfig), BIG_QUERY, "big-query", ServiceType.DATABASE);
  }

  private static Map<String, Object> roundTrip(Map<String, Object> gcpConfig) {
    Map<String, Object> stored = json(encrypt(gcpConfig));
    return json(
        secretsManager.decryptServiceConnectionConfig(stored, BIG_QUERY, ServiceType.DATABASE));
  }

  private static Map<String, Object> bigQuery(Map<String, Object> gcpConfig) {
    return Map.of("credentials", Map.of("gcpConfig", gcpConfig));
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> gcpConfig(Map<String, Object> connection) {
    Map<String, Object> credentials = (Map<String, Object>) connection.get("credentials");
    return (Map<String, Object>) credentials.get("gcpConfig");
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> json(Object value) {
    return JsonUtils.readValue(JsonUtils.pojoToJson(value), Map.class);
  }
}
