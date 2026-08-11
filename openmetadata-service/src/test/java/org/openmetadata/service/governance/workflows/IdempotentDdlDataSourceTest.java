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

package org.openmetadata.service.governance.workflows;

import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class IdempotentDdlDataSourceTest {

  private DataSource delegate;
  private Connection realConnection;
  private IdempotentDdlDataSource dataSource;

  @BeforeEach
  void setUp() throws Exception {
    delegate = mock(DataSource.class);
    realConnection = mock(Connection.class);
    when(delegate.getConnection()).thenReturn(realConnection);
    dataSource = new IdempotentDdlDataSource(delegate);
  }

  @Test
  void createStatementNoArgIsWrapped() throws Exception {
    when(realConnection.createStatement()).thenReturn(mock(Statement.class));

    Statement stmt = dataSource.getConnection().createStatement();

    assertInstanceOf(IdempotentDdlStatement.class, stmt);
  }

  @Test
  void createStatementTwoArgIsWrapped() throws Exception {
    when(realConnection.createStatement(ResultSet.TYPE_FORWARD_ONLY, ResultSet.CONCUR_READ_ONLY))
        .thenReturn(mock(Statement.class));

    Statement stmt =
        dataSource
            .getConnection()
            .createStatement(ResultSet.TYPE_FORWARD_ONLY, ResultSet.CONCUR_READ_ONLY);

    assertInstanceOf(IdempotentDdlStatement.class, stmt);
  }

  @Test
  void createStatementThreeArgIsWrapped() throws Exception {
    when(realConnection.createStatement(
            ResultSet.TYPE_FORWARD_ONLY,
            ResultSet.CONCUR_READ_ONLY,
            ResultSet.HOLD_CURSORS_OVER_COMMIT))
        .thenReturn(mock(Statement.class));

    Statement stmt =
        dataSource
            .getConnection()
            .createStatement(
                ResultSet.TYPE_FORWARD_ONLY,
                ResultSet.CONCUR_READ_ONLY,
                ResultSet.HOLD_CURSORS_OVER_COMMIT);

    assertInstanceOf(IdempotentDdlStatement.class, stmt);
  }

  @Test
  void sqlExceptionFromConnectionSurfacesDirectly() throws Exception {
    SQLException expected = new SQLException("connection refused");
    when(realConnection.createStatement()).thenThrow(expected);

    Connection proxied = dataSource.getConnection();

    SQLException actual = assertThrows(SQLException.class, proxied::createStatement);
    assertSame(expected, actual);
  }

  @Test
  void sqlExceptionFromNonCreateStatementMethodSurfacesDirectly() throws Exception {
    SQLException expected = new SQLException("autocommit failed");
    when(realConnection.getAutoCommit()).thenThrow(expected);

    Connection proxied = dataSource.getConnection();

    SQLException actual = assertThrows(SQLException.class, proxied::getAutoCommit);
    assertSame(expected, actual);
  }
}
