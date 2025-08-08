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

package org.openmetadata.dsl;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.dsl.ast.Expression;
import org.openmetadata.dsl.evaluation.EvaluationContext;
import org.openmetadata.dsl.exceptions.DSLException;
import org.openmetadata.dsl.functions.FunctionRegistry;
import org.openmetadata.dsl.parser.DSLParser;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeEvent;

@Slf4j
public class OpenMetadataDSL {

  private final DSLParser parser;
  private final FunctionRegistry functionRegistry;
  private final ConcurrentMap<String, Expression> compiledExpressions;

  public OpenMetadataDSL() {
    this.parser = new DSLParser();
    this.functionRegistry = new FunctionRegistry();
    this.compiledExpressions = new ConcurrentHashMap<>();
  }

  public Object evaluate(String expression, ChangeEvent changeEvent, EntityInterface entity) {
    try {
      Expression compiledExpression = compile(expression);
      EvaluationContext context = new EvaluationContext(changeEvent, entity, functionRegistry);

      long startTime = System.currentTimeMillis();
      Object result = compiledExpression.evaluate(context);
      long endTime = System.currentTimeMillis();

      if (log.isDebugEnabled()) {
        log.debug(
            "Evaluated expression '{}' in {}ms with result: {}",
            expression,
            endTime - startTime,
            result);
      }

      return result;
    } catch (Exception e) {
      log.error("Failed to evaluate expression: {}", expression, e);
      throw new DSLException("Expression evaluation failed: " + expression, e);
    }
  }

  public boolean evaluateCondition(
      String expression, ChangeEvent changeEvent, EntityInterface entity) {
    Object result = evaluate(expression, changeEvent, entity);

    if (result instanceof Boolean) {
      return (Boolean) result;
    }

    if (result == null) {
      return false;
    }

    if (result instanceof Number) {
      return ((Number) result).doubleValue() != 0.0;
    }

    if (result instanceof String) {
      return !((String) result).isEmpty();
    }

    return true;
  }

  public Expression compile(String expression) {
    return compiledExpressions.computeIfAbsent(
        expression,
        expr -> {
          try {
            long startTime = System.currentTimeMillis();
            Expression compiled = parser.parse(expr);
            long endTime = System.currentTimeMillis();

            if (log.isDebugEnabled()) {
              log.debug("Compiled expression '{}' in {}ms", expr, endTime - startTime);
            }

            return compiled;
          } catch (Exception e) {
            log.error("Failed to compile expression: {}", expr, e);
            throw new DSLException("Expression compilation failed: " + expr, e);
          }
        });
  }

  public void registerFunction(String name, FunctionRegistry.DSLFunction function) {
    functionRegistry.register(name, function);
    log.info("Registered custom function: {}", name);
  }

  public boolean isValidExpression(String expression) {
    try {
      compile(expression);
      return true;
    } catch (Exception e) {
      log.debug("Expression validation failed for '{}': {}", expression, e.getMessage());
      return false;
    }
  }

  public void clearCache() {
    compiledExpressions.clear();
    log.info("Cleared compiled expression cache");
  }

  public int getCacheSize() {
    return compiledExpressions.size();
  }

  public FunctionRegistry getFunctionRegistry() {
    return functionRegistry;
  }
}
