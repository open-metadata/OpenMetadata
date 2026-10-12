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
package org.openmetadata.service.util.jdbi;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.SqlStatements;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.HikariCPDataSourceFactory;

class JdbiUtilsTest {

  @Test
  void appliesTheConfiguredStatementTimeout() {
    Jdbi jdbi = Jdbi.create("jdbc:h2:mem:jdbi-utils-test");
    HikariCPDataSourceFactory factory = new HikariCPDataSourceFactory();
    factory.setQueryTimeoutSeconds(42);

    JdbiUtils.configureStatements(jdbi, factory);

    SqlStatements statements = jdbi.getConfig(SqlStatements.class);
    assertEquals(42, statements.getQueryTimeout());
    assertTrue(statements.isUnusedBindingAllowed());
  }
}
