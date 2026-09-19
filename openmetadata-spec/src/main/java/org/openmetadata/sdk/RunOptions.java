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

package org.openmetadata.sdk;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * What applies to a single run of an ingestion pipeline, as opposed to the configuration the
 * pipeline is deployed with.
 *
 * <p>The source config override is a partial source config: its top-level keys replace the
 * pipeline's own for this run only, such as the test cases a test suite runs or the filter patterns
 * that narrow a profiler run to one table. It stays a map because it is a partial of whichever
 * config type the pipeline has, overlaid by every runner the same way.
 *
 * @param sourceConfigOverride source config keys that replace the pipeline's for this run
 * @param appConfigOverride application config merged over the deployed one, or null
 */
public record RunOptions(
    Map<String, Object> sourceConfigOverride, Map<String, Object> appConfigOverride) {

  public static final RunOptions NONE = new RunOptions(Map.of(), null);

  public RunOptions {
    sourceConfigOverride =
        sourceConfigOverride == null ? Map.of() : Map.copyOf(sourceConfigOverride);
  }

  public static RunOptions withSourceConfigOverride(Map<String, Object> sourceConfigOverride) {
    return new RunOptions(sourceConfigOverride, null);
  }

  public static RunOptions withAppConfigOverride(Map<String, Object> appConfigOverride) {
    return new RunOptions(Map.of(), appConfigOverride);
  }

  /**
   * The pipeline as a runner that rebuilds its run from the entity has to see it for this run:
   * {@code pipeline} itself when there is no override, otherwise a copy whose source config has the
   * override laid over it. A copy, because overriding the stored entity would change every later
   * scheduled run.
   */
  public IngestionPipeline applyTo(IngestionPipeline pipeline) {
    if (sourceConfigOverride.isEmpty()) {
      return pipeline;
    }
    IngestionPipeline pipelineForRun = JsonUtils.deepCopy(pipeline, IngestionPipeline.class);
    Map<String, Object> sourceConfig =
        new HashMap<>(
            JsonUtils.getMap(
                Optional.ofNullable(pipelineForRun.getSourceConfig().getConfig())
                    .orElseGet(Map::of)));
    sourceConfig.putAll(sourceConfigOverride);
    pipelineForRun.getSourceConfig().setConfig(sourceConfig);
    return pipelineForRun;
  }
}
