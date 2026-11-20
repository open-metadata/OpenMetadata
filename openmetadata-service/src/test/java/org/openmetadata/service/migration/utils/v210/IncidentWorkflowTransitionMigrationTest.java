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
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.utils.JsonUtils;

class IncidentWorkflowTransitionMigrationTest {

  private static final String SEED_PATH =
      "json/data/governance/workflows/TestCaseResolutionTaskWorkflow.json";

  @Test
  void addsTheMissingNewTransitionAndEdgeToAnUpgradedInstall() throws IOException {
    ObjectNode definition = seedWithoutAssignedToNew();

    assertTrue(IncidentWorkflowTransitionMigration.addMissingAssignedTransitions(definition));

    assertEquals(1, countTransitions(definition, "AssignedStage", "new"));
    assertEquals(1, countEdges(definition, "AssignedStage", "NewStage", "new"));
  }

  @Test
  void addsAcknowledgedToAnInstallThatAlreadySupportsNew() throws IOException {
    ObjectNode definition = readSeed();
    removeAssignedTransition(definition, "ack");

    assertTrue(IncidentWorkflowTransitionMigration.addMissingAssignedTransitions(definition));
    assertEquals(1, countTransitions(definition, "AssignedStage", "ack"));
    assertEquals(1, countEdges(definition, "AssignedStage", "AckStage", "ack"));
    assertFalse(IncidentWorkflowTransitionMigration.addMissingAssignedTransitions(definition));
  }

  @Test
  void leavesAWorkflowThatAlreadyHasTheTransitionAndEdgeUnchanged() throws IOException {
    ObjectNode definition = readSeed();

    assertFalse(IncidentWorkflowTransitionMigration.addMissingAssignedTransitions(definition));

    assertEquals(1, countTransitions(definition, "AssignedStage", "new"));
    assertEquals(1, countEdges(definition, "AssignedStage", "NewStage", "new"));
  }

  @ParameterizedTest
  @ValueSource(strings = {"AssignedStage", "NewStage", "AckStage"})
  void leavesCustomizedStageNamesUnchanged(String stageName) throws IOException {
    ObjectNode definition = seedWithoutAssignedToNew();
    ((ObjectNode) nodeNamed(definition, stageName)).put("name", "CustomStage");
    ObjectNode original = definition.deepCopy();

    assertFalse(IncidentWorkflowTransitionMigration.addMissingAssignedTransitions(definition));
    assertEquals(original, definition);
  }

  @ParameterizedTest
  @ValueSource(strings = {"AssignedStage", "NewStage", "AckStage"})
  void leavesCustomizedStageIdsUnchanged(String stageName) throws IOException {
    ObjectNode definition = seedWithoutAssignedToNew();
    ((ObjectNode) nodeNamed(definition, stageName).path("config")).put("stageId", "custom");
    ObjectNode original = definition.deepCopy();

    assertFalse(IncidentWorkflowTransitionMigration.addMissingAssignedTransitions(definition));
    assertEquals(original, definition);
  }

  @Test
  void leavesAConflictingCustomTransitionUnchanged() throws IOException {
    ObjectNode definition = seedWithoutAssignedToNew();
    ((ArrayNode) nodeNamed(definition, "AssignedStage").path("config").path("transitionMetadata"))
        .addObject()
        .put("id", "new")
        .put("targetStageId", "ack")
        .put("targetTaskStatus", "InProgress");
    ObjectNode original = definition.deepCopy();

    assertFalse(IncidentWorkflowTransitionMigration.addMissingAssignedTransitions(definition));
    assertEquals(original, definition);
  }

  @Test
  void leavesAConflictingCustomEdgeUnchanged() throws IOException {
    ObjectNode definition = seedWithoutAssignedToNew();
    ((ArrayNode) definition.path("edges"))
        .addObject()
        .put("from", "AssignedStage")
        .put("to", "AckStage")
        .put("condition", "new");
    ObjectNode original = definition.deepCopy();

    assertFalse(IncidentWorkflowTransitionMigration.addMissingAssignedTransitions(definition));
    assertEquals(original, definition);
  }

  @Test
  void leavesAConflictingAcknowledgedTransitionUnchanged() throws IOException {
    ObjectNode definition = seedWithoutAssignedToNew();
    removeAssignedTransition(definition, "ack");
    ((ArrayNode) nodeNamed(definition, "AssignedStage").path("config").path("transitionMetadata"))
        .addObject()
        .put("id", "ack")
        .put("targetStageId", "new")
        .put("targetTaskStatus", "Open");
    ObjectNode original = definition.deepCopy();

    assertFalse(IncidentWorkflowTransitionMigration.addMissingAssignedTransitions(definition));
    assertEquals(original, definition);
  }

  @Test
  void leavesAConflictingAcknowledgedEdgeUnchanged() throws IOException {
    ObjectNode definition = seedWithoutAssignedToNew();
    removeAssignedTransition(definition, "ack");
    ((ArrayNode) definition.path("edges"))
        .addObject()
        .put("from", "AssignedStage")
        .put("to", "NewStage")
        .put("condition", "ack");
    ObjectNode original = definition.deepCopy();

    assertFalse(IncidentWorkflowTransitionMigration.addMissingAssignedTransitions(definition));
    assertEquals(original, definition);
  }

  private static ObjectNode seedWithoutAssignedToNew() throws IOException {
    ObjectNode definition = readSeed();
    removeAssignedTransition(definition, "new");
    return definition;
  }

  private static void removeAssignedTransition(ObjectNode definition, String transitionId) {
    JsonNode assignedNode = nodeNamed(definition, "AssignedStage");
    ArrayNode transitions = (ArrayNode) assignedNode.path("config").path("transitionMetadata");
    for (int index = transitions.size() - 1; index >= 0; index--) {
      if (transitionId.equals(transitions.get(index).path("id").asText())) {
        transitions.remove(index);
      }
    }
    ArrayNode edges = (ArrayNode) definition.path("edges");
    for (int index = edges.size() - 1; index >= 0; index--) {
      JsonNode edge = edges.get(index);
      if ("AssignedStage".equals(edge.path("from").asText())
          && transitionId.equals(edge.path("condition").asText())) {
        edges.remove(index);
      }
    }
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
