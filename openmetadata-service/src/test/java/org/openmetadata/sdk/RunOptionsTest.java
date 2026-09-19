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
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.metadataIngestion.TestSuitePipeline;
import org.openmetadata.schema.utils.JsonUtils;

class RunOptionsTest {

  private static final String TEST_CASE_NAME = "table_row_count_to_equal";
  private static final String SUITE_ENTITY_FQN = "red.dev.orders";

  @Test
  void anUnscopedRunUsesThePipelineAsItIs() {
    IngestionPipeline suitePipeline = testSuitePipeline();

    assertSame(suitePipeline, RunOptions.NONE.applyTo(suitePipeline));
  }

  @Test
  void aScopedRunExecutesOnlyTheRequestedTestCases() {
    IngestionPipeline scoped =
        RunOptions.forTestCases(List.of(TEST_CASE_NAME)).applyTo(testSuitePipeline());

    assertEquals(List.of(TEST_CASE_NAME), suiteConfigOf(scoped).getTestCases());
    assertEquals(SUITE_ENTITY_FQN, suiteConfigOf(scoped).getEntityFullyQualifiedName());
  }

  /**
   * The stored pipeline must come back untouched. If the scope ever reached storage, the suite's
   * scheduled runs would silently execute a single test case from then on.
   */
  @Test
  void scopingARunLeavesThePipelineItWasGivenUntouched() {
    IngestionPipeline suitePipeline = testSuitePipeline();

    IngestionPipeline scoped =
        RunOptions.forTestCases(List.of(TEST_CASE_NAME)).applyTo(suitePipeline);

    assertNotSame(suitePipeline, scoped);
    assertNull(suiteConfigOf(suitePipeline).getTestCases());
  }

  /**
   * Resolving secrets withholds the source config from a caller without ViewAll on the pipeline. A
   * caller who may still trigger it must run the one test case, not the whole suite.
   */
  @Test
  void theScopeSurvivesAWithheldSourceConfig() {
    IngestionPipeline suitePipeline = testSuitePipeline();
    suitePipeline.getSourceConfig().setConfig(null);

    IngestionPipeline scoped =
        RunOptions.forTestCases(List.of(TEST_CASE_NAME)).applyTo(suitePipeline);

    assertEquals(List.of(TEST_CASE_NAME), suiteConfigOf(scoped).getTestCases());
  }

  @Test
  void noTestCasesMeansTheWholeSuite() {
    RunOptions options = new RunOptions(null, null);

    assertTrue(options.testCases().isEmpty());
    IngestionPipeline suitePipeline = testSuitePipeline();
    assertSame(suitePipeline, options.applyTo(suitePipeline));
  }

  private static TestSuitePipeline suiteConfigOf(IngestionPipeline pipeline) {
    return JsonUtils.convertValue(pipeline.getSourceConfig().getConfig(), TestSuitePipeline.class);
  }

  private static IngestionPipeline testSuitePipeline() {
    return new IngestionPipeline()
        .withId(UUID.randomUUID())
        .withName("orders_suite_pipeline")
        .withPipelineType(PipelineType.TEST_SUITE)
        .withSourceConfig(
            new SourceConfig()
                .withConfig(
                    new TestSuitePipeline().withEntityFullyQualifiedName(SUITE_ENTITY_FQN)));
  }
}
