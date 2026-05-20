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

import org.springframework.expression.Expression;
import org.springframework.expression.spel.standard.SpelExpressionParser;

/**
 * Evaluates Data Insight chart formulas as numeric arithmetic.
 *
 * <p>Callers must gate the input with {@link #NUMERIC_VALIDATION_REGEX} (digits, decimal,
 * {@code + - * /}, parens, space) before calling {@link #evaluate(String)}. The regex is
 * the security boundary; this util bypasses {@code ExpressionValidator} on purpose
 * because that validator's allowlist does not include arithmetic operators.
 */
public final class DataInsightFormulaEvaluator {

  public static final String NUMERIC_VALIDATION_REGEX = "[\\d\\.+-\\/\\*\\(\\) ]+";

  private static final SpelExpressionParser PARSER = new SpelExpressionParser();

  private DataInsightFormulaEvaluator() {}

  /**
   * Evaluate a DI chart formula previously gated by {@link #NUMERIC_VALIDATION_REGEX}.
   * Returns {@code null}, NaN, or Infinity for ill-formed numeric inputs; callers coerce
   * these to {@code 0.0}.
   */
  public static Double evaluate(String regexGatedFormula) {
    Expression expression = PARSER.parseExpression(regexGatedFormula);
    return (Double) expression.getValue();
  }
}
