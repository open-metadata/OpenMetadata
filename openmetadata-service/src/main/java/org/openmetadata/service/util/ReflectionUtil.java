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

package org.openmetadata.service.util;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.lang.annotation.Annotation;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.function.UnaryOperator;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.service.exception.ReflectionException;

@Slf4j
public class ReflectionUtil {
  // Distinguishes a positional key from a name, so the two can never collide.
  private static final String POSITION_KEY_PREFIX = "#";
  private static final Pattern NOT_LETTER_OR_DIGIT = Pattern.compile("[^a-z0-9]");
  private static final Pattern DIGITS_ONLY = Pattern.compile("[0-9]*");

  private ReflectionUtil() {
    /* Hidden construction */
  }

  public static List<Method> getMethodsAnnotatedWith(
      final Class<?> clazz, final Class<? extends Annotation> annotation) {
    final List<Method> methods = new ArrayList<>();
    for (final Method method : clazz.getDeclaredMethods()) {
      if (method.isAnnotationPresent(annotation)) {
        methods.add(method);
      }
    }
    return methods;
  }

  public static Class<?> createConnectionConfigClass(String connectionType, ServiceType serviceType)
      throws ClassNotFoundException {
    String clazzName =
        "org.openmetadata.schema.services.connections."
            + serviceType.value().toLowerCase(Locale.ROOT)
            + "."
            + connectionType
            + "Connection";
    return Class.forName(clazzName);
  }

  public static void setValueInMethod(Object toEncryptObject, String fieldValue, Method toSet) {
    try {
      toSet.invoke(toEncryptObject, fieldValue);
    } catch (IllegalAccessException | InvocationTargetException e) {
      throw new ReflectionException(e.getMessage());
    }
  }

  public static Method getToSetMethod(Object toEncryptObject, Object obj, String fieldName) {
    try {
      return toEncryptObject.getClass().getMethod("set" + fieldName, obj.getClass());
    } catch (NoSuchMethodException e) {
      throw new ReflectionException(e.getMessage());
    }
  }

  public static Object getObjectFromMethod(Method method, Object toEncryptObject) {
    Object obj;
    try {
      obj = method.invoke(toEncryptObject);
    } catch (IllegalAccessException | InvocationTargetException e) {
      throw new ReflectionException(e.getMessage());
    }
    return obj;
  }

  public static boolean isGetMethodOfObject(Method method) {
    return method.getName().startsWith("get")
        && !method.getReturnType().equals(Void.TYPE)
        && !method.getReturnType().isPrimitive();
  }

  /**
   * Identifies each element of a collection, to restore a masked secret onto the element it was
   * stored for.
   *
   * <p>Position is not a stable identity. Secrets are stored against the original configuration and
   * restored onto the updated one, so keying by index would restore a secret onto whichever element
   * later occupies that slot - deleting the first of two MCP servers would hand its API key to the
   * second.
   *
   * <p>A name is only an identity if it is unique. {@code mcpServerConfig} requires a name but does
   * not constrain it to be unique, and two elements sharing a key would overwrite one another in the
   * password map. Names are therefore used only where they occur once in the collection; duplicates
   * and unnamed elements fall back to position, which is the best available answer for elements
   * that are genuinely indistinguishable. A name starting with {@code #} gets one more {@code #}, so
   * it never equals a position key.
   */
  public static List<String> getCollectionElementIdentities(Collection<?> collection) {
    return elementKeys(collection, Function.identity(), ReflectionUtil::escapePositionPrefix);
  }

  /**
   * Names each element of a collection inside its secret id in a secrets manager.
   *
   * <p>Every secrets manager lowercases a secret id and drops or replaces its other characters, so
   * {@code Prod} and {@code prod} would share one stored secret. A name is therefore used only where
   * it is still unique when lowercased and reduced to letters and digits, and has a letter: a name like
   * {@code #1} or {@code 3} could match a position key once cleaned. Any other element is named by
   * position. Restoring a masked secret does not use these keys - see {@link
   * #getCollectionElementIdentities}.
   */
  public static List<String> getCollectionElementKeys(Collection<?> collection) {
    return elementKeys(
        collection,
        ReflectionUtil::secretIdForm,
        name -> DIGITS_ONLY.matcher(secretIdForm(name)).matches() ? null : name);
  }

  /**
   * Keys each element by its name where {@code form} of the name occurs once and {@code key} gives
   * one, and by position otherwise.
   */
  private static List<String> elementKeys(
      Collection<?> collection, Function<String, String> form, UnaryOperator<String> key) {
    List<String> names = collection.stream().map(ReflectionUtil::readName).toList();
    Map<String, Integer> occurrences = new HashMap<>();
    names.stream()
        .filter(Objects::nonNull)
        .forEach(name -> occurrences.merge(form.apply(name), 1, Integer::sum));
    List<String> keys = new ArrayList<>(names.size());
    for (int index = 0; index < names.size(); index++) {
      String name = names.get(index);
      String nameKey =
          name != null && occurrences.get(form.apply(name)) == 1 ? key.apply(name) : null;
      keys.add(nameKey != null ? nameKey : POSITION_KEY_PREFIX + index);
    }
    return keys;
  }

  private static String escapePositionPrefix(String name) {
    return name.startsWith(POSITION_KEY_PREFIX) ? POSITION_KEY_PREFIX + name : name;
  }

  /** A name as any secrets manager could clean it into a secret id: lowercase letters and digits. */
  private static String secretIdForm(String name) {
    return NOT_LETTER_OR_DIGIT.matcher(name.toLowerCase(Locale.ROOT)).replaceAll("");
  }

  /** The name an element reports, or null when it has none - see {@link #getCollectionElementKeys}. */
  private static String readName(Object element) {
    try {
      Method getName = element.getClass().getMethod("getName");
      if (String.class.equals(getName.getReturnType())) {
        String name = (String) getName.invoke(element);
        return nullOrEmpty(name) ? null : name;
      }
    } catch (NoSuchMethodException e) {
      LOG.debug("{} exposes no getName(); keying by position", element.getClass().getName());
    } catch (IllegalAccessException | InvocationTargetException e) {
      LOG.debug("Could not read getName() from {}", element.getClass().getName(), e);
    }
    return null;
  }

  /**
   * Creates a class instance from a fully qualified class name
   */
  public static Class<?> createClass(String className) throws ClassNotFoundException {
    try {
      return Class.forName(className);
    } catch (ClassNotFoundException ex) {
      // Try with context class loader if direct class loading fails
      ClassLoader contextClassLoader = Thread.currentThread().getContextClassLoader();
      if (contextClassLoader != null) {
        return Class.forName(className, true, contextClassLoader);
      }
      throw ex;
    }
  }
}
