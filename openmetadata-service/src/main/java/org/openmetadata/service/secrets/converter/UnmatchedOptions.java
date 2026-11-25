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

package org.openmetadata.service.secrets.converter;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.lang.reflect.Method;
import java.lang.reflect.ParameterizedType;
import java.lang.reflect.Type;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Deque;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;
import java.util.function.UnaryOperator;
import java.util.stream.Collectors;
import org.openmetadata.annotations.PasswordField;
import org.openmetadata.service.util.ReflectionUtil;

/**
 * What a {@link ClassConverter} does with a non-empty value that matches none of the options of its
 * {@code oneOf} when at least one option can hold a secret. The secret entry points pick a {@link
 * Handler} for the length of one conversion: {@link #refuse()} when saving, {@link
 * #replaceLeaves(UnaryOperator)} when reading. Every other conversion keeps the value as it is.
 */
public final class UnmatchedOptions {

  private static final ThreadLocal<Handler> HANDLER = new ThreadLocal<>();
  private static final Map<Class<?>, Boolean> CAN_HOLD_SECRET = new ConcurrentHashMap<>();
  private static final String OPENMETADATA_PACKAGE = "org.openmetadata";

  private UnmatchedOptions() {}

  @FunctionalInterface
  public interface Handler {
    Object handle(Unmatched unmatched);
  }

  /** A value that matches none of {@code options}; {@code property} is null when it is not known. */
  public record Unmatched(String property, Map<?, ?> value, List<Class<?>> options) {

    /** Names the property, the options and the keys no option declares, never a value. */
    public String describe() {
      String subject = property == null ? "A value" : String.format("The value of [%s]", property);
      String optionNames =
          options.stream().map(Class::getSimpleName).collect(Collectors.joining(", "));
      Set<String> undeclared = undeclaredKeys();
      String reason =
          undeclared.isEmpty()
              ? "its keys and values fit no single option"
              : "no option declares " + undeclared;
      return String.format(
          "%s matches none of its options [%s]: %s.", subject, optionNames, reason);
    }

    private Set<String> undeclaredKeys() {
      Set<String> keys =
          value.keySet().stream()
              .map(String::valueOf)
              .collect(Collectors.toCollection(TreeSet::new));
      options.forEach(option -> keys.removeAll(declaredKeys(option)));
      return keys;
    }
  }

  public static Handler refuse() {
    return unmatched -> {
      throw new IllegalArgumentException(unmatched.describe());
    };
  }

  /** Returns a copy of the value with every scalar leaf, at any depth, replaced by {@code leaf}. */
  public static Handler replaceLeaves(UnaryOperator<Object> leaf) {
    return unmatched -> replaceLeaves(unmatched.value(), leaf);
  }

  public static <T> T during(Handler handler, Supplier<T> conversion) {
    Handler previous = HANDLER.get();
    HANDLER.set(handler);
    try {
      return conversion.get();
    } finally {
      restore(previous);
    }
  }

  public static void runDuring(Handler handler, Runnable conversion) {
    during(
        handler,
        () -> {
          conversion.run();
          return null;
        });
  }

  private static void restore(Handler previous) {
    if (previous == null) {
      HANDLER.remove();
    } else {
      HANDLER.set(previous);
    }
  }

  static Object resolve(String property, Object value, List<Class<?>> options) {
    Handler handler = HANDLER.get();
    return handler != null && isSecretBearing(value, options)
        ? handler.handle(new Unmatched(property, (Map<?, ?>) value, options))
        : value;
  }

  private static boolean isSecretBearing(Object value, List<Class<?>> options) {
    return value instanceof Map<?, ?> map
        && !map.isEmpty()
        && options.stream().anyMatch(UnmatchedOptions::canHoldSecret);
  }

  private static Object replaceLeaves(Object value, UnaryOperator<Object> leaf) {
    return switch (value) {
      case null -> null;
      case Map<?, ?> map -> replaceMapLeaves(map, leaf);
      case Collection<?> collection -> replaceCollectionLeaves(collection, leaf);
      default -> leaf.apply(value);
    };
  }

  private static Map<Object, Object> replaceMapLeaves(Map<?, ?> map, UnaryOperator<Object> leaf) {
    Map<Object, Object> copy = new LinkedHashMap<>();
    map.forEach((key, entry) -> copy.put(key, replaceLeaves(entry, leaf)));
    return copy;
  }

  private static List<Object> replaceCollectionLeaves(
      Collection<?> collection, UnaryOperator<Object> leaf) {
    List<Object> copy = new ArrayList<>();
    collection.forEach(element -> copy.add(replaceLeaves(element, leaf)));
    return copy;
  }

  private static Set<String> declaredKeys(Class<?> option) {
    return Arrays.stream(option.getDeclaredFields())
        .map(field -> field.getAnnotation(JsonProperty.class))
        .filter(Objects::nonNull)
        .map(JsonProperty::value)
        .collect(Collectors.toSet());
  }

  private static boolean canHoldSecret(Class<?> option) {
    return CAN_HOLD_SECRET.computeIfAbsent(option, UnmatchedOptions::scanForSecret);
  }

  /** Walks the getters of {@code root} and of every generated type reachable from them. */
  private static boolean scanForSecret(Class<?> root) {
    Deque<Class<?>> pending = new ArrayDeque<>(List.of(root));
    Set<Class<?>> visited = new HashSet<>();
    boolean found = false;
    while (!found && !pending.isEmpty()) {
      Class<?> type = pending.poll();
      found = visited.add(type) && hasSecretGetter(type, pending);
    }
    return found;
  }

  /**
   * A password getter can hold a secret, and so can an untyped one, which holds another {@code
   * oneOf}. Generated types reached through the other getters are queued for the caller to scan.
   */
  private static boolean hasSecretGetter(Class<?> type, Deque<Class<?>> pending) {
    boolean found = false;
    for (Method getter : type.getMethods()) {
      if (ReflectionUtil.isGetMethodOfObject(getter)) {
        found |=
            getter.isAnnotationPresent(PasswordField.class)
                || getter.getReturnType() == Object.class;
        pending.addAll(generatedTypes(getter.getGenericReturnType()));
      }
    }
    return found;
  }

  private static List<Class<?>> generatedTypes(Type type) {
    List<Type> types =
        type instanceof ParameterizedType parameterized
            ? Arrays.asList(parameterized.getActualTypeArguments())
            : List.of(type);
    return types.stream()
        .filter(Class.class::isInstance)
        .<Class<?>>map(candidate -> (Class<?>) candidate)
        .filter(UnmatchedOptions::isGeneratedType)
        .toList();
  }

  private static boolean isGeneratedType(Class<?> type) {
    return !type.isEnum() && type.getPackageName().startsWith(OPENMETADATA_PACKAGE);
  }
}
