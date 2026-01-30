/*
 *  Copyright 2021 Collate
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

package org.openmetadata.schema.configuration;

import org.openmetadata.schema.type.ConfigSource;

/**
 * Base configuration interface for all OpenMetadata settings that support configSource. The
 * configSource field determines where the configuration is read from: ENV (always from
 * YAML/environment), DB (always from database), or AUTO (last-write-wins based on timestamps).
 */
public interface OpenMetadataConfig {

  ConfigSource getConfigSource();

  void setConfigSource(ConfigSource configSource);
}
