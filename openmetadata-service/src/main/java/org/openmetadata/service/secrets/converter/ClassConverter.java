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

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import org.openmetadata.service.util.JsonUtils;

/**
 * Currently when an object is converted into a specific class using `JsonUtils.convertValue` there`Object` fields that
 * are not converted into any concrete class which could lead to assign a `LinkedMap` to the `Object` field.
 *
 * <p>This abstract class wrap these `JsonUtils.convertValue` adding transformation to those `Object` fields into
 * specific classes.
 */
public abstract class ClassConverter {

  protected Class<?> clazz;

  public ClassConverter(Class<?> clazz) {
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

  protected Optional<Object> tryToConvertOrFail(Object object, List<Class<?>> candidateClasses) {
    if (object instanceof Map) {
      Object converted =
          candidateClasses.stream()
              .map(clazz -> convert(object, clazz))
              .filter(Objects::nonNull)
              .findFirst()
              .orElseThrow(
                  () ->
                      new IllegalArgumentException(
                          String.format(
                              "Cannot convert [%s] due to missing converter implementation.",
                              object.getClass().getSimpleName())));
      return Optional.of(ClassConverterFactory.getConverter(converted.getClass()).convert(converted));
    }
    return Optional.empty();
  }
}
