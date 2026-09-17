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

package org.openmetadata.service.resources.dqtests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.openmetadata.service.resources.dqtests.TestCaseResource.scopedToTestCase;

import java.util.List;
import java.util.UUID;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.metadataIngestion.TestSuitePipeline;
import org.openmetadata.schema.utils.JsonUtils;

class TestCaseRunScopeTest {

  private static final String TEST_CASE_NAME = "table_row_count_to_equal";
  private static final Consumer<IngestionPipeline> SECRETS_UNCHANGED = pipeline -> {};

  @Test
  void scopedCopyRunsOnlyTheRequestedTestCase() {
    IngestionPipeline scoped =
        scopedToTestCase(testSuitePipeline(), TEST_CASE_NAME, SECRETS_UNCHANGED);

    assertEquals(List.of(TEST_CASE_NAME), scopedTestCases(scoped));
  }

  /**
   * The stored pipeline must come back untouched. If the scope ever reached storage, the suite's
   * scheduled runs would silently execute a single test case from then on.
   */
  @Test
  void scopingDoesNotMutateTheSourcePipeline() {
    IngestionPipeline suitePipeline = testSuitePipeline();

    IngestionPipeline scoped = scopedToTestCase(suitePipeline, TEST_CASE_NAME, SECRETS_UNCHANGED);

    assertNotSame(suitePipeline, scoped);
    assertNull(scopedTestCases(suitePipeline));
  }

  /**
   * Resolving secrets withholds the source config from a caller without ViewAll on the pipeline. A
   * caller who may still trigger it must run the one test case, not the whole suite.
   */
  @Test
  void theScopeSurvivesSecretsResolutionThatWithholdsTheSourceConfig() {
    IngestionPipeline scoped =
        scopedToTestCase(
            testSuitePipeline(),
            TEST_CASE_NAME,
            pipeline -> pipeline.getSourceConfig().setConfig(null));

    assertEquals(List.of(TEST_CASE_NAME), scopedTestCases(scoped));
  }

  @Test
  void secretsAreResolvedOnTheCopyAndNotOnTheStoredPipeline() {
    IngestionPipeline suitePipeline = testSuitePipeline();

    scopedToTestCase(
        suitePipeline, TEST_CASE_NAME, pipeline -> pipeline.getSourceConfig().setConfig(null));

    assertEquals(
        "red.dev.orders",
        JsonUtils.convertValue(suitePipeline.getSourceConfig().getConfig(), TestSuitePipeline.class)
            .getEntityFullyQualifiedName());
  }

  private static List<String> scopedTestCases(IngestionPipeline pipeline) {
    return JsonUtils.convertValue(pipeline.getSourceConfig().getConfig(), TestSuitePipeline.class)
        .getTestCases();
  }

  private static IngestionPipeline testSuitePipeline() {
    return new IngestionPipeline()
        .withId(UUID.randomUUID())
        .withName("orders_suite_pipeline")
        .withPipelineType(PipelineType.TEST_SUITE)
        .withSourceConfig(
            new SourceConfig()
                .withConfig(
                    new TestSuitePipeline().withEntityFullyQualifiedName("red.dev.orders")));
  }
}
