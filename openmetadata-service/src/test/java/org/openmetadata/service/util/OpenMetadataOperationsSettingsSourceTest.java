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

package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.schema.settings.SettingsType.AUTHENTICATION_CONFIGURATION;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.configuration.ConfigSourceConfiguration;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.config.source.ConfigSources;
import org.openmetadata.service.config.source.DeploymentConfig;
import org.openmetadata.service.config.source.DeploymentSetting;
import org.openmetadata.service.config.source.DeploymentTemplate;
import org.openmetadata.service.config.source.DualSourceSetting;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.jdbi3.SystemTokenDAOs.SystemDAO;
import picocli.CommandLine;
import picocli.CommandLine.ParseResult;

class OpenMetadataOperationsSettingsSourceTest {
  private static final String AUTH = AUTHENTICATION_CONFIGURATION.value();

  private final Map<String, String> rows = new ConcurrentHashMap<>();
  private SystemDAO dao;
  private SystemRepository repository;

  @BeforeEach
  void setUp() {
    dao = mock(SystemDAO.class);
    when(dao.getConfigJsonWithKey(anyString())).thenAnswer(i -> rows.get(i.<String>getArgument(0)));
    doAnswer(i -> rows.remove(i.<String>getArgument(0))).when(dao).delete(anyString());
    repository = mock(SystemRepository.class);
    doAnswer(
            i -> {
              Settings settings = i.getArgument(0);
              rows.put(
                  settings.getConfigType().value(),
                  JsonUtils.pojoToJson(settings.getConfigValue()));
              return null;
            })
        .when(repository)
        .createOrUpdate(any(Settings.class));
  }

  @AfterEach
  void tearDown() {
    ConfigSources.install(null);
  }

  @Test
  void adoptCommandBindsTheSettingAndEveryRequestedPath() {
    ParseResult parsed =
        new CommandLine(new OpenMetadataOperations())
            .parseArgs(
                "-c",
                "unused.yaml",
                "adopt-deployment-config",
                "--type",
                AUTH,
                "--path",
                "/maxActiveSessionsPerUser",
                "--path",
                "/enableSelfSignup");

    assertEquals(AUTH, parsed.subcommand().matchedOptionValue("--type", ""));
    assertEquals(
        List.of("/maxActiveSessionsPerUser", "/enableSelfSignup"),
        parsed.subcommand().matchedOptionValue("--path", List.of()));
  }

  @Test
  void adoptsTheDeploymentValueOfTheRequestedField() {
    rows.put(AUTH, "{\"provider\":\"basic\",\"providerName\":\"basic\"}");
    installDeployment(
        "{\"provider\":\"basic\",\"providerName\":\"basic\",\"maxActiveSessionsPerUser\":1000}");

    OpenMetadataOperations.adoptDeploymentSetting(
        dao, repository, AUTH, List.of("/maxActiveSessionsPerUser"));

    assertEquals(1000, JsonUtils.readTree(rows.get(AUTH)).get("maxActiveSessionsPerUser").asInt());
  }

  @Test
  void rejectsAnUnknownSettingType() {
    assertThrows(
        IllegalArgumentException.class,
        () ->
            OpenMetadataOperations.adoptDeploymentSetting(dao, repository, "noSuchSetting", null));
  }

  @Test
  void removesAStoredSettingThatNoLongerParses() {
    rows.put(AUTH, "{\"provider\":\"retired-provider\"}");

    assertTrue(OpenMetadataOperations.removeStoredSetting(dao, AUTHENTICATION_CONFIGURATION));

    assertFalse(rows.containsKey(AUTH));
    assertFalse(OpenMetadataOperations.removeStoredSetting(dao, AUTHENTICATION_CONFIGURATION));
  }

  private static void installDeployment(String deploymentValue) {
    DeploymentTemplate template =
        DeploymentTemplate.parse(
            """
            authenticationConfiguration:
              maxActiveSessionsPerUser: ${AUTHENTICATION_MAX_ACTIVE_SESSIONS_PER_USER:-5}
            """,
            "/authenticationConfiguration");
    ConfigSources.install(
        DeploymentConfig.of(
            List.of(
                new DeploymentSetting(
                    DualSourceSetting.AUTHENTICATION,
                    JsonUtils.readTree(deploymentValue),
                    template)),
            new ConfigSourceConfiguration()));
  }
}
