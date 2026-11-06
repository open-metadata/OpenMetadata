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

package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class DataInsightFormulaEvaluatorTest {

  @Test
  void arithmeticOverAggregationsIsValid() {
    assertTrue(
        DataInsightFormulaEvaluator.isValidFormula(
            "(count(q='entityType: \"table\" and hasDescription: 1')/count())*100"),
        "The documented percentage formula with '/' and '*' must be valid");
    assertTrue(
        DataInsightFormulaEvaluator.isValidFormula(
            "sum(k='size',q='entityType: \"table\"') / count()"),
        "Arithmetic composing different aggregations, with key and query args, must be valid");
  }

  @Test
  void malformedFormulasAreInvalid() {
    assertFalse(
        DataInsightFormulaEvaluator.isValidFormula("(count() / count()"),
        "Unbalanced parentheses must fail the parse");
    assertFalse(DataInsightFormulaEvaluator.isValidFormula(""), "Empty formula must be invalid");
    assertFalse(DataInsightFormulaEvaluator.isValidFormula(null), "Null formula must be invalid");
  }

  @Test
  void nonAggregationConstructsAreRejected() {
    assertFalse(
        DataInsightFormulaEvaluator.isValidFormula("isOwner() * 100"),
        "A policy @Function is not an aggregation and must fail the numeric gate");
    assertFalse(
        DataInsightFormulaEvaluator.isValidFormula("T(java.lang.Runtime).getRuntime() / count()"),
        "A SpEL type reference must never pass the DI numeric gate");
  }
}
