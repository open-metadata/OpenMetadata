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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.dropwizard.db.ManagedDataSource;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.SqlStatements;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.HikariCPDataSourceFactory;

class JdbiUtilsTest {

  @Test
  void opsJdbiRunsStatementsWithoutTheRequestTimeout() {
    HikariCPDataSourceFactory factory = mock(HikariCPDataSourceFactory.class);
    when(factory.getUrl()).thenReturn("jdbc:mysql://localhost:3306/openmetadata_db");
    when(factory.getDriverClass()).thenReturn("com.mysql.cj.jdbc.Driver");
    when(factory.getQueryTimeoutSeconds()).thenReturn(42);
    when(factory.build(any(), anyString())).thenReturn(mock(ManagedDataSource.class));

    Jdbi jdbi = JdbiUtils.createAndSetupJDBI(factory);

    SqlStatements statements = jdbi.getConfig(SqlStatements.class);
    assertNull(statements.getQueryTimeout());
    assertTrue(statements.isUnusedBindingAllowed());
  }

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
