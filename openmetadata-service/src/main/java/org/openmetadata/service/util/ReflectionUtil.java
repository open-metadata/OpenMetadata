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
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.codec.digest.DigestUtils;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.service.exception.ReflectionException;

@Slf4j
public class ReflectionUtil {
  // Distinguishes a positional key from a name, so the two can never collide.
  private static final String POSITION_KEY_PREFIX = "#";
  private static final Pattern NOT_LETTER_OR_DIGIT = Pattern.compile("[^a-z0-9]");
  private static final Pattern DIGITS_ONLY = Pattern.compile("[0-9]*");
  private static final String HASHED_NAME_PREFIX = "h";
  private static final int HASHED_NAME_LENGTH = 16;
  private static final Pattern HASHED_NAME = Pattern.compile("h[0-9a-f]{16}");

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
  public static List<String> getCollectionElementIdentities(final Collection<?> collection) {
    final List<String> names = readNames(collection);
    final Map<String, Integer> occurrences = countBy(names, Function.identity());
    final List<String> identities = new ArrayList<>(names.size());
    for (int index = 0; index < names.size(); index++) {
      final String name = names.get(index);
      identities.add(
          isUnique(name, name, occurrences)
              ? escapePositionPrefix(name)
              : POSITION_KEY_PREFIX + index);
    }
    return List.copyOf(identities);
  }

  /**
   * Names each element of a collection inside its secret id in a secrets manager.
   *
   * <p>A secret id must not move when the collection is reordered or edited: a new value is written
   * to the id computed for the element, so an id taken from position would overwrite the secret
   * another element still references once the two swap places. Every element with a unique name
   * therefore gets an id from that name.
   *
   * <p>Every secrets manager lowercases a secret id and drops or replaces its other characters, so
   * {@code Prod} and {@code prod} would share one stored secret. A name is used as it is only where
   * it is still unique when lowercased and reduced to letters and digits, has a letter, and does not
   * look like a hashed name: a name like {@code #1} or {@code 3} could match a position key once
   * cleaned, and one like {@code h4e07408562bedb8b} another element's hashed name. Any other unique name is
   * named by a hash of its exact text, which stays distinct and stable. Only unnamed elements and
   * exact duplicates, which nothing tells apart, are named by position. Restoring a masked secret
   * does not use these keys - see {@link #getCollectionElementIdentities}.
   */
  public static List<String> getCollectionElementKeys(final Collection<?> collection) {
    final List<String> names = readNames(collection);
    final Map<String, Integer> exact = countBy(names, Function.identity());
    final Map<String, Integer> cleaned = countBy(names, ReflectionUtil::secretIdForm);
    final List<String> keys = new ArrayList<>(names.size());
    for (int index = 0; index < names.size(); index++) {
      keys.add(secretKey(names.get(index), index, exact, cleaned));
    }
    return List.copyOf(keys);
  }

  private static String secretKey(
      final String name,
      final int index,
      final Map<String, Integer> exact,
      final Map<String, Integer> cleaned) {
    final boolean named = isUnique(name, name, exact);
    final boolean readable =
        named && isUnique(name, secretIdForm(name), cleaned) && !looksGenerated(secretIdForm(name));
    String key = POSITION_KEY_PREFIX + index;
    if (readable) {
      key = name;
    } else if (named) {
      key = HASHED_NAME_PREFIX + DigestUtils.sha256Hex(name).substring(0, HASHED_NAME_LENGTH);
    }
    return key;
  }

  /** A cleaned name that could equal a position key or a hashed name of another element. */
  private static boolean looksGenerated(final String form) {
    return DIGITS_ONLY.matcher(form).matches() || HASHED_NAME.matcher(form).matches();
  }

  private static boolean isUnique(
      final String name, final String form, final Map<String, Integer> occurrences) {
    return name != null && occurrences.get(form) == 1;
  }

  private static List<String> readNames(final Collection<?> collection) {
    return collection.stream().map(ReflectionUtil::readName).toList();
  }

  private static Map<String, Integer> countBy(
      final List<String> names, final Function<String, String> form) {
    final Map<String, Integer> occurrences = new HashMap<>();
    names.stream()
        .filter(Objects::nonNull)
        .forEach(name -> occurrences.merge(form.apply(name), 1, Integer::sum));
    return occurrences;
  }

  private static String escapePositionPrefix(final String name) {
    return name.startsWith(POSITION_KEY_PREFIX) ? POSITION_KEY_PREFIX + name : name;
  }

  /** A name as any secrets manager could clean it into a secret id: lowercase letters and digits. */
  private static String secretIdForm(final String name) {
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
