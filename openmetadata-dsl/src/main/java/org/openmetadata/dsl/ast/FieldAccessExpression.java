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

import java.util.List;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.openmetadata.dsl.evaluation.EvaluationContext;

@RequiredArgsConstructor
@Getter
public class FieldAccessExpression extends Expression {

  private final List<String> fieldPath;

  public FieldAccessExpression(String... fieldPath) {
    this.fieldPath = List.of(fieldPath);
  }

  @Override
  public Object evaluate(EvaluationContext context) {
    return context.getFieldValue(fieldPath);
  }

  @Override
  public ExpressionType getType() {
    return ExpressionType.FIELD_ACCESS;
  }

  public String getFieldPathAsString() {
    return String.join(".", fieldPath);
  }
}
