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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.FilterPattern;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.metadataIngestion.TestSuitePipeline;
import org.openmetadata.schema.utils.JsonUtils;

class RunOptionsTest {

  private static final String TEST_CASE_NAME = "table_row_count_to_equal";
  private static final String SUITE_ENTITY_FQN = "red.dev.orders";
  private static final RunOptions ONE_TEST_CASE =
      RunOptions.withSourceConfigOverride(Map.of("testCases", List.of(TEST_CASE_NAME)));

  @Test
  void aRunWithoutAnOverrideUsesThePipelineAsItIs() {
    IngestionPipeline suitePipeline = testSuitePipeline();

    assertSame(suitePipeline, RunOptions.NONE.applyTo(suitePipeline));
  }

  @Test
  void theOverrideReplacesItsKeysAndKeepsTheRestOfTheConfig() {
    IngestionPipeline scoped = ONE_TEST_CASE.applyTo(testSuitePipeline());

    TestSuitePipeline config = configOf(scoped, TestSuitePipeline.class);
    assertEquals(List.of(TEST_CASE_NAME), config.getTestCases());
    assertEquals(SUITE_ENTITY_FQN, config.getEntityFullyQualifiedName());
  }

  /** A key is replaced whole, so a scoped filter pattern does not merge with the deployed one. */
  @Test
  void anOverriddenKeyReplacesTheDeployedValueWhole() {
    IngestionPipeline metadataPipeline =
        pipeline(
            PipelineType.METADATA,
            new DatabaseServiceMetadataPipeline()
                .withMarkDeletedTables(true)
                .withTableFilterPattern(new FilterPattern().withIncludes(List.of("orders.*"))));
    RunOptions options =
        RunOptions.withSourceConfigOverride(
            Map.of(
                "markDeletedTables",
                false,
                "tableFilterPattern",
                Map.of("includes", List.of("^red\\.dev\\.orders$"))));

    DatabaseServiceMetadataPipeline config =
        configOf(options.applyTo(metadataPipeline), DatabaseServiceMetadataPipeline.class);

    assertFalse(config.getMarkDeletedTables());
    assertEquals(List.of("^red\\.dev\\.orders$"), config.getTableFilterPattern().getIncludes());
  }

  /**
   * The stored pipeline must come back untouched. If the override ever reached storage, every later
   * scheduled run would be narrowed the same way.
   */
  @Test
  void anOverrideLeavesThePipelineItWasGivenUntouched() {
    IngestionPipeline suitePipeline = testSuitePipeline();

    IngestionPipeline scoped = ONE_TEST_CASE.applyTo(suitePipeline);

    assertNotSame(suitePipeline, scoped);
    assertNull(configOf(suitePipeline, TestSuitePipeline.class).getTestCases());
  }

  /**
   * Resolving secrets withholds the source config from a caller without ViewAll on the pipeline. A
   * caller who may still trigger it must get the scoped run, not the whole pipeline.
   */
  @Test
  void theOverrideSurvivesAWithheldSourceConfig() {
    IngestionPipeline suitePipeline = testSuitePipeline();
    suitePipeline.getSourceConfig().setConfig(null);

    IngestionPipeline scoped = ONE_TEST_CASE.applyTo(suitePipeline);

    assertEquals(List.of(TEST_CASE_NAME), configOf(scoped, TestSuitePipeline.class).getTestCases());
  }

  @Test
  void noOverrideMeansTheDeployedConfig() {
    RunOptions options = new RunOptions(null, null);

    assertTrue(options.sourceConfigOverride().isEmpty());
    IngestionPipeline suitePipeline = testSuitePipeline();
    assertSame(suitePipeline, options.applyTo(suitePipeline));
  }

  private static <T> T configOf(IngestionPipeline pipeline, Class<T> configClass) {
    return JsonUtils.convertValue(pipeline.getSourceConfig().getConfig(), configClass);
  }

  private static IngestionPipeline testSuitePipeline() {
    return pipeline(
        PipelineType.TEST_SUITE,
        new TestSuitePipeline().withEntityFullyQualifiedName(SUITE_ENTITY_FQN));
  }

  private static IngestionPipeline pipeline(PipelineType type, Object config) {
    return new IngestionPipeline()
        .withId(UUID.randomUUID())
        .withName("pipeline")
        .withPipelineType(type)
        .withSourceConfig(new SourceConfig().withConfig(config));
  }
}
