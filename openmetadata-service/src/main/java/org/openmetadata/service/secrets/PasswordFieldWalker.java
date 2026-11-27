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

package org.openmetadata.service.secrets;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import org.openmetadata.annotations.PasswordField;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.service.util.ReflectionUtil;

/**
 * Visits every {@code @PasswordField} string of an object, reaching the same fields as the encrypt
 * walk in {@link SecretsManager}, and tells the visitor where each one sits.
 */
final class PasswordFieldWalker {

  @FunctionalInterface
  interface Visitor {
    /** Returns the value the field holds afterwards; returning the same value leaves it as is. */
    String visit(List<String> fieldPath, String value);
  }

  private PasswordFieldWalker() {}

  static void walk(Object value, List<String> path, Visitor visitor) {
    if (!SecretsManager.DO_NOT_ENCRYPT_CLASSES.contains(value.getClass())) {
      Arrays.stream(value.getClass().getMethods())
          .filter(ReflectionUtil::isGetMethodOfObject)
          .forEach(getter -> visitGetter(value, getter, path, visitor));
    }
  }

  private static void visitGetter(
      Object holder, Method getter, List<String> path, Visitor visitor) {
    Object field = ReflectionUtil.getObjectFromMethod(getter, holder);
    String fieldName = getter.getName().replaceFirst("get", "");
    List<String> fieldPath = append(path, fieldName.toLowerCase(Locale.ROOT));
    if (Boolean.TRUE.equals(CommonUtil.isOpenMetadataObject(field))) {
      walk(field, fieldPath, visitor);
    } else if (field != null && getter.getAnnotation(PasswordField.class) != null) {
      visitPasswordField(holder, fieldName, fieldPath, (String) field, visitor);
    } else {
      SecretsManager.forEachTraversableElement(
          field, (element, elementKey) -> walk(element, append(fieldPath, elementKey), visitor));
    }
  }

  private static void visitPasswordField(
      Object holder, String fieldName, List<String> fieldPath, String value, Visitor visitor) {
    String updated = visitor.visit(fieldPath, value);
    if (!Objects.equals(updated, value)) {
      ReflectionUtil.setValueInMethod(
          holder, updated, ReflectionUtil.getToSetMethod(holder, value, fieldName));
    }
  }

  private static List<String> append(List<String> path, String segment) {
    List<String> appended = new ArrayList<>(path);
    appended.add(segment);
    return List.copyOf(appended);
  }
}
