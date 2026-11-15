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

import static org.openmetadata.service.secrets.converter.SchemaKeywords.ADDITIONAL_PROPERTIES;
import static org.openmetadata.service.secrets.converter.SchemaKeywords.ARRAY;
import static org.openmetadata.service.secrets.converter.SchemaKeywords.CONST;
import static org.openmetadata.service.secrets.converter.SchemaKeywords.ENUM;
import static org.openmetadata.service.secrets.converter.SchemaKeywords.ITEMS;
import static org.openmetadata.service.secrets.converter.SchemaKeywords.OBJECT;
import static org.openmetadata.service.secrets.converter.SchemaKeywords.STRING;
import static org.openmetadata.service.secrets.converter.SchemaKeywords.TYPE;

import com.fasterxml.jackson.databind.JsonNode;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.ServiceConnectionEntityInterface;
import org.openmetadata.schema.entity.automations.TestServiceConnectionRequest;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.secrets.converter.JsonSchemaRepository.Ref;

final class SchemaClassConverter {
  private final JsonSchemaRepository schemas;

  private enum Mode {
    WRITE,
    READ,
    READ_CANDIDATE
  }

  private record Context(
      String path, Mode mode, boolean requireFields, Class<?> expected, Class<?> connectionConfig) {
    boolean read() {
      return mode != Mode.WRITE;
    }

    Context child(String name, Class<?> expected) {
      return new Context(
          path.isEmpty() ? name : path + "." + name, mode, false, expected, connectionConfig);
    }

    Context candidate(Class<?> expected) {
      return new Context(
          path, read() ? Mode.READ_CANDIDATE : Mode.WRITE, true, expected, connectionConfig);
    }
  }

  SchemaClassConverter(JsonSchemaRepository schemas) {
    this.schemas = schemas;
  }

  Object convert(Object value, Class<?> type, boolean read) {
    if (value == null) {
      return null;
    }
    Ref schema = schemas.schemaFor(type);
    if (schema == null) {
      return bind(value, type);
    }
    Context context = new Context("", read ? Mode.READ : Mode.WRITE, false, type, null);
    return readNode(value, schema, context);
  }

  Object convertProperty(Class<?> owner, String name, Object value, boolean read) {
    Ref root = schemas.schemaFor(owner);
    Ref property = root == null ? null : schemas.property(root, name);
    if (value == null || property == null) {
      return value;
    }
    boolean unidentified = owner == SourceConfig.class && unidentifiedPipeline(value, property);
    if (unidentified && ((Map<?, ?>) value).isEmpty()) {
      return value;
    }
    Object converted =
        readNode(
            value, property, new Context(name, read ? Mode.READ : Mode.WRITE, false, null, null));
    return unidentified && !(converted instanceof SchemaBackedMap) ? value : converted;
  }

  private boolean unidentifiedPipeline(Object value, Ref property) {
    if (!(value instanceof Map<?, ?> map) || map.containsKey(TYPE)) {
      return false;
    }
    return map.keySet().stream()
        .noneMatch(key -> schemas.facts(property).passwordChildren().contains(key.toString()));
  }

  private Object readNode(Object value, Ref schema, Context context) {
    if (context.mode() == Mode.READ
        && value != null
        && !(value instanceof Map<?, ?>)
        && !(value instanceof Collection<?>)
        && !value.getClass().isEnum()
        && schemas.schemaFor(value.getClass()) != null) {
      return readTyped(value, schema, context);
    }
    try {
      return selectAndConvert(value, schema, context);
    } catch (SchemaConversionException failure) {
      if (context.mode() == Mode.READ && value instanceof Map<?, ?> map) {
        return new SchemaBackedMap(map, schema, schemas);
      }
      throw failure;
    }
  }

