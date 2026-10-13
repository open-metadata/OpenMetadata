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

package org.openmetadata.service.config.source;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.schema.settings.SettingsType.AUTHENTICATION_CONFIGURATION;
import static org.openmetadata.schema.settings.SettingsType.EMAIL_CONFIGURATION;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.secrets.masker.PasswordEntityMasker;

class SettingsSecretsTest {
  private static final String KEY = "GhtAEzEb5WD6bTLvwa24JA6ePHxfVLDjb8X4hMShmVY=";
  private static final String OTHER_KEY = "ZJNP0-FkaNPWmLsuhZq1dpQ5Cr2I8bG7vRlkjJjd25A=";
  private static final String MASK = PasswordEntityMasker.PASSWORD_MASK;

  @BeforeEach
  void setUp() {
    Fernet.getInstance().setFernetKey(KEY);
  }

  @Test
  void findsTheSecretsOfASettingFromItsSchema() {
    assertEquals(
        Set.of(
            "/oidcConfiguration/secret",
            "/ldapConfiguration/dnAdminPassword",
            "/ldapConfiguration/trustStoreConfig/customTrustManagerConfig/trustStoreFilePassword",
            "/samlConfiguration/sp/spPrivateKey",
            "/samlConfiguration/security/keyStorePassword"),
        SettingsSecrets.pointersOf(AUTHENTICATION_CONFIGURATION));
    assertEquals(Set.of("/password"), SettingsSecrets.pointersOf(EMAIL_CONFIGURATION));
  }

  @Test
  void encryptedSecretsDecryptBackAndEncryptingAgainChangesNothing() {
    JsonNode clear = oidcWithSecret("s3cret");

    JsonNode encrypted = SettingsSecrets.encrypted(AUTHENTICATION_CONFIGURATION, clear);

    assertTrue(Fernet.isTokenized(encrypted.at("/oidcConfiguration/secret").asText()));
    assertEquals("om", encrypted.at("/oidcConfiguration/id").asText());
    assertEquals(encrypted, SettingsSecrets.encrypted(AUTHENTICATION_CONFIGURATION, encrypted));
    assertEquals(clear, SettingsSecrets.decrypted(AUTHENTICATION_CONFIGURATION, encrypted));
  }

  @Test
  void aSecretWrittenWithAnotherKeyIsKeptRatherThanLost() {
    JsonNode encrypted =
        SettingsSecrets.encrypted(AUTHENTICATION_CONFIGURATION, oidcWithSecret("s3cret"));
    Fernet.getInstance().setFernetKey(OTHER_KEY);

    JsonNode decrypted = SettingsSecrets.decrypted(AUTHENTICATION_CONFIGURATION, encrypted);

    assertEquals(
        encrypted.at("/oidcConfiguration/secret"), decrypted.at("/oidcConfiguration/secret"));
  }

  @Test
  void masksAndRestoresSecretsWithoutReplacingTheObject() {
    AuthenticationConfiguration original = oidcConfiguration("s3cret");
    AuthenticationConfiguration shown = oidcConfiguration("s3cret");
    shown.setProvider(null);

    SettingsSecrets.maskInPlace(AUTHENTICATION_CONFIGURATION, shown);
    assertEquals(MASK, shown.getOidcConfiguration().getSecret());

    SettingsSecrets.restoreMaskedInPlace(AUTHENTICATION_CONFIGURATION, shown, original);
    assertEquals("s3cret", shown.getOidcConfiguration().getSecret());
    // A null the client sent must stay null: a JSON round trip would re-apply the default.
    assertNull(shown.getProvider());
  }

  @Test
  void keepsASecretTheAdminTypedIn() {
    AuthenticationConfiguration updated = oidcConfiguration("new-secret");

    SettingsSecrets.restoreMaskedInPlace(
        AUTHENTICATION_CONFIGURATION, updated, oidcConfiguration("s3cret"));

    assertEquals("new-secret", updated.getOidcConfiguration().getSecret());
  }

  private static AuthenticationConfiguration oidcConfiguration(String secret) {
    return new AuthenticationConfiguration()
        .withOidcConfiguration(new OidcClientConfig().withId("om").withSecret(secret));
  }

  private static JsonNode oidcWithSecret(String secret) {
    return JsonUtils.valueToTree(oidcConfiguration(secret));
  }
}
