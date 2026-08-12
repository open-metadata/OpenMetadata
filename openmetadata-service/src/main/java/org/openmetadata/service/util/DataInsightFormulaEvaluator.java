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

import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.jdbi3.DataInsightSystemChartRepository;
import org.springframework.expression.Expression;
import org.springframework.expression.spel.standard.SpelExpressionParser;

/**
 * Validates and evaluates Data Insight chart formulas as numeric arithmetic.
 *
 * <p>A DI formula is arithmetic over aggregation-function placeholders (count/sum/...). The
 * security boundary is {@link #NUMERIC_VALIDATION_REGEX}, not the SpEL node allowlist, so this
 * util bypasses {@code ExpressionValidator} on purpose — that validator forbids the arithmetic
 * DI formulas need. {@link #isValidFormula} and {@link #evaluate} share the regex so they can't
 * diverge.
 */
@Slf4j
public final class DataInsightFormulaEvaluator {

  public static final String NUMERIC_VALIDATION_REGEX = "[\\d\\.+-\\/\\*\\(\\) ]+";

  private static final SpelExpressionParser PARSER = new SpelExpressionParser();
  private static final Pattern FORMULA_FUNCTION_PATTERN =
      Pattern.compile(DataInsightSystemChartRepository.FORMULA_FUNC_REGEX);
  private static final String FORMULA_FUNCTION_PLACEHOLDER = "1.0";

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

  /**
   * Validate a raw DI chart formula: each aggregation call is replaced with a number, and the
   * remainder must match {@link #NUMERIC_VALIDATION_REGEX} and parse cleanly. Any non-aggregation
   * token (unknown function, policy {@code @Function}, SpEL type reference) fails the numeric gate.
   */
  public static boolean isValidFormula(String formula) {
    boolean valid = false;
    if (formula != null && !formula.isBlank()) {
      String arithmetic = replaceFunctionsWithPlaceholder(formula);
      valid = arithmetic.matches(NUMERIC_VALIDATION_REGEX) && parsesCleanly(arithmetic);
    }
    return valid;
  }

  private static String replaceFunctionsWithPlaceholder(String formula) {
    Matcher matcher = FORMULA_FUNCTION_PATTERN.matcher(formula);
    String result = formula;
    while (matcher.find()) {
      result = result.replace(matcher.group(), FORMULA_FUNCTION_PLACEHOLDER);
    }
    return result;
  }

  private static boolean parsesCleanly(String numericExpression) {
    boolean parses;
    try {
      PARSER.parseExpression(numericExpression).getValue();
      parses = true;
    } catch (RuntimeException e) {
      LOG.debug("Rejected Data Insight formula '{}': {}", numericExpression, e.getMessage());
      parses = false;
    }
    return parses;
  }
}
