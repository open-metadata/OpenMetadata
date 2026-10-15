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
package org.openmetadata.it.tests;

import org.jdbi.v3.core.statement.StatementContext;

final class CaptureStatements {
  private CaptureStatements() {}

  static boolean deletes(final StatementContext context, final String table) {
    final String sql = context.getRenderedSql();
    return (sql.startsWith("DELETE") || sql.startsWith("WITH projection_deleted"))
        && sql.contains(table);
  }
}
