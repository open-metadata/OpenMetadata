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

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Set;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.service.exception.SettingsManagedByEnvironmentException;

/**
 * Rejects writes to fields the deployment owns. Every write of a setting goes through the settings
 * repository, so guarding there covers the REST API, the CLI and administration jobs alike.
 */
public final class SettingsWriteGuard {
  /** Stands for the whole setting when the configuration file could not be read. */
  public static final String WHOLE_SETTING = "/";

  private SettingsWriteGuard() {}

  /** Throws when writing {@code incoming} over {@code stored} changes a deployment-owned field. */
  public static void assertWritable(SettingsType settingsType, JsonNode stored, JsonNode incoming) {
    if (ConfigSources.isManagedByDeployment(settingsType)) {
      List<String> changed =
          managedPaths(settingsType).stream()
              .filter(path -> !SettingValues.same(valueAt(stored, path), valueAt(incoming, path)))
              .toList();
      if (!changed.isEmpty()) {
        throw new SettingsManagedByEnvironmentException(
            settingsType, modeVariable(settingsType), changed);
      }
    }
  }

  /** Whether {@code path} of {@code settingsType} may only be changed by the deployment. */
  public static boolean isDeploymentOwned(SettingsType settingsType, String path) {
    return ConfigSources.isManagedByDeployment(settingsType)
        && (managedPaths(settingsType).contains(WHOLE_SETTING)
            || managedPaths(settingsType).contains(path));
  }

  /** The fields of {@code settingsType} that only the deployment configuration may change. */
  public static Set<String> managedPaths(SettingsType settingsType) {
    DeploymentTemplate template =
        ConfigSources.deployment()
            .flatMap(deployment -> deployment.setting(settingsType))
            .map(DeploymentSetting::template)
            .orElse(DeploymentTemplate.empty());
    return template.isAvailable() ? template.paths() : Set.of(WHOLE_SETTING);
  }

  public static String modeVariable(SettingsType settingsType) {
    return ConfigSourceGroup.of(settingsType).map(ConfigSourceGroup::modeVariable).orElse("");
  }

  private static JsonNode valueAt(JsonNode tree, String path) {
    return WHOLE_SETTING.equals(path) ? tree : JsonPointers.valueAt(tree, path);
  }
}
