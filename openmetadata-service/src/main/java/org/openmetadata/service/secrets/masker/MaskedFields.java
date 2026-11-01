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

package org.openmetadata.service.secrets.masker;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.lang.reflect.Field;
import java.lang.reflect.ParameterizedType;
import java.lang.reflect.Type;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.openmetadata.annotations.MaskedField;

/**
 * Which fields hold secrets, as the schema says with {@code "mask": true} (the generator turns it
 * into {@link MaskedField}). Change events and version history both ask here, so a field marked
 * secret in the schema is kept out of both without a second list to maintain
 * (ADR:2026-10-26-masked-fields-stay-out-of-change-events-and-version-history).
 */
public final class MaskedFields {

  private static final String SCHEMA_PACKAGE = "org.openmetadata.schema.";
  // One entry per class, so the caps are never reached; they are there to bound the caches.
  private static final Cache<Class<?>, Boolean> ANY_MASKED =
      Caffeine.newBuilder().maximumSize(1_000).build();
  private static final Cache<Class<?>, List<String>> WHOLE_MASKED =
      Caffeine.newBuilder().maximumSize(1_000).build();

  private MaskedFields() {}

  /** Whether the class holds a masked field anywhere, in nested objects and lists included. */
  public static boolean anyIn(final Class<?> type) {
    return ANY_MASKED.get(type, t -> declaresMaskedField(t, new HashSet<>()));
  }

  /**
   * The JSON names of the class's own fields that are secret as a whole, such as a user's
   * authentication mechanism. A field that only holds secrets inside it, such as a service
   * connection, is not one of them.
   */
  public static List<String> wholeFieldsOf(final Class<?> type) {
    return WHOLE_MASKED.get(type, MaskedFields::ownMaskedFields);
  }

  private static List<String> ownMaskedFields(final Class<?> type) {
    return Arrays.stream(type.getDeclaredFields())
        .filter(field -> field.isAnnotationPresent(MaskedField.class))
        .map(MaskedFields::jsonName)
        .toList();
  }

  private static String jsonName(final Field field) {
    final JsonProperty property = field.getAnnotation(JsonProperty.class);
    return property == null || property.value().isEmpty() ? field.getName() : property.value();
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
