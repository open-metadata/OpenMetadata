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
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.ReflectionException;
import org.openmetadata.service.util.ReflectionUtil;

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
          .ifPresent(value -> setConvertedValue(target, getter, value));
    } catch (ReflectiveOperationException e) {
      throw conversionFailure(property, target, e);
    }
  }

  protected static Object convertChildren(Object target) {
    if (target == null) {
      return null;
    }
    for (Method getter : target.getClass().getMethods()) {
      if (isConvertibleGetter(getter)) {
        convertChild(target, getter);
      }
    }
    return target;
  }

  private static boolean isConvertibleGetter(Method getter) {
    return ReflectionUtil.isGetMethodOfObject(getter)
        && getter.getParameterCount() == 0
        && !"getClass".equals(getter.getName());
  }

  private static void convertChild(Object target, Method getter) {
    if (!hasSetter(target, getter)) {
      return;
    }
    Object value = ReflectionUtil.getObjectFromMethod(getter, target);
    if (Boolean.TRUE.equals(CommonUtil.isOpenMetadataObject(value))) {
      Object converted = ClassConverterFactory.getConverter(value.getClass()).convert(value);
      setConvertedValue(target, getter, converted);
    } else if (value instanceof List<?> list) {
      convertListChildren(target, getter, list);
    }
  }

  private static boolean hasSetter(Object target, Method getter) {
    String setterName = getter.getName().replaceFirst("get", "set");
    try {
      target.getClass().getMethod(setterName, getter.getReturnType());
      return true;
    } catch (NoSuchMethodException e) {
      return false;
    }
  }

  private static void convertListChildren(Object target, Method getter, List<?> values) {
    List<Object> converted = new ArrayList<>(values.size());
    boolean hasOpenMetadataChild = false;
    for (Object value : values) {
      boolean isOpenMetadataChild = Boolean.TRUE.equals(CommonUtil.isOpenMetadataObject(value));
      converted.add(
          isOpenMetadataChild
              ? ClassConverterFactory.getConverter(value.getClass()).convert(value)
              : value);
      hasOpenMetadataChild |= isOpenMetadataChild;
    }
    if (hasOpenMetadataChild) {
      setConvertedValue(target, getter, converted);
    }
  }

  static void setConvertedValue(Object target, Method getter, Object value) {
    String setterName = getter.getName().replaceFirst("get", "set");
    try {
      target.getClass().getMethod(setterName, getter.getReturnType()).invoke(target, value);
    } catch (ReflectiveOperationException e) {
      throw conversionFailure(getter.getName(), target, e);
    }
  }

  private static ReflectionException conversionFailure(
      String property, Object target, ReflectiveOperationException cause) {
    return new ReflectionException(
        String.format(
            "Failed to convert property [%s] on [%s]: %s",
            property, target.getClass().getSimpleName(), cause.getMessage()),
        cause);
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
