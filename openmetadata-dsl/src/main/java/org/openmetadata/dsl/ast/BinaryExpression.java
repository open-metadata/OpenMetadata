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

package org.openmetadata.dsl.ast;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.openmetadata.dsl.evaluation.EvaluationContext;
import org.openmetadata.dsl.exceptions.EvaluationException;

@RequiredArgsConstructor
@Getter
public class BinaryExpression extends Expression {

  private final Expression left;
  private final BinaryOperator operator;
  private final Expression right;

  @Override
  public Object evaluate(EvaluationContext context) {
    Object leftValue = left.evaluate(context);
    Object rightValue = right.evaluate(context);

    return operator.apply(leftValue, rightValue);
  }

  @Override
  public ExpressionType getType() {
    return ExpressionType.BINARY;
  }

  public enum BinaryOperator {
    EQUALS {
      @Override
      public Object apply(Object left, Object right) {
        if (left == null && right == null) return true;
        if (left == null || right == null) return false;
        return left.equals(right);
      }
    },

    NOT_EQUALS {
      @Override
      public Object apply(Object left, Object right) {
        return !(Boolean) EQUALS.apply(left, right);
      }
    },

    GREATER_THAN {
      @Override
      public Object apply(Object left, Object right) {
        return compareNumbers(left, right) > 0;
      }
    },

    GREATER_THAN_OR_EQUAL {
      @Override
      public Object apply(Object left, Object right) {
        return compareNumbers(left, right) >= 0;
      }
    },

    LESS_THAN {
      @Override
      public Object apply(Object left, Object right) {
        return compareNumbers(left, right) < 0;
      }
    },

    LESS_THAN_OR_EQUAL {
      @Override
      public Object apply(Object left, Object right) {
        return compareNumbers(left, right) <= 0;
      }
    },

    AND {
      @Override
      public Object apply(Object left, Object right) {
        return toBoolean(left) && toBoolean(right);
      }
    },

    OR {
      @Override
      public Object apply(Object left, Object right) {
        return toBoolean(left) || toBoolean(right);
      }
    },

    PLUS {
      @Override
      public Object apply(Object left, Object right) {
        if (left instanceof String || right instanceof String) {
          return String.valueOf(left) + String.valueOf(right);
        }
        return toDouble(left) + toDouble(right);
      }
    },

    MINUS {
      @Override
      public Object apply(Object left, Object right) {
        return toDouble(left) - toDouble(right);
      }
    },

    MULTIPLY {
      @Override
      public Object apply(Object left, Object right) {
        return toDouble(left) * toDouble(right);
      }
    },

    DIVIDE {
      @Override
      public Object apply(Object left, Object right) {
        double rightValue = toDouble(right);
        if (rightValue == 0.0) {
          throw new EvaluationException("Division by zero");
        }
        return toDouble(left) / rightValue;
      }
    };

    public abstract Object apply(Object left, Object right);

    protected double toDouble(Object value) {
      if (value instanceof Number n) {
        return (n).doubleValue();
      }
      if (value instanceof String s) {
        try {
          return Double.parseDouble(s);
        } catch (NumberFormatException e) {
          throw new EvaluationException("Cannot convert '" + value + "' to number");
        }
      }
      throw new EvaluationException(
          "Cannot convert " + value.getClass().getSimpleName() + " to number");
    }

    protected boolean toBoolean(Object value) {
      if (value instanceof Boolean b) {
        return b;
      }
      if (value == null) {
        return false;
      }
      if (value instanceof Number n) {
        return (n).doubleValue() != 0.0;
      }
      if (value instanceof String s) {
        return !(s).isEmpty();
      }
      return true;
    }

    protected int compareNumbers(Object left, Object right) {
      double leftValue = toDouble(left);
      double rightValue = toDouble(right);
      return Double.compare(leftValue, rightValue);
    }
  }
}