  private Object selectAndConvert(Object value, Ref reference, Context context) {
    if (value == null) {
      return null;
    }
    Ref schema = schemas.dereference(reference);
    if (!schemas.branches(schema).isEmpty()) {
      return selectBranch(value, schema, context);
    }
    validateScalar(value, schema, context);
    if (!schema.node().has(TYPE)
        && schemas.facts(schema).properties().isEmpty()
        && schemas.facts(schema).allOf().isEmpty()) {
      return value;
    }
    if (value instanceof Collection<?> collection) {
      return convertCollection(collection, schema, context);
    }
    if (isObject(value)) {
      return convertObject(value, schema, context);
    }
    return value;
  }

  private Object selectBranch(Object value, Ref schema, Context context) {
    List<Ref> branches = schemas.branches(schema);
    Map<?, ?> map = isObject(value) ? asMap(value) : Map.of();
    List<Ref> closed =
        branches.stream()
            .filter(branch -> !isOpen(branch))
            .filter(branch -> matchesExpected(branch, value, context.expected()))
            .filter(branch -> matchesDiscriminators(branch, map))
            .toList();
    SchemaConversionException failure = null;
    long failureScore = -1;
    for (Ref branch : closed) {
      try {
        return selectAndConvert(value, branch, context.candidate(schemas.javaClass(branch)));
      } catch (SchemaConversionException rejected) {
        long score = declaredFields(branch, map);
        if (score > failureScore) {
          failure = rejected;
          failureScore = score;
        }
      }
    }
    if (branches.stream().anyMatch(this::isOpen) && !claimsClosedSecret(map, branches)) {
      return context.read() && value instanceof Map<?, ?> raw
          ? new SchemaBackedMap(raw, schema, schemas)
          : value;
    }
    throw failure == null ? invalid(context, "does not match a declared schema branch") : failure;
  }

  private boolean matchesExpected(Ref branch, Object value, Class<?> expected) {
    Class<?> candidate = schemas.javaClass(branch);
    return expected != null
        ? candidate == expected
        : !(isObject(value) && !(value instanceof Map<?, ?>)) || candidate == value.getClass();
  }

  private boolean claimsClosedSecret(Map<?, ?> value, List<Ref> branches) {
    return branches.stream()
        .filter(branch -> !isOpen(branch) && schemas.containsPasswordFormat(branch))
        .anyMatch(
            branch ->
                schemas.facts(branch).properties().entrySet().stream()
                    .anyMatch(
                        property ->
                            value.containsKey(property.getKey())
                                && !schemas.facts(property.getValue()).password()));
  }

  private boolean isOpen(Ref branch) {
    return schemas.facts(branch).openObject();
  }

  private boolean matchesDiscriminators(Ref schema, Map<?, ?> value) {
    return schemas.facts(schema).discriminators().entrySet().stream()
        .allMatch(
            property ->
                !value.containsKey(property.getKey())
                    || property
                        .getValue()
                        .equals(JsonUtils.valueToTree(value.get(property.getKey()))));
  }

  private long declaredFields(Ref schema, Map<?, ?> value) {
    return value.keySet().stream()
        .filter(key -> schemas.facts(schema).properties().containsKey(key.toString()))
        .count();
  }

  private Object convertObject(Object value, Ref schema, Context context) {
    Map<String, Object> raw = asMap(value);
    Context selected = contextual(schema, raw, context);
    validateObject(raw, schema, selected);
    Class<?> type = selected.expected() == null ? schemas.javaClass(schema) : selected.expected();
    if (type == null && schemas.containsPasswordFormat(schema) && !isPasswordMap(schema)) {
      throw new SchemaConversionException(
          "Missing generated Java type for schema " + schema.location());
    }
    Object bound = type == null || Map.class.isAssignableFrom(type) ? null : bind(raw, type);
    Map<String, Object> converted = new LinkedHashMap<>();
    for (Map.Entry<String, Object> entry : raw.entrySet()) {
      Ref child = schemas.property(schema, entry.getKey());
      if (child == null) {
        child = schemas.child(schema, ADDITIONAL_PROPERTIES);
      }
      Class<?> expected = expectedChild(schema, entry.getKey(), raw, selected);
      converted.put(
          entry.getKey(),
          child == null || !child.node().isObject()
              ? entry.getValue()
              : readNode(entry.getValue(), child, selected.child(entry.getKey(), expected)));
    }
    return bound == null ? converted : bindObject(converted, bound, schema);
  }

