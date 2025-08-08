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

import org.openmetadata.dsl.evaluation.EvaluationContext;

public abstract class Expression {

  public abstract Object evaluate(EvaluationContext context);

  public abstract ExpressionType getType();

  public boolean evaluateAsBoolean(EvaluationContext context) {
    Object result = evaluate(context);
    if (result instanceof Boolean b) {
      return b;
    }
    if (result == null) {
      return false;
    }
    if (result instanceof Number n) {
      return (n).doubleValue() != 0.0;
    }
    if (result instanceof String s) {
      return !(s).isEmpty();
    }
    return true;
  }

  public enum ExpressionType {
    BINARY,
    UNARY,
    FIELD_ACCESS,
    FUNCTION_CALL,
    LITERAL,
    CONDITIONAL,
    ASSIGNMENT
  }
}
