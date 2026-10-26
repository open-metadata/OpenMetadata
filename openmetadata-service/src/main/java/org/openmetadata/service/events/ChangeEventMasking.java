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

package org.openmetadata.service.events;

import com.fasterxml.jackson.core.JsonFactory;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.lang.reflect.Field;
import java.lang.reflect.ParameterizedType;
import java.lang.reflect.Type;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.openmetadata.annotations.MaskedField;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

/**
 * What a change event is stored as. The entity it carries leaves out every field its schema marks
 * {@code "mask": true}, such as bot tokens, password hashes and connection secrets, whichever code
 * made the event and whether it holds the entity as an object or as a string of JSON. Every alert,
 * the audit log and {@code GET /v1/events} read the stored event.
 */
public final class ChangeEventMasking {

  private static final JsonFactory JSON_FACTORY = new JsonFactory();
  private static final String ENTITY = "entity";
  private static final String ENTITY_TYPE = "entityType";
  private static final String SCHEMA_PACKAGE = "org.openmetadata.schema.";
  private static final Map<Class<?>, Boolean> HAS_MASKED_FIELDS = new ConcurrentHashMap<>();

  private ChangeEventMasking() {}

  public static String masked(String changeEventJson) {
    return entityTypeOf(changeEventJson)
        .map(Entity::getEntityClassFromType)
        .filter(ChangeEventMasking::hasMaskedFields)
        .map(entityClass -> withMaskedEntity(changeEventJson, entityClass))
        .orElse(changeEventJson);
  }

  private static String withMaskedEntity(String changeEventJson, Class<?> entityClass) {
    ObjectNode event = (ObjectNode) JsonUtils.readTree(changeEventJson);
    JsonNode entity = event.path(ENTITY);
    boolean present = !entity.isMissingNode() && !entity.isNull();
    if (present) {
      Object typed =
          entity.isTextual()
              ? JsonUtils.readValueLenient(entity.asText(), entityClass)
              : JsonUtils.convertValueLenient(entity, entityClass);
      event.put(ENTITY, JsonUtils.pojoToMaskedJson(typed));
    }
    return present ? JsonUtils.pojoToJson(event) : changeEventJson;
  }

  // entityType comes early in a stored event, so this reads a few tokens, not the whole event.
  static Optional<String> entityTypeOf(String changeEventJson) {
    try (JsonParser parser = JSON_FACTORY.createParser(changeEventJson)) {
      String entityType = null;
      boolean inObject = parser.nextToken() == JsonToken.START_OBJECT;
      while (inObject && entityType == null && parser.nextToken() == JsonToken.FIELD_NAME) {
        String field = parser.currentName();
        parser.nextToken();
        entityType = ENTITY_TYPE.equals(field) ? parser.getValueAsString() : null;
        parser.skipChildren();
      }
      return Optional.ofNullable(entityType);
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
  }

  static boolean hasMaskedFields(Class<?> entityClass) {
    return HAS_MASKED_FIELDS.computeIfAbsent(
        entityClass, type -> declaresMaskedField(type, new HashSet<>()));
  }

  private static boolean declaresMaskedField(Class<?> type, Set<Class<?>> seen) {
    boolean schemaType = type.getName().startsWith(SCHEMA_PACKAGE) && !type.isEnum();
    return schemaType
        && seen.add(type)
        && Arrays.stream(type.getDeclaredFields())
            .anyMatch(
                field ->
                    field.isAnnotationPresent(MaskedField.class)
                        || declaresMaskedField(valueType(field), seen));
  }

  // A list's elements, or the field's own type.
  private static Class<?> valueType(Field field) {
    Type generic = field.getGenericType();
    boolean listOfClass =
        generic instanceof ParameterizedType parameterized
            && parameterized.getActualTypeArguments().length == 1
            && parameterized.getActualTypeArguments()[0] instanceof Class<?>;
    return listOfClass
        ? (Class<?>) ((ParameterizedType) generic).getActualTypeArguments()[0]
        : field.getType();
  }
}