  private boolean isPasswordMap(Ref schema) {
    Ref additional = schemas.child(schema, ADDITIONAL_PROPERTIES);
    return schemas.facts(schema).properties().isEmpty()
        && additional != null
        && additional.node().isObject()
        && schemas.facts(additional).password();
  }

  private void validateObject(Map<String, Object> value, Ref schema, Context context) {
    JsonSchemaRepository.Facts facts = schemas.facts(schema);
    JsonNode additional = schema.node().get(ADDITIONAL_PROPERTIES);
    if (additional == null || additional.isBoolean() && !additional.asBoolean()) {
      for (String name : value.keySet()) {
        if (!facts.properties().containsKey(name)) {
          throw invalid(context.child(name, null), "is an undeclared field");
        }
      }
    }
    if (context.requireFields()) {
      for (String required : facts.required()) {
        if (value.get(required) == null
            && (value.containsKey(required) || !facts.defaulted().contains(required))) {
          throw invalid(context.child(required, null), "is required");
        }
      }
    }
  }

  private Object convertCollection(Collection<?> values, Ref schema, Context context) {
    Ref items = schemas.child(schema, ITEMS);
    if (items == null) {
      return values;
    }
    List<Object> converted = new ArrayList<>(values.size());
    int index = 0;
    for (Object value : values) {
      converted.add(readNode(value, items, context.child("[" + index++ + "]", null)));
    }
    return converted;
  }

  private Context contextual(Ref schema, Map<String, Object> value, Context context) {
    if (schemas.javaClass(schema) != TestServiceConnectionRequest.class) {
      return context;
    }
    Class<?> config = TestServiceConnectionRequestClassConverter.configClass(value);
    return new Context(
        context.path(), context.mode(), context.requireFields(), context.expected(), config);
  }

  private Class<?> expectedChild(
      Ref owner, String name, Map<String, Object> value, Context context) {
    Class<?> type = schemas.javaClass(owner);
    if (type == Workflow.class && name.equals("request")) {
      return WorkflowClassConverter.requestClass(value.get("workflowType"));
    }
    if (context.connectionConfig() != null
        && name.equals("connection")
        && type == TestServiceConnectionRequest.class) {
      return connectionWrapper(owner, context.connectionConfig());
    }
    if (context.connectionConfig() != null
        && name.equals("config")
        && type != null
        && ServiceConnectionEntityInterface.class.isAssignableFrom(type)) {
      return context.connectionConfig();
    }
    return null;
  }

  Class<?> connectionWrapper(Ref request, Class<?> configClass) {
    Ref connection = schemas.property(request, "connection");
    List<Class<?>> wrappers =
        schemas.branches(connection).stream()
            .filter(wrapper -> includesConfig(wrapper, configClass))
            .map(schemas::javaClass)
            .toList();
    if (wrappers.size() != 1 || wrappers.getFirst() == null) {
      throw new SchemaConversionException(
          "Connection config has no unique schema-declared wrapper");
    }
    return wrappers.getFirst();
  }

  private boolean includesConfig(Ref wrapper, Class<?> configClass) {
    Ref config = schemas.property(wrapper, "config");
    return config != null
        && schemas.branches(config).stream()
            .anyMatch(branch -> schemas.javaClass(branch) == configClass);
  }

  private Object readTyped(Object value, Ref reference, Context context) {
    Ref schema = schemas.schemaFor(value.getClass());
    Object copy = bind(value, value.getClass());
    Map<String, Object> raw = asMap(value);
    Context selected = contextual(schema, raw, context);
    for (Map.Entry<String, Ref> property : schemas.facts(schema).properties().entrySet()) {
      Method getter = schemas.getter(schema, property.getKey());
      if (getter != null && hasSetter(copy, getter)) {
        Object child = get(value, getter);
        if (child == null
            || child instanceof Enum<?>
            || !(child instanceof Map<?, ?>)
                && !(child instanceof Collection<?>)
                && schemas.schemaFor(child.getClass()) == null) {
          continue;
        }
        Context childContext =
            selected.child(
                property.getKey(), expectedChild(schema, property.getKey(), raw, selected));
        set(copy, getter, readNode(child, property.getValue(), childContext));
      }
    }
    return copy;
  }

