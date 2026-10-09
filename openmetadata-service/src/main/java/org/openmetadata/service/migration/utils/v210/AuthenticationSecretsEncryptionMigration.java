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

import static org.openmetadata.schema.settings.SettingsType.AUTHENTICATION_CONFIGURATION;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.config.source.SettingsSecrets;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.SystemTokenDAOs.SystemDAO;

/**
 * Authentication secrets (OIDC client secret, LDAP bind and trust store passwords, SAML private key
 * and key store password) used to be stored in clear text. New writes encrypt them; this encrypts
 * the stored configuration of existing installs. Values that are already encrypted stay as they
 * are, so running it again changes nothing.
 */
@Slf4j
public final class AuthenticationSecretsEncryptionMigration {
  public static final String STEP_NAME = "encryptAuthenticationSecrets";

  private AuthenticationSecretsEncryptionMigration() {}

  public static void encryptAuthenticationSecrets(CollectionDAO collectionDAO) {
    SystemDAO dao = collectionDAO.systemDAO();
    String storedJson = dao.getConfigJsonWithKey(AUTHENTICATION_CONFIGURATION.value());
    if (!Fernet.getInstance().isKeyDefined()) {
      LOG.info("No Fernet key is configured; authentication secrets stay as stored");
    } else if (storedJson != null) {
      encrypt(dao, storedJson);
    }
  }

  private static void encrypt(SystemDAO dao, String storedJson) {
    JsonNode stored = JsonUtils.readTree(storedJson);
    JsonNode encrypted = SettingsSecrets.encrypted(AUTHENTICATION_CONFIGURATION, stored);
    if (!encrypted.equals(stored)) {
      int updated =
          dao.updateSettingsIfCurrent(
              AUTHENTICATION_CONFIGURATION.value(), storedJson, JsonUtils.pojoToJson(encrypted));
      LOG.info(
          updated > 0
              ? "Encrypted the secrets of the stored authentication configuration"
              : "The stored authentication configuration changed while its secrets were encrypted; "
                  + "the next save encrypts them");
    }
  }
}
