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

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.github.classgraph.ClassGraph;
import io.github.classgraph.ScanResult;
import java.lang.annotation.Annotation;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.jdbi.v3.sqlobject.statement.SqlBatch;
import org.jdbi.v3.sqlobject.statement.SqlCall;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlBatch;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlBatchContainer;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQuery;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQueryContainer;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdateContainer;

/**
 * A DAO statement that is nothing but a template attribute ({@code @SqlUpdate("<update>")}) is
 * written in full by its caller, values included. Values are bound instead
 * (ADR:2026-11-03-dao-statements-bind-every-value).
 */
class DaoStatementGuardTest {
  private static final Pattern WHOLE_TEMPLATE_ATTRIBUTE = Pattern.compile("\\s*<\\w+>\\s*;?\\s*");

  private static final List<Class<? extends Annotation>> SQL_ANNOTATIONS =
      List.of(
          SqlQuery.class,
          SqlUpdate.class,
          SqlBatch.class,
          SqlCall.class,
          ConnectionAwareSqlQuery.class,
          ConnectionAwareSqlQueryContainer.class,
          ConnectionAwareSqlUpdate.class,
          ConnectionAwareSqlUpdateContainer.class,
          ConnectionAwareSqlBatch.class,
          ConnectionAwareSqlBatchContainer.class);

  @Test
  void noDaoStatementIsWrittenByItsCaller() {
    Set<Class<?>> daos = daoClasses();
    assertTrue(daos.contains(EntityDAO.class), "the scan found only " + daos.size() + " DAOs");

    List<String> callerWritten = new ArrayList<>();
    for (Class<?> dao : daos) {
      for (Method method : dao.getDeclaredMethods()) {
        statements(method)
            .filter(sql -> WHOLE_TEMPLATE_ATTRIBUTE.matcher(sql).matches())
            .forEach(sql -> callerWritten.add(dao.getName() + "#" + method.getName() + " " + sql));
      }
    }

    assertEquals(List.of(), callerWritten, "bind the values with @Bind instead");
  }

  private static Set<Class<?>> daoClasses() {
    Set<Class<?>> daos = new HashSet<>();
    try (ScanResult scan =
        new ClassGraph()
            .enableAnnotationInfo()
            .enableMethodInfo()
            .ignoreClassVisibility()
            .acceptPackages("org.openmetadata", "io.collate")
            .scan()) {
      for (Class<? extends Annotation> annotation : SQL_ANNOTATIONS) {
        daos.addAll(scan.getClassesWithMethodAnnotation(annotation).loadClasses());
      }
    }
    return daos;
  }

  private static Stream<String> statements(Method method) {
    return Stream.of(
            Stream.ofNullable(method.getAnnotation(SqlQuery.class)).map(SqlQuery::value),
            Stream.ofNullable(method.getAnnotation(SqlUpdate.class)).map(SqlUpdate::value),
            Stream.ofNullable(method.getAnnotation(SqlBatch.class)).map(SqlBatch::value),
            Stream.ofNullable(method.getAnnotation(SqlCall.class)).map(SqlCall::value),
            Stream.of(method.getAnnotationsByType(ConnectionAwareSqlQuery.class))
                .map(ConnectionAwareSqlQuery::value),
            Stream.of(method.getAnnotationsByType(ConnectionAwareSqlUpdate.class))
                .map(ConnectionAwareSqlUpdate::value),
            Stream.of(method.getAnnotationsByType(ConnectionAwareSqlBatch.class))
                .map(ConnectionAwareSqlBatch::value))
        .flatMap(sql -> sql);
  }
}
