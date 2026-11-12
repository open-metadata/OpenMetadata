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

package org.openmetadata.service.migration.utils.v210;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;

class IncidentWorkflowTransitionMigrationTest {

  private static final String SEED_PATH =
      "json/data/governance/workflows/TestCaseResolutionTaskWorkflow.json";

  @Test
  void addsTheMissingNewTransitionAndEdgeToAnUpgradedInstall() throws IOException {
    ObjectNode definition = seedWithoutAssignedToNew();

    assertTrue(IncidentWorkflowTransitionMigration.addMissingAssignedToNewPieces(definition));

    assertEquals(1, countTransitions(definition, "AssignedStage", "new"));
    assertEquals(1, countEdges(definition, "AssignedStage", "NewStage", "new"));
  }

  @Test
  void leavesAWorkflowThatAlreadyHasTheTransitionAndEdgeUnchanged() throws IOException {
    ObjectNode definition = readSeed();

    assertFalse(IncidentWorkflowTransitionMigration.addMissingAssignedToNewPieces(definition));

    assertEquals(1, countTransitions(definition, "AssignedStage", "new"));
    assertEquals(1, countEdges(definition, "AssignedStage", "NewStage", "new"));
  }

  private static ObjectNode seedWithoutAssignedToNew() throws IOException {
    ObjectNode definition = readSeed();
    JsonNode assignedNode = nodeNamed(definition, "AssignedStage");
    ArrayNode transitions = (ArrayNode) assignedNode.path("config").path("transitionMetadata");
    for (int index = transitions.size() - 1; index >= 0; index--) {
      if ("new".equals(transitions.get(index).path("id").asText())) {
        transitions.remove(index);
      }
    }
    ArrayNode edges = (ArrayNode) definition.path("edges");
    for (int index = edges.size() - 1; index >= 0; index--) {
      JsonNode edge = edges.get(index);
      if ("AssignedStage".equals(edge.path("from").asText())
          && "new".equals(edge.path("condition").asText())) {
        edges.remove(index);
      }
    }
    return definition;
  }

  private static JsonNode nodeNamed(ObjectNode definition, String name) {
    for (JsonNode node : definition.path("nodes")) {
      if (name.equals(node.path("name").asText())) {
        return node;
      }
    }
    throw new IllegalStateException("Seed workflow has no node " + name);
  }

  private static int countTransitions(ObjectNode definition, String stageName, String id) {
    int count = 0;
    for (JsonNode transition :
        nodeNamed(definition, stageName).path("config").path("transitionMetadata")) {
      if (id.equals(transition.path("id").asText())) {
        count++;
      }
    }
    return count;
  }

  private static int countEdges(ObjectNode definition, String from, String to, String condition) {
    int count = 0;
    for (JsonNode edge : definition.path("edges")) {
      if (from.equals(edge.path("from").asText())
          && to.equals(edge.path("to").asText())
          && condition.equals(edge.path("condition").asText())) {
        count++;
      }
    }
    return count;
  }

  private static ObjectNode readSeed() throws IOException {
    try (InputStream stream =
        Thread.currentThread().getContextClassLoader().getResourceAsStream(SEED_PATH)) {
      assertTrue(stream != null, "seed resource must exist: " + SEED_PATH);
      String json = new String(stream.readAllBytes(), StandardCharsets.UTF_8);
      return (ObjectNode) JsonUtils.readTree(json);
    }
  }
}
