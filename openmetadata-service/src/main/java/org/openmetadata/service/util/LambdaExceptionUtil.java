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

import java.util.Comparator;
import java.util.function.Consumer;
import java.util.function.Function;

/**
 * Utility class for the streams API.
 *
 * <p>Wraps consumers and functions into interfaces that can throw Checked Exceptions
 */
public final class LambdaExceptionUtil {

  @FunctionalInterface
  public interface ConsumerWithExceptions<T, E extends Exception> {
    void accept(T t) throws E;
  }

  @FunctionalInterface
  public interface FunctionWithExceptions<T, R, E extends Exception> {
    R apply(T t) throws E;
  }

  @FunctionalInterface
  public interface ComparatorWithExceptions<T, E extends Exception> {
    int compare(T o1, T o2) throws E;
  }

  /**
   * Wrap a standard {@link Consumer} in a {@link ConsumerWithExceptions}.
   *
   * <p>This allows a consumer to throw Checked Exception that will be propagated to the context of the statement
   * calling it
   *
   * <p>Example: <code>
   *     Stream.of("java.lang.String", "java.bad.Class").forEach(rethrowConsumer(name -> System.out.println(Class.forName(name))));
   *   </code> throws checked {@link ClassNotFoundException}
   */
  public static <T, E extends Exception> Consumer<T> rethrowConsumer(ConsumerWithExceptions<T, E> consumer) {
    return t -> {
      try {
        consumer.accept(t);
      } catch (Exception exception) {
        throwActualException(exception);
      }
    };
  }

  /**
   * Wrap a standard {@link Function} in a {@link FunctionWithExceptions}.
   *
   * <p>This allows a lambda function to throw Checked Exception that will be propagated to the context of the statement
   * calling it
   *
   * <p>Example: <code>
   *     Stream.of("java.lang.String", "java.bad.Class").map(rethrowFunction(Class::forName)));
   *   </code> throws checked {@link ClassNotFoundException}
   */
  public static <T, R, E extends Exception> Function<T, R> rethrowFunction(FunctionWithExceptions<T, R, E> function) {
    return t -> {
      try {
        return function.apply(t);
      } catch (Exception exception) {
        throwActualException(exception);
        return null;
      }
    };
  }

  /**
   * Wrap a standard {@link Comparator} in a {@link ComparatorWithExceptions}.
   *
   * <p>This allows a comparator to propagate a Checked Exception
   *
   * <p>Example: <code>
   * List.of("java.lang.String", "java.lang.Integer", "java.bad.Class").sorted((c1, c2) -> Class.forName(c1).getFields().length - Class.forName(c2).getFields().length
   * </code> throws checked {@link ClassNotFoundException}
   */
  public static <T, E extends Exception> Comparator<T> rethrowComparator(ComparatorWithExceptions<T, E> comparator) {
    return (t1, t2) -> {
      try {
        return comparator.compare(t1, t2);
      } catch (Exception exception) {
        throwActualException(exception);
        return Integer.MIN_VALUE;
      }
    };
  }

  /**
   * Wrap a standard {@link Comparator}, swallowing all {@link Exception}.
   *
   * <p><bold>WARNING!</bold> When {@link Comparator#compare} throws an exception the elements are treated as equal.
   * This should only be used for ignoring checked exceptions that can never be throws.
   */
  public static <T, E extends Exception> Comparator<T> ignoringComparator(ComparatorWithExceptions<T, E> comparator) {
    return (t1, t2) -> {
      try {
        return comparator.compare(t1, t2);
      } catch (Exception ignored) {
        return 0;
      }
    };
  }

  @SuppressWarnings("unchecked")
  private static <E extends Exception> void throwActualException(Exception exception) throws E {
    throw (E) exception;
  }
}
