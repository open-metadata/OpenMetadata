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
import lombok.Builder;
import org.openmetadata.schema.configuration.ConfigSourceMode;

/**
 * Everything one reconciliation of one setting looks at. Secrets are decrypted.
 *
 * @param deployment the value from the deployment configuration (YAML and environment)
 * @param stored the value in the database
 * @param lastApplied the deployment value applied by the previous reconciliation; null when the
 *     setting was never reconciled
 * @param schemaDefaults the value every field takes when it is absent from the stored setting
 * @param switchingToEnv whether this start moves the setting into ENV mode
 * @param confirmProviderChange whether ENV mode may replace the stored identity provider
 */
@Builder
public record MergeInput(
    SettingsFieldPolicy policy,
    ConfigSourceMode mode,
    JsonNode deployment,
    JsonNode stored,
    JsonNode lastApplied,
    DeploymentTemplate template,
    JsonNode schemaDefaults,
    boolean switchingToEnv,
    boolean confirmProviderChange) {}
