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
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.lang.reflect.Field;
import java.lang.reflect.ParameterizedType;
import java.lang.reflect.Type;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Optional;
import java.util.Set;
import org.openmetadata.annotations.MaskedField;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

/**
 * What a change event is stored as. The entity it carries leaves out every field its schema marks
 * {@code "mask": true}, such as bot tokens, password hashes and connection secrets, whichever code
 * made the event and whether it holds the entity as an object or as a string of JSON. Every alert,
 * the audit log and {@code GET /v1/events} read the stored event
 * (ADR:2026-10-26-masked-fields-stay-out-of-change-events-and-version-history).
 */
public final class ChangeEventMasking {

  private static final JsonFactory JSON_FACTORY = new JsonFactory();
  private static final String ENTITY = "entity";
  private static final String ENTITY_TYPE = "entityType";
  private static final String SCHEMA_PACKAGE = "org.openmetadata.schema.";
  // One entry per entity class, so the cap is never reached; it is there to bound the cache.
  private static final Cache<Class<?>, Boolean> HAS_MASKED_FIELDS =
      Caffeine.newBuilder().maximumSize(1_000).build();

  private ChangeEventMasking() {}

  public static String masked(final String changeEventJson) {
    return entityTypeOf(changeEventJson)
        .map(Entity::getEntityClassFromType)
        .filter(ChangeEventMasking::hasMaskedFields)
        .map(entityClass -> withMaskedEntity(changeEventJson, entityClass))
        .orElse(changeEventJson);
  }

  private static String withMaskedEntity(final String changeEventJson, final Class<?> entityClass) {
    final ObjectNode event = (ObjectNode) JsonUtils.readTree(changeEventJson);
    final JsonNode entity = event.path(ENTITY);
    final boolean isPresent = !entity.isMissingNode() && !entity.isNull();
    if (isPresent) {
      final Object typed =
          entity.isTextual()
              ? JsonUtils.readValueLenient(entity.asText(), entityClass)
              : JsonUtils.convertValueLenient(entity, entityClass);
      event.put(ENTITY, JsonUtils.pojoToMaskedJson(typed));
    }
    return isPresent ? JsonUtils.pojoToJson(event) : changeEventJson;
  }

  // entityType comes early in a stored event, so this reads a few tokens, not the whole event.
  static Optional<String> entityTypeOf(final String changeEventJson) {
    try (JsonParser parser = JSON_FACTORY.createParser(changeEventJson)) {
      String entityType = null;
      final boolean isInObject = parser.nextToken() == JsonToken.START_OBJECT;
      while (isInObject && entityType == null && parser.nextToken() == JsonToken.FIELD_NAME) {
        final String field = parser.currentName();
        parser.nextToken();
        entityType = ENTITY_TYPE.equals(field) ? parser.getValueAsString() : null;
        parser.skipChildren();
      }
      return Optional.ofNullable(entityType);
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
  }

  static boolean hasMaskedFields(final Class<?> entityClass) {
    return HAS_MASKED_FIELDS.get(entityClass, type -> declaresMaskedField(type, new HashSet<>()));
  }

  private static boolean declaresMaskedField(final Class<?> type, final Set<Class<?>> seen) {
    final boolean isSchemaType = type.getName().startsWith(SCHEMA_PACKAGE) && !type.isEnum();
    return isSchemaType
        && seen.add(type)
        && Arrays.stream(type.getDeclaredFields())
            .anyMatch(
                field ->
                    field.isAnnotationPresent(MaskedField.class)
                        || declaresMaskedField(valueType(field), seen));
  }

  // A list's elements, or the field's own type.
  private static Class<?> valueType(final Field field) {
    final Type generic = field.getGenericType();
    final boolean isListOfClass =
        generic instanceof ParameterizedType parameterized
            && parameterized.getActualTypeArguments().length == 1
            && parameterized.getActualTypeArguments()[0] instanceof Class<?>;
    return isListOfClass
        ? (Class<?>) ((ParameterizedType) generic).getActualTypeArguments()[0]
        : field.getType();
  }
}
