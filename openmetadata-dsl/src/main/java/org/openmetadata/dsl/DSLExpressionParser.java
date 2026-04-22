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

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Simple DSL expression parser that handles basic expressions.
 */
public class DSLExpressionParser {

  private static final Pattern TOKEN_PATTERN = Pattern.compile(
      "\\s*(\\(|\\)|\\bAND\\b|\\bOR\\b|\\bNOT\\b|==|!=|>=|<=|>|<|" +
          "[a-zA-Z_][a-zA-Z0-9_.]*|" +
          "\"([^\"\\\\]|\\\\.)*\"|" +
          "'([^'\\\\]|\\\\.)*'|" +
          "-?[0-9]+\\.?[0-9]*|" +
          "," +
          ")\\s*");

  public DSLExpression parse(String expression) {
    if (expression == null || expression.trim().isEmpty()) {
      return null;
    }
    List<String> tokens = tokenize(expression.trim());
    return parseExpression(tokens, 0).getKey();
  }

  private List<String> tokenize(String expression) {
    List<String> tokens = new ArrayList<>();
    Matcher matcher = TOKEN_PATTERN.matcher(expression);
    while (matcher.find()) {
      String token = matcher.group(1);
      if (token != null && !token.trim().isEmpty()) {
        tokens.add(token);
      }
    }
    return tokens;
  }

  private Pair<DSLExpression, Integer> parseExpression(List<String> tokens, int pos) {
    return parseOr(tokens, pos);
  }

  private Pair<DSLExpression, Integer> parseOr(List<String> tokens, int pos) {
    var left = parseAnd(tokens, pos);
    pos = left.getValue();

    while (pos < tokens.size() && "OR".equalsIgnoreCase(tokens.get(pos))) {
      var right = parseAnd(tokens, pos + 1);
      pos = right.getValue();
      left = new Pair<>(
          DSLExpression.builder()
              .type(DSLExpression.ExpressionType.BINARY_EXPR)
              .left(left.getKey())
              .right(right.getKey())
              .operator("OR")
              .build(),
          pos);
    }
    return left;
  }

  private Pair<DSLExpression, Integer> parseAnd(List<String> tokens, int pos) {
    var left = parseComparison(tokens, pos);
    pos = left.getValue();

    while (pos < tokens.size() && "AND".equalsIgnoreCase(tokens.get(pos))) {
      var right = parseComparison(tokens, pos + 1);
      pos = right.getValue();
      left = new Pair<>(
          DSLExpression.builder()
              .type(DSLExpression.ExpressionType.BINARY_EXPR)
              .left(left.getKey())
              .right(right.getKey())
              .operator("AND")
              .build(),
          pos);
    }
    return left;
  }

  private Pair<DSLExpression, Integer> parseComparison(List<String> tokens, int pos) {
    var left = parsePrimary(tokens, pos);
    pos = left.getValue();

    if (pos < tokens.size()) {
      String token = tokens.get(pos);
      if (token.equals("==") || token.equals("!=") ||
          token.equals(">") || token.equals(">=") ||
          token.equals("<") || token.equals("<=")) {
        var right = parsePrimary(tokens, pos + 1);
        pos = right.getValue();
        return new Pair<>(
            DSLExpression.builder()
                .type(DSLExpression.ExpressionType.BINARY_EXPR)
                .left(left.getKey())
                .right(right.getKey())
                .operator(token)
                .build(),
            pos);
      }
    }
    return left;
  }

  private Pair<DSLExpression, Integer> parsePrimary(List<String> tokens, int pos) {
    if (pos >= tokens.size()) {
      return new Pair<>(null, pos);
    }
    String token = tokens.get(pos);

    if (token.equals("(")) {
      var expr = parseExpression(tokens, pos + 1);
      if (expr.getValue() < tokens.size() && ")".equals(tokens.get(expr.getValue()))) {
        return new Pair<>(expr.getKey(), expr.getValue() + 1);
      }
      return expr;
    }

    if (token.equalsIgnoreCase("NOT")) {
      var operand = parsePrimary(tokens, pos + 1);
      return new Pair<>(
          DSLExpression.builder()
              .type(DSLExpression.ExpressionType.BINARY_EXPR)
              .left(DSLExpression.builder()
                  .type(DSLExpression.ExpressionType.BOOLEAN)
                  .booleanValue(true)
                  .build())
              .right(operand.getKey())
              .operator("NOT")
              .build(),
          operand.getValue());
    }

    if (token.startsWith("\"") || token.startsWith("'")) {
      return new Pair<>(
          DSLExpression.builder()
              .type(DSLExpression.ExpressionType.STRING)
              .stringValue(token.substring(1, token.length() - 1))
              .build(),
          pos + 1);
    }

    if (token.matches("-?[0-9]+\\.?[0-9]*")) {
      return new Pair<>(
          DSLExpression.builder()
              .type(DSLExpression.ExpressionType.NUMBER)
              .numberValue(token.contains(".") ? Double.parseDouble(token) : Integer.parseInt(token))
              .build(),
          pos + 1);
    }

    if (token.equalsIgnoreCase("true") || token.equalsIgnoreCase("false")) {
      return new Pair<>(
          DSLExpression.builder()
              .type(DSLExpression.ExpressionType.BOOLEAN)
              .booleanValue(Boolean.parseBoolean(token))
              .build(),
          pos + 1);
    }

    // Check if it's a function call
    if (pos + 1 < tokens.size() && tokens.get(pos + 1).equals("(")) {
      return parseFunction(tokens, pos);
    }

    // Field access
    return new Pair<>(
        DSLExpression.builder()
            .type(DSLExpression.ExpressionType.FIELD)
            .fieldName(token)
            .build(),
        pos + 1);
  }

  private Pair<DSLExpression, Integer> parseFunction(List<String> tokens, int pos) {
    String funcName = tokens.get(pos);
    int startPos = pos + 2;
    List<DSLExpression> args = new ArrayList<>();

    int currentPos = startPos;
    while (currentPos < tokens.size() && !")".equals(tokens.get(currentPos))) {
      var arg = parsePrimary(tokens, currentPos);
      args.add(arg.getKey());
      currentPos = arg.getValue();
      if (currentPos < tokens.size() && ",".equals(tokens.get(currentPos))) {
        currentPos++;
      }
    }

    return new Pair<>(
        DSLExpression.builder()
            .type(DSLExpression.ExpressionType.FUNCTION)
            .functionName(funcName)
            .arguments(args)
            .build(),
        currentPos + 1);
  }

  private static class Pair<K, V> {
    private final K key;
    private final V value;

    Pair(K key, V value) {
      this.key = key;
      this.value = value;
    }

    K getKey() {
      return key;
    }

    V getValue() {
      return value;
    }
  }
}