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

package org.openmetadata.service.resources.dqtests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.resources.dqtests.TestCaseResource.runnablePipelineAmong;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;

class TestCaseRunnablePipelineTest {

  private static final UUID LOWEST_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");
  private static final UUID MIDDLE_ID = UUID.fromString("00000000-0000-0000-0000-000000000002");
  private static final UUID HIGHEST_ID = UUID.fromString("00000000-0000-0000-0000-000000000003");

  /**
   * The details page picks the pipeline to show run state for by the same rule, so the endpoint
   * must run that one, not whichever the suite happens to list first.
   */
  @Test
  void runsTheRunnablePipelineWithTheLowestId() {
    List<IngestionPipeline> pipelines =
        List.of(pipeline(HIGHEST_ID, true, true), pipeline(MIDDLE_ID, true, true));

    assertEquals(MIDDLE_ID, runnablePipelineAmong(pipelines).orElseThrow().getId());
  }

  @Test
  void skipsDisabledAndUndeployedPipelinesEvenWithALowerId() {
    List<IngestionPipeline> pipelines =
        List.of(
            pipeline(LOWEST_ID, false, true),
            pipeline(MIDDLE_ID, true, false),
            pipeline(HIGHEST_ID, true, true));

    assertEquals(HIGHEST_ID, runnablePipelineAmong(pipelines).orElseThrow().getId());
  }

  @Test
  void findsNothingWhenNoPipelineIsBothEnabledAndDeployed() {
    List<IngestionPipeline> pipelines =
        List.of(pipeline(LOWEST_ID, false, true), pipeline(MIDDLE_ID, true, false));

    assertTrue(runnablePipelineAmong(pipelines).isEmpty());
  }

  private static IngestionPipeline pipeline(UUID id, boolean enabled, boolean deployed) {
    return new IngestionPipeline().withId(id).withEnabled(enabled).withDeployed(deployed);
  }
}
