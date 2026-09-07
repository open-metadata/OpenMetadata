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

package org.openmetadata.service.governance.workflows;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class WorkflowExpressionValidatorTest {

  @ParameterizedTest
  @ValueSource(strings = {"approve", "reject", "true", "false", "ack", "assign", "resolve", "new"})
  void acceptsLegitimateConditions(String condition) {
    assertTrue(WorkflowExpressionValidator.isSafeCondition(condition));
  }

  @Test
  void acceptsDottedAndHyphenatedConditionValues() {
    assertTrue(WorkflowExpressionValidator.isSafeCondition("Tier.Gold"));
    assertTrue(WorkflowExpressionValidator.isSafeCondition("start-progress"));
  }

  @ParameterizedTest
  @ValueSource(strings = {"a' b", "x'=='x", "${x}", "a\\b", "\"quoted\"", "a(b)", "a=b"})
  void rejectsConditionsWithDisallowedCharacters(String condition) {
    assertFalse(WorkflowExpressionValidator.isSafeCondition(condition));
  }

  @ParameterizedTest
  @ValueSource(strings = {" ", "   ", "...", "-.-"})
  void rejectsConditionsWithoutAlphanumeric(String condition) {
    assertFalse(WorkflowExpressionValidator.isSafeCondition(condition));
  }

  @Test
  void rejectsNullCondition() {
    assertFalse(WorkflowExpressionValidator.isSafeCondition(null));
  }

  @ParameterizedTest
  @ValueSource(strings = {"GlossaryTermCreated", "CheckIfGlossaryTermIsNew", "node_1"})
  void acceptsLegitimateNodeReferences(String reference) {
    assertTrue(WorkflowExpressionValidator.isSafeNodeReference(reference));
  }

  @ParameterizedTest
  @ValueSource(strings = {"a' b", "foo.bar", "node-1", "has space", "${x}"})
  void rejectsNodeReferencesWithDisallowedCharacters(String reference) {
    assertFalse(WorkflowExpressionValidator.isSafeNodeReference(reference));
  }

  @Test
  void rejectsNullNodeReference() {
    assertFalse(WorkflowExpressionValidator.isSafeNodeReference(null));
  }
}
