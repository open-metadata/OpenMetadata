/*
 *  Copyright 2025 Collate.
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
package org.openmetadata.service;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

/**
 * Configuration for the construct sidecar — a SINGLE block shared by every construct plugin.
 *
 * <p>{@code hostPort} is the sidecar base URL used by all plugins (set it once). Each plugin
 * nests its own settings; e.g. {@code queryRunner.enabled} selects construct instead of the
 * legacy backend (the Argo pod) for Query Runner. New construct plugins add their own nested
 * block here rather than a new top-level config.
 */
@Getter
@Setter
public class ConstructConfiguration {
  /** Base URL of the construct sidecar, e.g. {@code http://construct:8087}. Shared by all plugins. */
  @JsonProperty("hostPort")
  private String hostPort;

  @JsonProperty("queryRunner")
  private QueryRunner queryRunner = new QueryRunner();

  /** Query Runner plugin settings. */
  @Getter
  @Setter
  public static class QueryRunner {
    /** When true, Query Runner dispatches to the construct sidecar instead of the Argo pod. */
    @JsonProperty("enabled")
    private boolean enabled = false;
  }
}
