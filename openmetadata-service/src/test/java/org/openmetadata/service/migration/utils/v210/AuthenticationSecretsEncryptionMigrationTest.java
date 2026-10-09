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

package org.openmetadata.service.migration.utils.v210;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.schema.settings.SettingsType.AUTHENTICATION_CONFIGURATION;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.config.source.SettingsSecrets;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.SystemTokenDAOs.SystemDAO;

class AuthenticationSecretsEncryptionMigrationTest {
  private static final String KEY = "GhtAEzEb5WD6bTLvwa24JA6ePHxfVLDjb8X4hMShmVY=";
  private static final String AUTH = AUTHENTICATION_CONFIGURATION.value();
  private static final String STORED =
      """
      {"provider": "ldap", "providerName": "LDAP",
       "ldapConfiguration": {"host": "ldap.example.com", "dnAdminPassword": "bind-s3cret"}}
      """;

  private final Map<String, String> rows = new HashMap<>();
  private final CollectionDAO collectionDAO = mock(CollectionDAO.class);

  @BeforeEach
  void setUp() {
    Fernet.getInstance().setFernetKey(KEY);
    SystemDAO dao = mock(SystemDAO.class);
    when(collectionDAO.systemDAO()).thenReturn(dao);
    when(dao.getConfigJsonWithKey(anyString())).thenAnswer(i -> rows.get(i.<String>getArgument(0)));
    when(dao.updateSettingsIfCurrent(anyString(), anyString(), anyString()))
        .thenAnswer(i -> compareAndSet(i.getArgument(0), i.getArgument(1), i.getArgument(2)));
  }

  @AfterEach
  void restoreKey() {
    Fernet.getInstance().setFernetKey(KEY);
  }

  @Test
  void encryptsTheStoredSecretsAndLeavesEverythingElse() {
    rows.put(AUTH, STORED);

    AuthenticationSecretsEncryptionMigration.encryptAuthenticationSecrets(collectionDAO);

    JsonNode migrated = JsonUtils.readTree(rows.get(AUTH));
    assertTrue(Fernet.isTokenized(migrated.at("/ldapConfiguration/dnAdminPassword").asText()));
    assertEquals("ldap.example.com", migrated.at("/ldapConfiguration/host").asText());
    assertEquals(
        JsonUtils.readTree(STORED),
        SettingsSecrets.decrypted(AUTHENTICATION_CONFIGURATION, migrated));
  }

  @Test
  void runningAgainChangesNothing() {
    rows.put(AUTH, STORED);
    AuthenticationSecretsEncryptionMigration.encryptAuthenticationSecrets(collectionDAO);
    String migrated = rows.get(AUTH);

    AuthenticationSecretsEncryptionMigration.encryptAuthenticationSecrets(collectionDAO);

    assertEquals(migrated, rows.get(AUTH));
  }

  @Test
  void leavesSecretsInClearTextWhenNoKeyIsConfigured() {
    rows.put(AUTH, STORED);
    Fernet.getInstance().setFernetKey((String) null);

    AuthenticationSecretsEncryptionMigration.encryptAuthenticationSecrets(collectionDAO);

    assertEquals(STORED, rows.get(AUTH));
  }

  @Test
  void doesNothingWithoutAStoredConfiguration() {
    AuthenticationSecretsEncryptionMigration.encryptAuthenticationSecrets(collectionDAO);

    assertFalse(rows.containsKey(AUTH));
  }

  private int compareAndSet(String type, String expectedJson, String updatedJson) {
    boolean unchanged =
        rows.containsKey(type)
            && JsonUtils.readTree(rows.get(type)).equals(JsonUtils.readTree(expectedJson));
    if (unchanged) {
      rows.put(type, updatedJson);
    }
    return unchanged ? 1 : 0;
  }
}
