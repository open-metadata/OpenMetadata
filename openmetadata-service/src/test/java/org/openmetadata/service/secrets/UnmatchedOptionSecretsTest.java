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
 * A Databricks pipeline connection's {@code authType} is a {@code oneOf} of a personal access token,
 * OAuth and Azure AD options. A value must match one of them to be saved.
 */
class UnmatchedOptionSecretsTest {

  private static final String FERNET_KEY = "jJ/9sz0g0OHxsfxOoSfdFdmk3ysNmPRnH3TUAbz3IHA=";
  private static final String CONNECTION_TYPE = "DatabricksPipeline";
  private static final String TOKEN = "unmatched-option-token";
  private static final String CLIENT_SECRET = "unmatched-option-client-secret";

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
  void refusesAValueWithAKeyNoOptionDeclares() {
    InvalidServiceConnectionException e =
        assertThrows(
            InvalidServiceConnectionException.class,
            () -> encrypt(Map.of("token", TOKEN, "region", "eu")));

    assertTrue(e.getMessage().contains("[authType]"), e.getMessage());
    assertTrue(e.getMessage().contains("[region]"), e.getMessage());
    assertFalse(e.getMessage().contains(TOKEN), e.getMessage());
  }

  @Test
  void refusesAValueThatMixesTheKeysOfTwoOptions() {
    InvalidServiceConnectionException e =
        assertThrows(
            InvalidServiceConnectionException.class,
            () ->
                encrypt(
                    Map.of("token", TOKEN, "clientId", "client", "clientSecret", CLIENT_SECRET)));

    assertTrue(e.getMessage().contains("[authType]"), e.getMessage());
    assertFalse(e.getMessage().contains(TOKEN), e.getMessage());
    assertFalse(e.getMessage().contains(CLIENT_SECRET), e.getMessage());
  }

  @Test
  void savesEachOptionOnItsOwn() {
    Map<String, Object> token = authType(encrypt(Map.of("token", TOKEN)));
    Map<String, Object> oauth =
        authType(encrypt(Map.of("clientId", "client", "clientSecret", CLIENT_SECRET)));

    assertTrue(Fernet.isTokenized((String) token.get("token")));
    assertTrue(Fernet.isTokenized((String) oauth.get("clientSecret")));
  }

  @Test
  void decryptsTheEncryptedLeavesOfAStoredValueThatMatchesNoOption() {
    Map<String, Object> stored =
        connection(Map.of("token", Fernet.getInstance().encrypt(TOKEN), "region", "eu"));

    Object decrypted =
        secretsManager.decryptServiceConnectionConfig(
            stored, CONNECTION_TYPE, ServiceType.PIPELINE);

    assertEquals(Map.of("token", TOKEN, "region", "eu"), authType(decrypted));
  }

  private static Object encrypt(Map<String, Object> authType) {
    return secretsManager.encryptServiceConnectionConfig(
        connection(authType), CONNECTION_TYPE, "databricks", ServiceType.PIPELINE);
  }

  private static Map<String, Object> connection(Map<String, Object> authType) {
    return Map.of(
        "type", CONNECTION_TYPE, "hostPort", "databricks.example:443", "authType", authType);
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> authType(Object connection) {
    Map<String, Object> json = JsonUtils.readValue(JsonUtils.pojoToJson(connection), Map.class);
    return (Map<String, Object>) json.get("authType");
  }
}
