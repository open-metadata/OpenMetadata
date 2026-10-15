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

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.Set;
import org.jdbi.v3.sqlobject.Handler;
import org.jdbi.v3.sqlobject.statement.SqlBatch;
import org.jdbi.v3.sqlobject.statement.SqlCall;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlBatch;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQuery;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;

/** New DAO write shapes must be captured explicitly before they can execute. */
final class CaptureWritePolicy {
  private static final Set<String> EXCLUDED_WRITES =
      Set.of(
          "org.openmetadata.service.jdbi3.FeedDAOs$TaskDAO#incrementSequenceMysql",
          "org.openmetadata.service.jdbi3.FeedDAOs$TaskDAO#getNextTaskIdPostgres",
          "org.openmetadata.service.jdbi3.FeedDAOs$TaskDAO#resetSequence");
  private static final Set<String> READ_ONLY_CTES =
      Set.of(
          "org.openmetadata.service.jdbi3.EntityDataDAOs$MetricDAO#listHierarchy",
          "org.openmetadata.service.jdbi3.EntityDataDAOs$MetricDAO#countHierarchy");

  private CaptureWritePolicy() {}

  static Handler unsupportedWriteOrRead(final Handler base, final Method method) {
    return isWrite(method) && !EXCLUDED_WRITES.contains(key(method)) ? unsupported(method) : base;
  }

  static Handler unsupported(final Method method) {
    return (target, arguments, supplier) -> {
      throw new UnsupportedOperationException(
          "Projection capture is missing for DAO write " + key(method));
    };
  }

  static boolean isWrite(final Method method) {
    return method.isAnnotationPresent(SqlUpdate.class)
        || method.isAnnotationPresent(SqlBatch.class)
        || method.isAnnotationPresent(SqlCall.class)
        || method.getAnnotationsByType(ConnectionAwareSqlUpdate.class).length != 0
        || method.getAnnotationsByType(ConnectionAwareSqlBatch.class).length != 0
        || queryMutates(method);
  }

  private static boolean queryMutates(final Method method) {
    if (READ_ONLY_CTES.contains(key(method))) {
      return false;
    }
    final SqlQuery query = method.getAnnotation(SqlQuery.class);
    return (query != null && !isRead(query.value()))
        || Arrays.stream(method.getAnnotationsByType(ConnectionAwareSqlQuery.class))
            .anyMatch(annotation -> !isRead(annotation.value()));
  }

  private static boolean isRead(final String sql) {
    // WITH can contain data-changing statements, and EXPLAIN ANALYZE executes its statement.
    return sql.stripLeading().matches("(?is)^(SELECT|SHOW)\\b.*");
  }

  private static String key(final Method method) {
    return method.getDeclaringClass().getName() + "#" + method.getName();
  }
}
