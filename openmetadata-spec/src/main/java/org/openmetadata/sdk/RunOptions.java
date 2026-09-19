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

import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.metadataIngestion.TestSuitePipeline;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * What applies to a single run of an ingestion pipeline, as opposed to the configuration the
 * pipeline is deployed with.
 *
 * @param testCases names of the test cases a test suite run executes; empty runs the whole suite
 * @param appConfigOverride application config merged over the deployed one, or null
 */
public record RunOptions(List<String> testCases, Map<String, Object> appConfigOverride) {

  public static final RunOptions NONE = new RunOptions(List.of(), null);

  public RunOptions {
    testCases = testCases == null ? List.of() : List.copyOf(testCases);
  }

  public static RunOptions forTestCases(List<String> testCases) {
    return new RunOptions(testCases, null);
  }

  public static RunOptions withAppConfigOverride(Map<String, Object> appConfigOverride) {
    return new RunOptions(List.of(), appConfigOverride);
  }

  /**
   * The pipeline as a runner that rebuilds its run from the entity has to see it for this run:
   * {@code pipeline} itself when nothing is scoped, otherwise a copy whose test suite config runs
   * only {@link #testCases}. A copy, because scoping the stored entity would narrow every later
   * scheduled run of the whole suite.
   */
  public IngestionPipeline applyTo(IngestionPipeline pipeline) {
    if (testCases.isEmpty()) {
      return pipeline;
    }
    IngestionPipeline scopedPipeline = JsonUtils.deepCopy(pipeline, IngestionPipeline.class);
    TestSuitePipeline sourceConfig =
        Optional.ofNullable(
                JsonUtils.convertValue(
                    scopedPipeline.getSourceConfig().getConfig(), TestSuitePipeline.class))
            .orElseGet(TestSuitePipeline::new);
    scopedPipeline.getSourceConfig().setConfig(sourceConfig.withTestCases(testCases));
    return scopedPipeline;
  }
}
