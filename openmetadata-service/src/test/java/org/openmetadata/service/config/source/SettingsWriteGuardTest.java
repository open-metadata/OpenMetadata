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

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.schema.settings.SettingsType.AUTHENTICATION_CONFIGURATION;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.configuration.ConfigSourceConfiguration;
import org.openmetadata.schema.configuration.ConfigSourceMode;
import org.openmetadata.service.exception.SettingsManagedByEnvironmentException;

class SettingsWriteGuardTest {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final JsonNode STORED =
      json("{'provider':'basic','jwtTeamClaimMapping':'groups'}");

  @BeforeEach
  void setUp() {
    DeploymentTemplate template =
        DeploymentTemplate.parse(
            "authenticationConfiguration:\n  provider: ${AUTHENTICATION_PROVIDER:-basic}\n",
            "/authenticationConfiguration");
    ConfigSources.install(
        DeploymentConfig.of(
            List.of(new DeploymentSetting(DualSourceSetting.AUTHENTICATION, STORED, template)),
            new ConfigSourceConfiguration()));
  }

  @AfterEach
  void tearDown() {
    ConfigSources.install(null);
  }

  @Test
  void envModeRejectsChangingAFieldTheConfigurationFileDefines() throws Exception {
    try (AutoCloseable env =
        ConfigSources.overrideForTest(AUTHENTICATION_CONFIGURATION, ConfigSourceMode.ENV)) {
      SettingsManagedByEnvironmentException rejected =
          assertThrows(
              SettingsManagedByEnvironmentException.class,
              () ->
                  SettingsWriteGuard.assertWritable(
                      AUTHENTICATION_CONFIGURATION,
                      STORED,
                      json("{'provider':'okta','jwtTeamClaimMapping':'groups'}")));

      assertEquals(409, rejected.getResponse().getStatus());
      assertTrue(rejected.getMessage().contains("SECURITY_CONFIG_SOURCE=ENV"));
    }
  }

  @Test
  void envModeAllowsFieldsTheConfigurationFileDoesNotDefine() throws Exception {
    try (AutoCloseable env =
        ConfigSources.overrideForTest(AUTHENTICATION_CONFIGURATION, ConfigSourceMode.ENV)) {
      assertDoesNotThrow(
          () ->
              SettingsWriteGuard.assertWritable(
                  AUTHENTICATION_CONFIGURATION,
                  STORED,
                  json("{'provider':'basic','jwtTeamClaimMapping':'teams'}")));
    }
  }

  @Test
  void otherModesNeverReject() {
    assertDoesNotThrow(
        () ->
            SettingsWriteGuard.assertWritable(
                AUTHENTICATION_CONFIGURATION, STORED, json("{'provider':'okta'}")));
  }

  private static JsonNode json(String singleQuoted) {
    try {
      return MAPPER.readTree(singleQuoted.replace('\'', '"'));
    } catch (JsonProcessingException invalid) {
      throw new IllegalArgumentException(singleQuoted, invalid);
    }
  }
}
