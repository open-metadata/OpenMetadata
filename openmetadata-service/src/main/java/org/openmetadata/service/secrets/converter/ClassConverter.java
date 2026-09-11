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

package org.openmetadata.service.secrets.converter;

import java.lang.reflect.Method;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.ReflectionException;

/**
 * Currently when an object is converted into a specific class using `JsonUtils.convertValue` there`Object` fields that
 * are not converted into any concrete class which could lead to assign a `LinkedMap` to the `Object` field.
 *
 * <p>This abstract class wrap these `JsonUtils.convertValue` adding transformation to those `Object` fields into
 * specific classes.
 */
public abstract class ClassConverter {

  protected final Class<?> clazz;

  protected ClassConverter(Class<?> clazz) {
    this.clazz = clazz;
  }

  public Object convert(Object object) {
    return JsonUtils.convertValue(object, this.clazz);
  }

  protected Object convert(Object object, Class<?> clazz) {
    try {
      return ClassConverterFactory.getConverter(clazz).convert(object);
    } catch (Exception ignore) {
      // this can be ignored
      return null;
    }
  }

  // method called when we expect only specific class
  protected Optional<Object> tryToConvertOrFail(Object object, List<Class<?>> candidateClasses) {
    if (object != null) {
      Object converted =
          candidateClasses.stream()
              .map(candidateClazz -> convert(object, candidateClazz))
              .filter(Objects::nonNull)
              .findFirst()
              .orElseThrow(
                  () ->
                      new IllegalArgumentException(
                          String.format(
                              "Cannot convert [%s] due to missing converter implementation.",
                              object.getClass().getSimpleName())));
      return Optional.of(
          ClassConverterFactory.getConverter(converted.getClass()).convert(converted));
    }
    return Optional.empty();
  }

  // method called when and Object field can expect a HashMap or a specific class
  /**
   * Reads {@code property} off {@code target}, converts it against {@code candidates} and writes it
   * back.
   *
   * <p>Only for {@code Object}-typed properties, i.e. the ones jsonschema2pojo emits for a JSON
   * Schema {@code oneOf}. Jackson leaves a {@code LinkedHashMap} in such a field, and neither the
   * password masker nor the secrets manager descends into a non-{@code org.openmetadata} value, so
   * every {@code format: password} leaf below it stays in the clear until it is typed again here.
   */
  protected void convertProperty(Object target, String property, List<Class<?>> candidates) {
    String accessorSuffix = Character.toUpperCase(property.charAt(0)) + property.substring(1);
    try {
      Method getter = target.getClass().getMethod("get" + accessorSuffix);
      tryToConvert(getter.invoke(target), candidates)
          .ifPresent(
              value -> {
                try {
                  target
                      .getClass()
                      .getMethod("set" + accessorSuffix, Object.class)
                      .invoke(target, value);
                } catch (ReflectiveOperationException e) {
                  throw new ReflectionException(e.getMessage());
                }
              });
    } catch (ReflectiveOperationException e) {
      throw new ReflectionException(e.getMessage());
    }
  }

  protected Optional<Object> tryToConvert(Object object, List<Class<?>> candidateClasses) {
    if (object != null) {
      Optional<Object> converted =
          candidateClasses.stream()
              .map(candidateClazz -> convert(object, candidateClazz))
              .filter(Objects::nonNull)
              .findFirst();
      if (converted.isPresent()) {
        return Optional.of(
            ClassConverterFactory.getConverter(converted.get().getClass())
                .convert(converted.get()));
      }
    }
    return object == null ? Optional.empty() : Optional.of(object);
  }
}
