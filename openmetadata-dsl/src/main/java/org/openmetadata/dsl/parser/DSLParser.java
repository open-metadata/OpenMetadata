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

package org.openmetadata.dsl.parser;

import java.util.ArrayList;
import java.util.List;
import org.antlr.v4.runtime.*;
import org.antlr.v4.runtime.tree.*;
import org.openmetadata.dsl.ast.*;
import org.openmetadata.dsl.exceptions.ParseException;
import org.openmetadata.dsl.grammar.OpenMetadataDSLLexer;
import org.openmetadata.dsl.grammar.OpenMetadataDSLParser;

public class DSLParser {

  public Expression parse(String expressionText) {
    try {
      CharStream input = CharStreams.fromString(expressionText);
      OpenMetadataDSLLexer lexer = new OpenMetadataDSLLexer(input);
      CommonTokenStream tokens = new CommonTokenStream(lexer);
      OpenMetadataDSLParser parser = new OpenMetadataDSLParser(tokens);

      parser.removeErrorListeners();
      parser.addErrorListener(new ThrowingErrorListener());

      ParseTree tree = parser.expression();

      return new ExpressionVisitor().visit(tree);
    } catch (Exception e) {
      throw new ParseException("Failed to parse expression: " + expressionText, e);
    }
  }

  private static class ExpressionVisitor
      extends org.openmetadata.dsl.grammar.OpenMetadataDSLBaseVisitor<Expression> {

    @Override
    public Expression visitExpression(OpenMetadataDSLParser.ExpressionContext ctx) {
      if (ctx.assignmentExpression() != null) {
        return visit(ctx.assignmentExpression());
      }
      if (ctx.conditionalExpression() != null) {
        return visit(ctx.conditionalExpression());
      }
      return visit(ctx.logicalOrExpression());
    }

    @Override
    public Expression visitLogicalOrExpression(
        OpenMetadataDSLParser.LogicalOrExpressionContext ctx) {
      Expression left = visit(ctx.logicalAndExpression(0));

      for (int i = 1; i < ctx.logicalAndExpression().size(); i++) {
        Expression right = visit(ctx.logicalAndExpression(i));
        left = new BinaryExpression(left, BinaryExpression.BinaryOperator.OR, right);
      }

      return left;
    }

    @Override
    public Expression visitLogicalAndExpression(
        OpenMetadataDSLParser.LogicalAndExpressionContext ctx) {
      Expression left = visit(ctx.equalityExpression(0));

      for (int i = 1; i < ctx.equalityExpression().size(); i++) {
        Expression right = visit(ctx.equalityExpression(i));
        left = new BinaryExpression(left, BinaryExpression.BinaryOperator.AND, right);
      }

      return left;
    }

    @Override
    public Expression visitEqualityExpression(OpenMetadataDSLParser.EqualityExpressionContext ctx) {
      Expression left = visit(ctx.comparisonExpression(0));

      for (int i = 1; i < ctx.comparisonExpression().size(); i++) {
        String operator = ctx.getChild(2 * i - 1).getText();
        Expression right = visit(ctx.comparisonExpression(i));

        BinaryExpression.BinaryOperator op =
            operator.equals("==")
                ? BinaryExpression.BinaryOperator.EQUALS
                : BinaryExpression.BinaryOperator.NOT_EQUALS;

        left = new BinaryExpression(left, op, right);
      }

      return left;
    }

    @Override
    public Expression visitComparisonExpression(
        OpenMetadataDSLParser.ComparisonExpressionContext ctx) {
      if (ctx.additiveExpression().size() == 1) {
        return visit(ctx.additiveExpression(0));
      }

      Expression left = visit(ctx.additiveExpression(0));
      String operator = ctx.getChild(1).getText();
      Expression right = visit(ctx.additiveExpression(1));

      BinaryExpression.BinaryOperator op;
      switch (operator) {
        case ">":
          op = BinaryExpression.BinaryOperator.GREATER_THAN;
          break;
        case ">=":
          op = BinaryExpression.BinaryOperator.GREATER_THAN_OR_EQUAL;
          break;
        case "<":
          op = BinaryExpression.BinaryOperator.LESS_THAN;
          break;
        case "<=":
          op = BinaryExpression.BinaryOperator.LESS_THAN_OR_EQUAL;
          break;
        default:
          throw new ParseException("Unknown comparison operator: " + operator);
      }

      return new BinaryExpression(left, op, right);
    }

    @Override
    public Expression visitAdditiveExpression(OpenMetadataDSLParser.AdditiveExpressionContext ctx) {
      Expression left = visit(ctx.multiplicativeExpression(0));

      for (int i = 1; i < ctx.multiplicativeExpression().size(); i++) {
        String operator = ctx.getChild(2 * i - 1).getText();
        Expression right = visit(ctx.multiplicativeExpression(i));

        BinaryExpression.BinaryOperator op =
            operator.equals("+")
                ? BinaryExpression.BinaryOperator.PLUS
                : BinaryExpression.BinaryOperator.MINUS;

        left = new BinaryExpression(left, op, right);
      }

      return left;
    }

    @Override
    public Expression visitMultiplicativeExpression(
        OpenMetadataDSLParser.MultiplicativeExpressionContext ctx) {
      Expression left = visit(ctx.unaryExpression(0));

      for (int i = 1; i < ctx.unaryExpression().size(); i++) {
        String operator = ctx.getChild(2 * i - 1).getText();
        Expression right = visit(ctx.unaryExpression(i));

        BinaryExpression.BinaryOperator op =
            operator.equals("*")
                ? BinaryExpression.BinaryOperator.MULTIPLY
                : BinaryExpression.BinaryOperator.DIVIDE;

        left = new BinaryExpression(left, op, right);
      }

      return left;
    }

    @Override
    public Expression visitUnaryExpression(OpenMetadataDSLParser.UnaryExpressionContext ctx) {
      return visit(ctx.primaryExpression());
    }

    @Override
    public Expression visitPrimaryExpression(OpenMetadataDSLParser.PrimaryExpressionContext ctx) {
      if (ctx.fieldAccess() != null) {
        return visit(ctx.fieldAccess());
      }
      if (ctx.functionCall() != null) {
        return visit(ctx.functionCall());
      }
      if (ctx.literal() != null) {
        return visit(ctx.literal());
      }
      if (ctx.expression() != null) {
        return visit(ctx.expression());
      }
      throw new ParseException("Unknown primary expression type");
    }

    @Override
    public Expression visitFieldAccess(OpenMetadataDSLParser.FieldAccessContext ctx) {
      List<String> fieldPath = new ArrayList<>();
      fieldPath.add(ctx.IDENTIFIER(0).getText());

      for (int i = 1; i < ctx.IDENTIFIER().size(); i++) {
        fieldPath.add(ctx.IDENTIFIER(i).getText());
      }

      return new FieldAccessExpression(fieldPath);
    }

    @Override
    public Expression visitFunctionCall(OpenMetadataDSLParser.FunctionCallContext ctx) {
      String functionName = ctx.IDENTIFIER().getText();
      List<Expression> arguments = new ArrayList<>();

      if (ctx.expressionList() != null) {
        for (var exprCtx : ctx.expressionList().expression()) {
          arguments.add(visit(exprCtx));
        }
      }

      return new FunctionCallExpression(functionName, arguments);
    }

    @Override
    public Expression visitLiteral(OpenMetadataDSLParser.LiteralContext ctx) {
      if (ctx.STRING_LITERAL() != null) {
        String text = ctx.STRING_LITERAL().getText();
        String unquoted = text.substring(1, text.length() - 1);
        return LiteralExpression.string(unquoted);
      }

      if (ctx.NUMBER_LITERAL() != null) {
        String text = ctx.NUMBER_LITERAL().getText();
        return LiteralExpression.number(Double.parseDouble(text));
      }

      if (ctx.BOOLEAN_LITERAL() != null) {
        return LiteralExpression.bool(Boolean.parseBoolean(ctx.BOOLEAN_LITERAL().getText()));
      }

      if (ctx.NULL_LITERAL() != null) {
        return LiteralExpression.nullValue();
      }

      throw new ParseException("Unknown literal type");
    }
  }

  private static class ThrowingErrorListener extends BaseErrorListener {
    @Override
    public void syntaxError(
        Recognizer<?, ?> recognizer,
        Object offendingSymbol,
        int line,
        int charPositionInLine,
        String msg,
        RecognitionException e) {
      throw new ParseException(
          "Syntax error at line " + line + ":" + charPositionInLine + " - " + msg);
    }
  }
}
