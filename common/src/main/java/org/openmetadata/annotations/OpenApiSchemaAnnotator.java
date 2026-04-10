/*
 *  Copyright 2022 Collate
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

package org.openmetadata.annotations;

import com.fasterxml.jackson.databind.JsonNode;
import com.sun.codemodel.JAnnotationArrayMember;
import com.sun.codemodel.JAnnotationUse;
import com.sun.codemodel.JDefinedClass;
import com.sun.codemodel.JFieldVar;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import java.util.Map;
import org.jsonschema2pojo.AbstractAnnotator;

/**
 * Adds OpenAPI-specific schema hints to generated models when JSON Schema needs extra guidance.
 */
public class OpenApiSchemaAnnotator extends AbstractAnnotator {
  private static final String OPENAPI_ANY_OF_KEY = "x-openmetadata-openapi-anyOf";
  private static final String OPENAPI_NULLABLE_KEY = "x-openmetadata-openapi-nullable";

  @Override
  public void propertyField(
      JFieldVar field, JDefinedClass clazz, String propertyName, JsonNode propertyNode) {
    super.propertyField(field, clazz, propertyName, propertyNode);

    if (propertyNode == null || !propertyNode.has(OPENAPI_ANY_OF_KEY)) {
      return;
    }

    JAnnotationUse schema = field.annotate(Schema.class);
    JAnnotationArrayMember anyOf = schema.paramArray("anyOf");
    for (JsonNode typeNode : propertyNode.get(OPENAPI_ANY_OF_KEY)) {
      anyOf.param(resolveSchemaType(typeNode.asText()));
    }

    if (propertyNode.path(OPENAPI_NULLABLE_KEY).asBoolean(false)) {
      schema.param("nullable", true);
    }
  }

  private Class<?> resolveSchemaType(String typeName) {
    return switch (typeName) {
      case "string" -> String.class;
      case "boolean" -> Boolean.class;
      case "number" -> Number.class;
      case "object" -> Map.class;
      case "array" -> List.class;
      default -> throw new IllegalArgumentException("Unsupported OpenAPI anyOf type: " + typeName);
    };
  }
}
