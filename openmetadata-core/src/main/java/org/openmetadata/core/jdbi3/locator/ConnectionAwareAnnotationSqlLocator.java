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

package org.openmetadata.core.jdbi3.locator;

import static java.lang.String.format;
import static java.util.Objects.requireNonNull;
import static java.util.function.Function.identity;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import org.jdbi.v3.core.config.ConfigRegistry;
import org.jdbi.v3.core.internal.JdbiOptionals;
import org.jdbi.v3.sqlobject.internal.SqlAnnotations;
import org.jdbi.v3.sqlobject.locator.SqlLocator;

public class ConnectionAwareAnnotationSqlLocator implements SqlLocator {
  private final ConnectionType connectionType;
  private final ConcurrentMap<Method, String> located = new ConcurrentHashMap<>();

  public ConnectionAwareAnnotationSqlLocator(String jdbcDriverClass) {
    this.connectionType = ConnectionType.from(requireNonNull(jdbcDriverClass, "Connection type is null"));
  }

  @Override
  public String locate(Class<?> sqlObjectType, Method method, ConfigRegistry config) {
    return located.computeIfAbsent(
        method,
        m ->
            getAnnotationValue(m)
                .orElseThrow(
                    () ->
                        new IllegalStateException(
                            format(
                                "Method %s is missing SQL annotation for connection type %s",
                                method, connectionType))));
  }

  private Optional<String> getAnnotationValue(Method method) {
    return JdbiOptionals.findFirstPresent(
        () ->
            Optional.ofNullable(method.getAnnotation(ConnectionAwareSqlUpdateContainer.class))
                .map(ConnectionAwareSqlUpdateContainer::value)
                .map(Arrays::asList)
                .map(l -> l.stream().filter(a -> a.connectionType().equals(connectionType)).findFirst())
                .flatMap(identity()) // Unwrap Option<Optional<?>> to Optional<?>
                .map(ConnectionAwareSqlUpdate::value),
        () ->
            Optional.ofNullable(method.getAnnotation(ConnectionAwareSqlQueryContainer.class))
                .map(ConnectionAwareSqlQueryContainer::value)
                .map(Arrays::asList)
                .map(l -> l.stream().filter(a -> a.connectionType().equals(connectionType)).findFirst())
                .flatMap(identity()) // Unwrap Option<Optional<?>> to Optional<?>
                .map(ConnectionAwareSqlQuery::value),
        () -> SqlAnnotations.getAnnotationValue(method));
  }
}
