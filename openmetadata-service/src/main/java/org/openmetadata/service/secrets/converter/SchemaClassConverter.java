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

package org.openmetadata.service.secrets.converter;

import java.lang.reflect.Method;
import java.util.Map;
import org.openmetadata.service.exception.ReflectionException;

final class SchemaClassConverter {
  private static final JsonSchemaRepository SCHEMAS = JsonSchemaRepository.getInstance();

  private SchemaClassConverter() {}

  static Object convert(Object target) {
    if (target == null) {
      return null;
    }
    JsonSchemaRepository.Ref schema = SCHEMAS.schemaFor(target.getClass());
    if (schema != null) {
      schema
          .node()
          .path("properties")
          .properties()
          .forEach(property -> convertProperty(target, schema, property.getKey()));
    }
    return ClassConverter.convertChildren(target);
  }

  static Object convertProperty(Class<?> ownerClass, String propertyName, Object value) {
    JsonSchemaRepository.Ref schema = SCHEMAS.schemaFor(ownerClass);
    JsonSchemaRepository.Ref property =
        schema == null ? null : SCHEMAS.property(schema, propertyName);
    JsonSchemaRepository.Ref oneOf = property == null ? null : SCHEMAS.resolveToOneOf(property);
    if (oneOf == null || isEmptyMap(value)) {
      return value;
    }
    RuntimeException failure = null;
    for (JsonSchemaRepository.Ref branch : SCHEMAS.branches(oneOf)) {
      Class<?> candidate = SCHEMAS.javaClass(branch);
      if (candidate != null && SCHEMAS.matchesDiscriminator(branch, value)) {
        try {
          return ClassConverterFactory.getConverter(candidate).convert(value);
        } catch (RuntimeException e) {
          failure = e;
        }
      }
    }
    return failedConversion(ownerClass.getSimpleName(), propertyName, value, oneOf, failure);
  }

  private static void convertProperty(
      Object target, JsonSchemaRepository.Ref schema, String propertyName) {
    Method getter = getter(target, propertyName);
    if (getter == null) {
      return;
    }
    try {
      Object value = getter.invoke(target);
      if (value == null) {
        return;
      }
      JsonSchemaRepository.Ref property = SCHEMAS.property(schema, propertyName);
      JsonSchemaRepository.Ref oneOf = property == null ? null : SCHEMAS.resolveToOneOf(property);
      if (oneOf != null && value instanceof Map<?, ?> && !isEmptyMap(value)) {
        convertOneOf(target, getter, value, oneOf);
      }
    } catch (ReflectiveOperationException e) {
      throw new ReflectionException(
          "Failed to inspect schema property "
              + propertyName
              + " on "
              + target.getClass().getName(),
          e);
    }
  }

  private static void convertOneOf(
      Object target, Method getter, Object value, JsonSchemaRepository.Ref oneOf) {
    RuntimeException failure = null;
    for (JsonSchemaRepository.Ref branch : SCHEMAS.branches(oneOf)) {
      Class<?> candidate = SCHEMAS.javaClass(branch);
      if (candidate != null && SCHEMAS.matchesDiscriminator(branch, value)) {
        try {
          Object converted = ClassConverterFactory.getConverter(candidate).convert(value);
          ClassConverter.setConvertedValue(target, getter, converted);
          return;
        } catch (RuntimeException e) {
          failure = e;
        }
      }
    }
    failedConversion(target.getClass().getSimpleName(), getter.getName(), value, oneOf, failure);
  }

  private static Object failedConversion(
      String owner,
      String property,
      Object value,
      JsonSchemaRepository.Ref oneOf,
      RuntimeException failure) {
    if (SCHEMAS.hasOpenObjectBranch(oneOf)) {
      return value;
    }
    if (SCHEMAS.containsPasswordFormat(oneOf)) {
      if (failure != null) {
        throw failure;
      }
      throw new IllegalArgumentException(
          "Cannot convert secret-bearing oneOf property " + property + " on " + owner);
    }
    return value;
  }

  private static boolean isEmptyMap(Object value) {
    return value instanceof Map<?, ?> map && map.isEmpty();
  }

  private static Method getter(Object target, String propertyName) {
    String suffix = Character.toUpperCase(propertyName.charAt(0)) + propertyName.substring(1);
    try {
      return target.getClass().getMethod("get" + suffix);
    } catch (NoSuchMethodException e) {
      return null;
    }
  }
}
