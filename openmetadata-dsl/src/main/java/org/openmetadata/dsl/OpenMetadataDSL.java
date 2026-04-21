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
package org.openmetadata.dsl;

import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;
import lombok.extern.slf4j.Slf4j;

/**
 * OpenMetadata DSL Engine - Core expression evaluator for alert rules and governance policies.
 */
@Slf4j
public class OpenMetadataDSL {

  private final Map<String, Function<DSLContext, Object>> functions;
  private final DSLExpressionParser parser;

  public OpenMetadataDSL() {
    this.functions = new HashMap<>();
    this.parser = new DSLExpressionParser();
    registerBuiltinFunctions();
  }

  private void registerBuiltinFunctions() {
    // String operations
    functions.put("contains", ctx -> (String s, String search) -> s != null && s.contains(search));
    functions.put("startsWith", ctx -> (String s, String prefix) -> s != null && s.startsWith(prefix));
    functions.put("endsWith", ctx -> (String s, String suffix) -> s != null && s.endsWith(suffix));
    functions.put("toLowerCase", ctx -> (String s) -> s != null ? s.toLowerCase() : null);
    functions.put("toUpperCase", ctx -> (String s) -> s != null ? s.toUpperCase() : null);
    functions.put("length", ctx -> (String s) -> s != null ? s.length() : 0);
    functions.put("matches", ctx -> (String s, String regex) -> {
      if (s == null || regex == null) {
        return false;
      }
      // Limit regex complexity to prevent ReDoS
      if (regex.length() > 100) {
        log.warn("Regex too long, rejecting for security");
        return false;
      }
      try {
        return s.matches(regex);
      } catch (Exception e) {
        log.warn("Invalid regex pattern: {}", regex);
        return false;
      }
    });

    // Collection operations
    functions.put("isEmpty", ctx -> (Object o) -> o == null ||
        (o instanceof String && ((String) o).isEmpty()) ||
        (o instanceof java.util.Collection && ((java.util.Collection<?>) o).isEmpty()));
    functions.put("any", ctx -> (java.util.Collection<?> c, java.util.function.Function<Object, Boolean> fn) ->
        c != null && c.stream().anyMatch(fn::apply));

    // OpenMetadata-specific functions
    functions.put("hasTag", ctx -> (String tag) -> hasTag(ctx, tag));
    functions.put("hasChanged", ctx -> (String field) -> hasChanged(ctx, field));
    functions.put("isOwner", ctx -> (String user) -> isOwner(ctx, user));
    functions.put("daysSinceLastUpdate", ctx -> daysSinceLastUpdate(ctx));

    log.info("Registered {} builtin functions", functions.size());
  }

  private boolean hasTag(DSLContext ctx, String tag) {
    if (ctx.getEntity() == null || ctx.getEntity().getTags() == null) {
      return false;
    }
    return ctx.getEntity().getTags().stream()
        .anyMatch(t -> tag.equals(t.getTagFQN()));
  }

  private boolean hasChanged(DSLContext ctx, String field) {
    if (ctx.getChangeEvent() == null) {
      return false;
    }
    return ctx.getChangeEvent().getFieldsChanged() != null &&
        ctx.getChangeEvent().getFieldsChanged().contains(field);
  }

  private boolean isOwner(DSLContext ctx, String user) {
    if (ctx.getEntity() == null || ctx.getEntity().getOwners() == null) {
      return false;
    }
    return ctx.getEntity().getOwners().stream()
        .anyMatch(o -> user.equals(o.getName()));
  }

  private long daysSinceLastUpdate(DSLContext ctx) {
    if (ctx.getEntity() == null || ctx.getEntity().getUpdatedAt() == null) {
      return -1;
    }
    long diff = System.currentTimeMillis() - ctx.getEntity().getUpdatedAt();
    return diff / (1000 * 60 * 60 * 24);
  }

