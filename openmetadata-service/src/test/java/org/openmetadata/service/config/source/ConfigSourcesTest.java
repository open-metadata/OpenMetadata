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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.schema.settings.SettingsType.APP_CONFIGURATION;
import static org.openmetadata.schema.settings.SettingsType.AUTHENTICATION_CONFIGURATION;
import static org.openmetadata.schema.settings.SettingsType.EMAIL_CONFIGURATION;
import static org.openmetadata.schema.settings.SettingsType.SEARCH_SETTINGS;

import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.jdbi.v3.core.statement.UnableToExecuteStatementException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.configuration.ConfigSourceConfiguration;
import org.openmetadata.schema.configuration.ConfigSourceMode;
import org.openmetadata.service.jdbi3.SystemTokenDAOs.SystemDAO;

class ConfigSourcesTest {

  @AfterEach
  void tearDown() {
    ConfigSources.install(null);
    ConfigSources.forgetPersistedModes();
  }

  @Test
  void defaultsToAutoWithoutADeploymentConfiguration() {
    assertEquals(ConfigSourceMode.AUTO, ConfigSources.modeOf(EMAIL_CONFIGURATION));
    assertFalse(ConfigSources.isManagedByDeployment(EMAIL_CONFIGURATION));
  }

  @Test
  void takesTheModeOfTheSettingsGroupFromTheDeployment() {
    ConfigSources.install(deploymentWith(new ConfigSourceConfiguration()));

    assertEquals(ConfigSourceMode.DB, ConfigSources.modeOf(APP_CONFIGURATION));
    assertEquals(ConfigSourceMode.AUTO, ConfigSources.modeOf(AUTHENTICATION_CONFIGURATION));
  }

  @Test
  void aModePersistedByTheServerWinsOverThisProcessesDeployment() {
    ConfigSources.install(
        deploymentWith(new ConfigSourceConfiguration().withSecurity(ConfigSourceMode.AUTO)));
    ConfigSources.loadPersistedModes(daoWithSnapshot(ConfigSourceMode.ENV));

    assertEquals(ConfigSourceMode.ENV, ConfigSources.modeOf(AUTHENTICATION_CONFIGURATION));
    assertTrue(ConfigSources.isManagedByDeployment(AUTHENTICATION_CONFIGURATION));
  }

  @Test
  void aTestOverrideWinsUntilItIsClosed() throws Exception {
    ConfigSources.recordPersistedMode(EMAIL_CONFIGURATION, ConfigSourceMode.DB);
    try (AutoCloseable env =
        ConfigSources.overrideForTest(EMAIL_CONFIGURATION, ConfigSourceMode.ENV)) {
      assertEquals(ConfigSourceMode.ENV, ConfigSources.modeOf(EMAIL_CONFIGURATION));
    }
    assertEquals(ConfigSourceMode.DB, ConfigSources.modeOf(EMAIL_CONFIGURATION));
  }

  @Test
  void settingsThatOnlyLiveInTheDatabaseAreNeverManagedByTheDeployment() throws Exception {
    try (AutoCloseable env = ConfigSources.overrideForTest(SEARCH_SETTINGS, ConfigSourceMode.ENV)) {
      assertFalse(ConfigSources.isManagedByDeployment(SEARCH_SETTINGS));
    }
  }

  @Test
  void ignoresADatabaseWithoutTheSnapshotColumn() {
    SystemDAO dao = mock(SystemDAO.class);
    when(dao.getStoredSettingRow(anyString()))
        .thenThrow(new UnableToExecuteStatementException("Unknown column 'deployment_snapshot'"));

    ConfigSources.loadPersistedModes(dao);

    assertEquals(ConfigSourceMode.AUTO, ConfigSources.modeOf(AUTHENTICATION_CONFIGURATION));
  }

  @Test
  void capturesALazyDeploymentOnceAndOnlyWhenAsked() {
    AtomicInteger captures = new AtomicInteger();
    ConfigSources.installLazily(
        () -> {
          captures.incrementAndGet();
          return deploymentWith(new ConfigSourceConfiguration());
        });
    assertEquals(0, captures.get());

    ConfigSources.deployment();
    ConfigSources.deployment();

    assertEquals(1, captures.get());
  }

  private static SystemDAO daoWithSnapshot(ConfigSourceMode mode) {
    DeploymentSnapshot snapshot =
        new DeploymentSnapshot(
            JsonNodeFactory.instance.objectNode(),
            new DeploymentSnapshot.Meta(mode, "2.1.0", null, List.of(), null));
    SystemDAO dao = mock(SystemDAO.class);
    when(dao.getStoredSettingRow(AUTHENTICATION_CONFIGURATION.value()))
        .thenReturn(new StoredSettingRow("{}", snapshot.toJson()));
    return dao;
  }

  private static DeploymentConfig deploymentWith(ConfigSourceConfiguration modes) {
    return DeploymentConfig.of(List.of(), modes);
  }
}
