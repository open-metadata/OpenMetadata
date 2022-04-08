package org.openmetadata.catalog.jdbi3.locator;

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

  public ConnectionAwareAnnotationSqlLocator(ConnectionType connectionType) {
    this.connectionType = requireNonNull(connectionType, "Connection type is null");
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
                                "Method %s is missing SQL annotation for connection type %s or ALL",
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
