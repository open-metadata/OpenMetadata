/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.governance.workflows.elements.EdgeDefinition;
import org.openmetadata.service.exception.BadRequestException;

class WorkflowDefinitionRepositoryEdgeSafetyTest {

  private static EdgeDefinition edge(String from, String to, String condition) {
    return new EdgeDefinition().withFrom(from).withTo(to).withCondition(condition);
  }

  @Test
  void acceptsLegitimateConditionalEdge() {
    assertDoesNotThrow(
        () ->
            WorkflowDefinitionRepository.checkEdgeExpressionSafety(
                "wf", edge("Check", "Ok", "approve")));
  }

  @Test
  void skipsUnconditionalEdgeWithNullCondition() {
    // A null condition is an unconditional edge; the source node keeps the broader entityName
    // charset.
    assertDoesNotThrow(
        () ->
            WorkflowDefinitionRepository.checkEdgeExpressionSafety(
                "wf", edge("My Node-1", "Ok", null)));
  }

  @Test
  void skipsUnconditionalEdgeWithEmptyCondition() {
    // Empty condition is treated the same as null (unconditional) — must not be rejected.
    assertDoesNotThrow(
        () ->
            WorkflowDefinitionRepository.checkEdgeExpressionSafety(
                "wf", edge("My Node-1", "Ok", "")));
  }

  @Test
  void rejectsConditionWithDisallowedCharacters() {
    assertThrows(
        BadRequestException.class,
        () ->
            WorkflowDefinitionRepository.checkEdgeExpressionSafety(
                "wf", edge("Check", "Ok", "a' b")));
  }

  @Test
  void rejectsSourceNodeWithDisallowedCharactersOnConditionalEdge() {
    // The 'from' is only interpolated into the expression when the edge is conditional, so it must
    // be validated whenever a (safe) condition is present.
    assertThrows(
        BadRequestException.class,
        () ->
            WorkflowDefinitionRepository.checkEdgeExpressionSafety(
                "wf", edge("a' b", "Ok", "approve")));
  }
}
