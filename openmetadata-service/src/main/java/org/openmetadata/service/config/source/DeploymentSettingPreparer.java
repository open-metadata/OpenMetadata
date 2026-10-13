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

/** Turns a setting value from the deployment into the JSON to store, secrets encrypted. */
public interface DeploymentSettingPreparer {
  /**
   * Validates a reconciled value the way an API write of the setting would, without calling
   * external systems, and returns the JSON to store. Throws what an API write would on invalid
   * values.
   */
  String prepareReconciled(SettingsType settingsType, JsonNode value);

  /** Applies the checks a first start always ran on a seeded value, and returns the JSON to store. */
  String prepareSeed(SettingsType settingsType, JsonNode value);
}
