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
  @ValueSource(strings = {"GlossaryTermCreated", "CheckIfGlossaryTermIsNew", "node_1", "1node"})
  void acceptsLegitimateNodeReferences(String reference) {
    assertTrue(WorkflowExpressionValidator.isSafeNodeReference(reference));
  }

  @ParameterizedTest
  @ValueSource(
      strings = {"a' b", "foo.bar", "node-1", "has space", "${x}", "a\\b", "a(b)", "a=b", "\"a\""})
  void rejectsNodeReferencesWithDisallowedCharacters(String reference) {
    assertFalse(WorkflowExpressionValidator.isSafeNodeReference(reference));
  }

  @Test
  void rejectsNullNodeReference() {
    assertFalse(WorkflowExpressionValidator.isSafeNodeReference(null));
  }

  // Node references may legally start with a digit (the wider entityName contract they predate),
  // which is exactly what distinguishes them from lone expression variables.
  @ParameterizedTest
  @ValueSource(strings = {"123", "1node"})
  void acceptsNodeReferencesWithLeadingDigits(String reference) {
    assertTrue(WorkflowExpressionValidator.isSafeNodeReference(reference));
  }

  @ParameterizedTest
  @ValueSource(strings = {"accessExpirationDate", "accessDuration", "node_1", "result", "_hidden"})
  void acceptsBareProcessVariableNames(String variableName) {
    assertTrue(WorkflowExpressionValidator.isSafeExpressionVariable(variableName));
  }

  @ParameterizedTest
  @ValueSource(strings = {"a' b", "a\\b", "${x}", "T(java.lang.Runtime)", "a b", "a-1", "a.1", ""})
  void rejectsNonReferenceValuesInsideExpressions(String variableName) {
    assertFalse(WorkflowExpressionValidator.isSafeExpressionVariable(variableName));
  }

  // A lone non-reference value interpolates into ${<variable>} as a number literal instead of a
  // process-variable lookup (a leading digit makes JUEL read the token as a number).
  @ParameterizedTest
  @ValueSource(strings = {"123", "123abc", "1abc", "0", "1_2"})
  void rejectsExpressionVariablesJuelReadsAsNonReferences(String variableName) {
    assertFalse(WorkflowExpressionValidator.isSafeExpressionVariable(variableName));
  }

  // Reserved tokens evaluate as literals or operators, never as a process-variable lookup.
  @ParameterizedTest
  @ValueSource(
      strings = {
        "true",
        "false",
        "null",
        "empty",
        "and",
        "or",
        "not",
        "div",
        "mod",
        "instanceof",
        "eq",
        "ne",
        "lt",
        "le",
        "gt",
        "ge"
      })
  void rejectsReservedWords(String variableName) {
    assertFalse(WorkflowExpressionValidator.isSafeExpressionVariable(variableName));
  }

  // Reserved words are matched exactly: a longer identifier that merely starts with one is a legal
  // variable reference.
  @ParameterizedTest
  @ValueSource(strings = {"notEmpty", "anderson", "dividend", "modus", "truthy", "equality"})
  void acceptsIdentifiersThatContainReservedWords(String variableName) {
    assertTrue(WorkflowExpressionValidator.isSafeExpressionVariable(variableName));
  }

  @Test
  void rejectsNullExpressionVariable() {
    assertFalse(WorkflowExpressionValidator.isSafeExpressionVariable(null));
  }
}