  private Object bindObject(Map<String, Object> converted, Object result, Ref schema) {
    for (Map.Entry<String, Object> property : converted.entrySet()) {
      Method getter = schemas.getter(schema, property.getKey());
      if (getter != null && hasSetter(result, getter)) {
        Object value = property.getValue();
        if (value == null || getter.getReturnType().isInstance(value)) {
          set(result, getter, value);
        }
      }
    }
    return result;
  }

  private void validateScalar(Object value, Ref schema, Context context) {
    JsonNode type = schema.node().get(TYPE);
    if (type != null && !matchesType(type, value)) {
      throw invalid(context, "has an invalid value type");
    }
    JsonNode constant = schema.node().get(CONST);
    JsonNode allowed = schema.node().get(ENUM);
    JsonNode actual = constant == null && allowed == null ? null : JsonUtils.valueToTree(value);
    if (constant != null && !constant.equals(actual)
        || allowed != null && !contains(allowed, actual)) {
      throw invalid(context, "is not an allowed schema value");
    }
  }

  private boolean matchesType(JsonNode types, Object value) {
    if (types.isArray()) {
      for (JsonNode type : types) {
        if (matchesType(type, value)) {
          return true;
        }
      }
      return false;
    }
    return switch (types.asText()) {
      case OBJECT -> isObject(value);
      case ARRAY -> value instanceof Collection<?>;
      case STRING -> value instanceof String || value instanceof Enum<?>;
      case "boolean" -> value instanceof Boolean;
      case "integer", "number" -> value instanceof Number;
      case "null" -> value == null;
      default -> true;
    };
  }

  private static boolean contains(JsonNode values, JsonNode actual) {
    for (JsonNode value : values) {
      if (value.equals(actual)) {
        return true;
      }
    }
    return false;
  }

  private boolean isObject(Object value) {
    return value instanceof Map<?, ?>
        || value != null
            && schemas.schemaFor(value.getClass()) != null
            && !value.getClass().isEnum();
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> asMap(Object value) {
    return value instanceof Map<?, ?>
        ? (Map<String, Object>) value
        : JsonUtils.convertValue(value, Map.class);
  }

  private static Object bind(Object value, Class<?> type) {
    try {
      return JsonUtils.convertValue(value, type);
    } catch (IllegalArgumentException failure) {
      throw new SchemaConversionException(
          JsonUtils.describeBindingFailure(failure)
              .orElse("Value cannot be converted to " + type.getSimpleName()),
          failure);
    }
  }

  private static Object get(Object target, Method getter) {
    try {
      return getter.invoke(target);
    } catch (IllegalAccessException | InvocationTargetException failure) {
      throw new IllegalStateException(
          "Cannot inspect schema property " + getter.getName(), failure);
    }
  }

  private static boolean hasSetter(Object target, Method getter) {
    try {
      target.getClass().getMethod("set" + getter.getName().substring(3), getter.getReturnType());
      return true;
    } catch (NoSuchMethodException failure) {
      return false;
    }
  }

  private static void set(Object target, Method getter, Object value) {
    try {
      target
          .getClass()
          .getMethod("set" + getter.getName().substring(3), getter.getReturnType())
          .invoke(target, value);
    } catch (ReflectiveOperationException | IllegalArgumentException failure) {
      throw new IllegalStateException("Cannot update schema property " + getter.getName(), failure);
    }
  }

  private static SchemaConversionException invalid(Context context, String reason) {
    return new SchemaConversionException("Field '" + context.path() + "' " + reason);
  }
}
