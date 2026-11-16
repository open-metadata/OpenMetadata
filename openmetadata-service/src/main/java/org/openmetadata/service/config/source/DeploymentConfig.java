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

import java.time.Duration;
import java.util.Collection;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.openmetadata.schema.configuration.ConfigSourceConfiguration;
import org.openmetadata.schema.configuration.ConfigSourceMode;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.OpenMetadataApplicationConfig;

/**
 * The deployment configuration of every setting that also lives in the database, captured before
 * anything at startup can modify the configuration object. Security reloads copy the database
 * values into that object, so reading it later would compare the database with itself.
 */
public final class DeploymentConfig {
  private static final int DEFAULT_WATCH_INTERVAL_SECONDS = 10;

  private final Map<SettingsType, DeploymentSetting> settings;
  private final Set<SettingsType> builtInFallbacks;
  private final ConfigSourceConfiguration sources;

  private DeploymentConfig(
      Map<SettingsType, DeploymentSetting> settings,
      Set<SettingsType> builtInFallbacks,
      ConfigSourceConfiguration sources) {
    this.settings = settings;
    this.builtInFallbacks = builtInFallbacks;
    this.sources = sources;
  }

  public static DeploymentConfig capture(OpenMetadataApplicationConfig config) {
    Map<SettingsType, DeploymentSetting> settings = new EnumMap<>(SettingsType.class);
    Set<SettingsType> builtInFallbacks = EnumSet.noneOf(SettingsType.class);
    boolean operationsFileRead = Boolean.TRUE.equals(config.getOpsConfig().getEnable());
    for (DualSourceSetting setting : DualSourceSetting.values()) {
      Object value = setting.deploymentValue(config);
      if (value != null) {
        settings.put(
            setting.settingsType(),
            new DeploymentSetting(setting, JsonUtils.valueToTree(value), templateOf(setting)));
        if (setting.templateKind() == ConfigTemplateKind.OPERATIONS && !operationsFileRead) {
          builtInFallbacks.add(setting.settingsType());
        }
      }
    }
    ConfigSourceConfiguration sources =
        JsonUtils.deepCopy(config.getConfigSourceConfiguration(), ConfigSourceConfiguration.class);
    return new DeploymentConfig(settings, builtInFallbacks, sources);
  }

  /** A deployment configuration from explicit values, for example to replay a restart in a test. */
  public static DeploymentConfig of(
      Collection<DeploymentSetting> settings, ConfigSourceConfiguration sources) {
    Map<SettingsType, DeploymentSetting> byType = new EnumMap<>(SettingsType.class);
    settings.forEach(setting -> byType.put(setting.settingsType(), setting));
    return new DeploymentConfig(
        byType,
        EnumSet.noneOf(SettingsType.class),
        sources == null ? new ConfigSourceConfiguration() : sources);
  }

  public Collection<DeploymentSetting> settings() {
    return List.copyOf(settings.values());
  }

  public Optional<DeploymentSetting> setting(SettingsType settingsType) {
    return Optional.ofNullable(settings.get(settingsType));
  }

  public ConfigSourceMode modeOf(SettingsType settingsType) {
    return ConfigSourceGroup.of(settingsType)
        .map(group -> group.modeIn(sources))
        .orElse(ConfigSourceMode.AUTO);
  }

  /**
   * Settings in ENV mode that the configuration file does not define; ENV mode needs a value.
   *
   * <p>Email and the server URL come from the operations file alone. With operational config
   * disabled that file is never read, and the configuration carries built-in values that only seed
   * a new database: ENV mode would write them over the stored settings and lock them (#35368).
   */
  public List<String> envModeSettingsWithoutDeploymentValue() {
    return ConfigSourceGroup.dualSourceTypes().stream()
        .filter(settingsType -> modeOf(settingsType) == ConfigSourceMode.ENV)
        .filter(
            settingsType ->
                !settings.containsKey(settingsType) || builtInFallbacks.contains(settingsType))
        .map(SettingsType::value)
        .sorted()
        .toList();
  }

  public boolean confirmProviderChange() {
    return Boolean.TRUE.equals(sources.getConfirmProviderChange());
  }

  public Duration watchInterval() {
    Integer seconds = sources.getWatchIntervalSeconds();
    return Duration.ofSeconds(
        seconds == null || seconds < 1 ? DEFAULT_WATCH_INTERVAL_SECONDS : seconds);
  }

  private static DeploymentTemplate templateOf(DualSourceSetting setting) {
    return ConfigTemplates.get(setting.templateKind())
        .map(yaml -> DeploymentTemplate.parse(yaml, setting.templateSection()))
        .orElse(DeploymentTemplate.empty());
  }
}
