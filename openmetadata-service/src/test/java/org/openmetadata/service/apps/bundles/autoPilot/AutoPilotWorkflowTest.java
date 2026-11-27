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

package org.openmetadata.service.apps.bundles.autoPilot;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.EdgeDefinition;
import org.openmetadata.schema.utils.JsonUtils;

/** See ADR:2026-10-22-a-workflow-run-never-ends-with-a-branch-waiting-at-a-join. */
class AutoPilotWorkflowTest {

  private static final String RESOURCE =
      "/applications/AutoPilotApplication/openmetadata/AutoPilotWorkflow.json";

  @Test
  void usageRunsOnceDataInsightsAndLineageHaveJoined() throws IOException {
    WorkflowDefinition workflow = packaged();

    assertEquals(
        Set.of("FirstSyncGateway"),
        nodes(workflow, edge -> "RunUsageIngestion".equals(edge.getTo()), EdgeDefinition::getFrom));
    assertEquals(
        Set.of("RunDataInsightsApplication", "RunLineageIngestion"),
        nodes(workflow, edge -> "FirstSyncGateway".equals(edge.getTo()), EdgeDefinition::getFrom));
  }

  /**
   * Metadata runs before the first fork and Usage after its join, so their failure edges leave no
   * branch waiting at a join. A failure edge on any other node would.
   */
  @Test
  void onlyNodesOutsideAForkHaveAFailureEdge() throws IOException {
    assertEquals(
        Set.of("RunMetadataIngestion", "RunUsageIngestion"),
        nodes(packaged(), edge -> "failure".equals(edge.getCondition()), EdgeDefinition::getFrom));
  }

  private static Set<String> nodes(
      WorkflowDefinition workflow,
      Predicate<EdgeDefinition> edges,
      Function<EdgeDefinition, String> end) {
    return workflow.getEdges().stream().filter(edges).map(end).collect(Collectors.toSet());
  }

  private static WorkflowDefinition packaged() throws IOException {
    try (InputStream in = AutoPilotWorkflowTest.class.getResourceAsStream(RESOURCE)) {
      return JsonUtils.readValue(
          new String(in.readAllBytes(), StandardCharsets.UTF_8), WorkflowDefinition.class);
    }
  }
}
