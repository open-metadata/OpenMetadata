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

import static org.openmetadata.schema.settings.SettingsType.APP_CONFIGURATION;
import static org.openmetadata.schema.settings.SettingsType.AUTHENTICATION_CONFIGURATION;
import static org.openmetadata.schema.settings.SettingsType.AUTHORIZER_CONFIGURATION;
import static org.openmetadata.schema.settings.SettingsType.EMAIL_CONFIGURATION;
import static org.openmetadata.schema.settings.SettingsType.MCP_CONFIGURATION;
import static org.openmetadata.schema.settings.SettingsType.OPEN_METADATA_BASE_URL_CONFIGURATION;
import static org.openmetadata.schema.settings.SettingsType.SCIM_CONFIGURATION;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.openmetadata.schema.configuration.ConfigSourceConfiguration;
import org.openmetadata.schema.configuration.ConfigSourceMode;
import org.openmetadata.schema.settings.SettingsType;

/**
 * Settings that exist both in the deployment configuration (YAML and environment variables) and in
 * the database, grouped the way their source is selected. Authentication and authorizer settings
 * share one source because the SSO page saves them together.
 */
public enum ConfigSourceGroup {
  SECURITY(
      "SECURITY_CONFIG_SOURCE",
      ConfigSourceMode.AUTO,
      ConfigSourceConfiguration::getSecurity,
      List.of(AUTHENTICATION_CONFIGURATION, AUTHORIZER_CONFIGURATION)),
  EMAIL(
      "EMAIL_CONFIG_SOURCE",
      ConfigSourceMode.AUTO,
      ConfigSourceConfiguration::getEmail,
      List.of(EMAIL_CONFIGURATION)),
  SERVER_URL(
      "SERVER_URL_CONFIG_SOURCE",
      ConfigSourceMode.AUTO,
      ConfigSourceConfiguration::getServerUrl,
      List.of(OPEN_METADATA_BASE_URL_CONFIGURATION)),
  SCIM(
      "SCIM_CONFIG_SOURCE",
      ConfigSourceMode.AUTO,
      ConfigSourceConfiguration::getScim,
      List.of(SCIM_CONFIGURATION)),
  MCP(
      "MCP_CONFIG_SOURCE",
      ConfigSourceMode.AUTO,
      ConfigSourceConfiguration::getMcp,
      List.of(MCP_CONFIGURATION)),
  // The application configuration was documented as database-owned once seeded.
  APP(
      "APP_CONFIG_SOURCE",
      ConfigSourceMode.DB,
      ConfigSourceConfiguration::getApp,
      List.of(APP_CONFIGURATION));

  private static final Set<SettingsType> DUAL_SOURCE_TYPES =
      Arrays.stream(values())
          .flatMap(group -> group.settingsTypes.stream())
          .collect(Collectors.toUnmodifiableSet());

  private final String modeVariable;
  private final ConfigSourceMode defaultMode;
  private final Function<ConfigSourceConfiguration, ConfigSourceMode> configuredMode;
  private final List<SettingsType> settingsTypes;

  ConfigSourceGroup(
      String modeVariable,
      ConfigSourceMode defaultMode,
      Function<ConfigSourceConfiguration, ConfigSourceMode> configuredMode,
      List<SettingsType> settingsTypes) {
    this.modeVariable = modeVariable;
    this.defaultMode = defaultMode;
    this.configuredMode = configuredMode;
    this.settingsTypes = settingsTypes;
  }

  public String modeVariable() {
    return modeVariable;
  }

  public List<SettingsType> settingsTypes() {
    return settingsTypes;
  }

  public ConfigSourceMode modeIn(ConfigSourceConfiguration configuration) {
    ConfigSourceMode configured =
        configuration == null ? null : configuredMode.apply(configuration);
    return configured == null ? defaultMode : configured;
  }

  public static Optional<ConfigSourceGroup> of(SettingsType settingsType) {
    return Arrays.stream(values())
        .filter(group -> group.settingsTypes.contains(settingsType))
        .findFirst();
  }

  public static boolean isDualSource(SettingsType settingsType) {
    return DUAL_SOURCE_TYPES.contains(settingsType);
  }

  public static Set<SettingsType> dualSourceTypes() {
    return DUAL_SOURCE_TYPES;
  }
}
