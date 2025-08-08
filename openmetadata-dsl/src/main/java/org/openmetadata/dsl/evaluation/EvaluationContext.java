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

package org.openmetadata.dsl.evaluation;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.openmetadata.dsl.exceptions.EvaluationException;
import org.openmetadata.dsl.functions.FunctionRegistry;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeEvent;

@RequiredArgsConstructor
@Getter
public class EvaluationContext {

  private final ChangeEvent changeEvent;
  private final EntityInterface entity;
  private final FunctionRegistry functionRegistry;
  private final Map<String, Object> variables = new HashMap<>();
  private final ObjectMapper objectMapper = new ObjectMapper();

  public Object getFieldValue(List<String> fieldPath) {
    if (fieldPath.isEmpty()) {
      throw new EvaluationException("Empty field path");
    }

    String rootField = fieldPath.get(0);
    Object rootObject;

    switch (rootField) {
      case "entity":
        rootObject = entity;
        break;
      case "changeEvent":
        rootObject = changeEvent;
        break;
      default:
        if (variables.containsKey(rootField)) {
          rootObject = variables.get(rootField);
        } else {
          throw new EvaluationException("Unknown field: " + rootField);
        }
    }

    return navigateFieldPath(rootObject, fieldPath.subList(1, fieldPath.size()));
  }

  private Object navigateFieldPath(Object object, List<String> remainingPath) {
    if (remainingPath.isEmpty()) {
      return object;
    }

    if (object == null) {
      return null;
    }

    String fieldName = remainingPath.get(0);
    Object fieldValue = getFieldFromObject(object, fieldName);

    return navigateFieldPath(fieldValue, remainingPath.subList(1, remainingPath.size()));
  }

  private Object getFieldFromObject(Object object, String fieldName) {
    try {
      Class<?> clazz = object.getClass();

      try {
        String getterName =
            "get" + Character.toUpperCase(fieldName.charAt(0)) + fieldName.substring(1);
        var method = clazz.getMethod(getterName);
        return method.invoke(object);
      } catch (NoSuchMethodException e1) {
        try {
          var field = clazz.getDeclaredField(fieldName);
          field.setAccessible(true);
          return field.get(object);
        } catch (NoSuchFieldException e2) {
          try {
            Map<String, Object> objectMap = objectMapper.convertValue(object, Map.class);
            return objectMap.get(fieldName);
          } catch (Exception e3) {
            throw new EvaluationException(
                "Cannot access field '"
                    + fieldName
                    + "' on object of type "
                    + object.getClass().getSimpleName());
          }
        }
      }
    } catch (Exception e) {
      throw new EvaluationException(
          "Cannot access field '"
              + fieldName
              + "' on object of type "
              + object.getClass().getSimpleName(),
          e);
    }
  }

  public Object callFunction(String functionName, Object[] arguments) {
    return functionRegistry.invoke(functionName, arguments, this);
  }

  public void setVariable(String name, Object value) {
    variables.put(name, value);
  }

  public Object getVariable(String name) {
    return variables.get(name);
  }
}
