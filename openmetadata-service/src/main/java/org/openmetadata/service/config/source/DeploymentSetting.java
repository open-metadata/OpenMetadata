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
import org.openmetadata.schema.settings.SettingsType;

/**
 * One setting's value in the deployment configuration, captured at startup.
 *
 * @param value the value after environment substitution, secrets in clear text
 * @param template the configuration file section it was read from
 */
public record DeploymentSetting(
    DualSourceSetting setting, JsonNode value, DeploymentTemplate template) {
  public SettingsType settingsType() {
    return setting.settingsType();
  }
}
