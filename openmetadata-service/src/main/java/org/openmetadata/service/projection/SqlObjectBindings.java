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

package org.openmetadata.service.projection;

import java.lang.annotation.Annotation;
import java.lang.reflect.Method;
import java.lang.reflect.Parameter;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import org.jdbi.v3.core.statement.SqlStatement;
import org.jdbi.v3.core.statement.SqlStatements;
import org.jdbi.v3.sqlobject.customizer.SqlStatementCustomizingAnnotation;
import org.jdbi.v3.sqlobject.customizer.SqlStatementParameterCustomizer;

/** Reuses the DAO's JDBI parameter semantics for its capture statement. */
final class SqlObjectBindings {
  private final List<Binding> bindings;

  SqlObjectBindings(final Method method) {
    final List<Binding> compiled = new ArrayList<>();
    final Parameter[] parameters = method.getParameters();
    for (int i = 0; i < parameters.length; i++) {
      for (final Annotation annotation : parameters[i].getAnnotations()) {
        final SqlStatementCustomizingAnnotation customization =
            annotation.annotationType().getAnnotation(SqlStatementCustomizingAnnotation.class);
        if (customization != null) {
          compiled.add(compile(method, parameters[i], i, annotation, customization));
        }
      }
    }
    bindings = List.copyOf(compiled);
  }

  private static Binding compile(
      final Method method,
      final Parameter parameter,
      final int index,
      final Annotation annotation,
      final SqlStatementCustomizingAnnotation customization) {
    try {
      return new Binding(
          index,
          customization
              .value()
              .getDeclaredConstructor()
              .newInstance()
              .createForParameter(
                  annotation,
                  method.getDeclaringClass(),
                  method,
                  parameter,
                  index,
                  parameter.getParameterizedType()));
    } catch (ReflectiveOperationException exception) {
      throw new IllegalArgumentException("Cannot bind projection capture for " + method, exception);
    }
  }

  void apply(final SqlStatement<?> statement, final Object[] arguments) {
    // A capture selector uses a subset of the source operation's bindings.
    statement.getConfig(SqlStatements.class).setUnusedBindingAllowed(true);
    try {
      for (final Binding binding : bindings) {
        binding.customizer().warm(statement.getConfig());
        binding.customizer().apply(statement, arguments[binding.index()]);
      }
    } catch (SQLException exception) {
      throw new IllegalStateException("Cannot bind relationship projection capture", exception);
    }
  }

  private record Binding(int index, SqlStatementParameterCustomizer customizer) {}
}
