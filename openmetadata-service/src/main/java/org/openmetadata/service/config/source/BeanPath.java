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

package org.openmetadata.service.config.source;

import com.fasterxml.jackson.databind.BeanDescription;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.introspect.AnnotatedMember;
import com.fasterxml.jackson.databind.introspect.BeanPropertyDefinition;
import java.util.Optional;
import java.util.regex.Pattern;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Reads and writes generated schema objects by JSON pointer, through their Jackson properties, so
 * that a pointer means the same field on the object as in its JSON form.
 */
final class BeanPath {
  private static final ObjectMapper MAPPER = JsonUtils.getObjectMapper();
  private static final Pattern SEPARATOR = Pattern.compile("/");

  private BeanPath() {}

  static String lastSegment(String pointer) {
    return pointer.substring(pointer.lastIndexOf('/') + 1);
  }

  /** The object that holds the field at {@code pointer}, when every object on the way is set. */
  static Optional<Object> parentOf(Object root, String pointer) {
    String[] segments = SEPARATOR.split(pointer.substring(1));
    Object current = root;
    for (int index = 0; index < segments.length - 1 && current != null; index++) {
      current = get(current, segments[index]);
    }
    return Optional.ofNullable(current);
  }

  static Object get(Object bean, String property) {
    return propertyOf(bean, property)
        .map(BeanPropertyDefinition::getGetter)
        .map(getter -> getter.getValue(bean))
        .orElse(null);
  }

  static void set(Object bean, String property, Object value) {
    propertyOf(bean, property)
        .map(BeanPropertyDefinition::getSetter)
        .ifPresent(setter -> setValue(setter, bean, value));
  }

  private static void setValue(AnnotatedMember setter, Object bean, Object value) {
    setter.setValue(bean, value);
  }

  private static Optional<BeanPropertyDefinition> propertyOf(Object bean, String property) {
    BeanDescription description =
        MAPPER.getDeserializationConfig().introspect(MAPPER.constructType(bean.getClass()));
    return description.findProperties().stream()
        .filter(definition -> definition.getName().equals(property))
        .findFirst();
  }
}