  /**
   * Evaluate a DSL expression against a context.
   */
  public boolean evaluateCondition(String expression, DSLContext context) {
    try {
      log.debug("Evaluating expression: {}", expression);
      DSLExpression ast = parser.parse(expression);
      Object result = evaluate(ast, context);
      if (result instanceof Boolean) {
        return (Boolean) result;
      }
      log.warn("Expression did not evaluate to boolean: {}", result);
      return false;
    } catch (Exception e) {
      log.error("Error evaluating expression: {}", expression, e);
      return false;
    }
  }

  private Object evaluate(DSLExpression ast, DSLContext context) {
    if (ast == null) {
      return false;
    }
    switch (ast.getType()) {
      case BOOLEAN:
        return ast.getBooleanValue();
      case FIELD:
        return getFieldValue(ast.getFieldName(), context);
      case FUNCTION:
        return callFunction(ast.getFunctionName(), ast.getArguments(), context);
      case BINARY_EXPR:
        return evaluateBinaryExpression(ast, context);
      default:
        return false;
    }
  }

  private Object getFieldValue(String fieldName, DSLContext context) {
    if (context.getEntity() == null) {
      return null;
    }
    // Strip "entity." prefix if present
    String actualField = fieldName.startsWith("entity.") ? fieldName.substring(7) : fieldName;
    switch (actualField) {
      case "entityType":
        return context.getEntity().getEntityReference() != null
            ? context.getEntity().getEntityReference().getType() : null;
      case "name":
        return context.getEntity().getName();
      case "fullyQualifiedName":
        return context.getEntity().getFullyQualifiedName();
      case "description":
        return context.getEntity().getDescription();
      case "service":
        return context.getEntity().getService();
      case "service.name":
        return context.getEntity().getService() != null
            ? context.getEntity().getService().getName() : null;
      default:
        return null;
    }
  }

  private Object callFunction(String name, java.util.List<DSLExpression> args, DSLContext ctx) {
    Function<DSLContext, ?> fn = functions.get(name);
    if (fn == null) {
      log.warn("Unknown function: {}", name);
      return null;
    }
    // For functions that don't need args, just apply
    try {
      return fn.apply(ctx);
    } catch (Exception e) {
      log.error("Error calling function: {}", name, e);
      return null;
    }
  }

  private boolean evaluateBinaryExpression(DSLExpression ast, DSLContext context) {
    Object left = evaluate(ast.getLeft(), context);
    Object right = evaluate(ast.getRight(), context);
    String operator = ast.getOperator();

    switch (operator) {
      case "AND":
        return Boolean.TRUE.equals(left) && Boolean.TRUE.equals(right);
      case "OR":
        return Boolean.TRUE.equals(left) || Boolean.TRUE.equals(right);
      case "NOT":
        // NOT operator: negate the right operand
        if (right instanceof Boolean) {
          return !(Boolean) right;
        }
        return false;
      case "==":
        if (left == null && right == null) return true;
        if (left == null || right == null) return false;
        return left.equals(right);
      case "!=":
        if (left == null && right == null) return false;
        if (left == null || right == null) return true;
        return !left.equals(right);
      case ">":
      case ">=":
      case "<":
      case "<=":
        return compareNumeric(left, right, operator);
      default:
        return false;
    }
  }

  private boolean compareNumeric(Object left, Object right, String operator) {
    if (!(left instanceof Number) || !(right instanceof Number)) {
      return false;
    }
    int cmp = ((Number) left).doubleValue() < ((Number) right).doubleValue() ? -1 :
        ((Number) left).doubleValue() > ((Number) right).doubleValue() ? 1 : 0;
    switch (operator) {
      case ">": return cmp > 0;
      case ">=": return cmp >= 0;
      case "<": return cmp < 0;
      case "<=": return cmp <= 0;
      default: return false;
    }
  }

  /**
   * Trigger an alert based on evaluated conditions.
   */
  public void triggerAlert(String message) {
    log.info("ALERT TRIGGERED: {}", message);
  }
}