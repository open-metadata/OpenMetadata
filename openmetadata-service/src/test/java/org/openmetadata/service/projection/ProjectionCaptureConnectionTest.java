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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Savepoint;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

/** Tests the JDBC boundary; transaction data and spill recovery are verified against both databases. */
class ProjectionCaptureConnectionTest {
  @Test
  void wrapperPreservesJdbcIdentityAndOriginalDriverExceptions() throws Exception {
    final Connection driver = mock(Connection.class);
    final Connection connection = ProjectionCaptureConnection.wrap(driver);
    assertSame(connection, connection.unwrap(Connection.class));
    assertTrue(connection.isWrapperFor(Connection.class));
    assertTrue(connection.equals(connection));
    assertFalse(connection.equals(driver));
    assertEquals(System.identityHashCode(connection), connection.hashCode());
    final SQLException unavailable = new SQLException("driver unavailable");
    when(driver.getCatalog()).thenThrow(unavailable);
    assertSame(unavailable, assertThrows(SQLException.class, connection::getCatalog));
  }

  @Test
  void failedCommitPreservesTheCauseAndLeavesTheConnectionToThePool() throws Exception {
    final Connection driver = mock(Connection.class);
    final SQLException commitFailure = new SQLException("deadlock", "40001", 1213);
    final SQLException rollbackFailure = new SQLException("rollback failed");
    doThrow(commitFailure).when(driver).commit();
    doThrow(rollbackFailure).when(driver).rollback();
    final Connection connection = ProjectionCaptureConnection.wrap(driver);
    final SQLException failure = assertThrows(SQLException.class, connection::commit);
    assertSame(commitFailure, failure);
    assertEquals(1, failure.getSuppressed().length);
    assertSame(rollbackFailure, failure.getSuppressed()[0]);
    verify(driver, never()).close();
  }

  @Test
  void releasingASavepointAlsoReleasesEveryLaterSavepoint() throws Exception {
    final Connection driver = mock(Connection.class);
    final AtomicInteger ids = new AtomicInteger();
    when(driver.setSavepoint()).thenAnswer(call -> new Point(ids.incrementAndGet(), null));
    final Connection connection = ProjectionCaptureConnection.wrap(driver);
    final Savepoint outer = connection.setSavepoint();
    final Savepoint inner = connection.setSavepoint();
    connection.releaseSavepoint(outer);
    assertThrows(SQLException.class, () -> connection.rollback(inner));
    for (int index = 0; index < 64; index++) {
      connection.setSavepoint();
    }
    assertThrows(SQLException.class, connection::setSavepoint);
  }

  @Test
  void rollbackInvalidatesLaterSavepointsAndReleasedSavepoints() throws Exception {
    final Connection driver = mock(Connection.class);
    final AtomicInteger ids = new AtomicInteger();
    when(driver.setSavepoint(anyString()))
        .thenAnswer(call -> new Point(ids.incrementAndGet(), call.getArgument(0)));
    final Connection connection = ProjectionCaptureConnection.wrap(driver);
    final Savepoint first = connection.setSavepoint("first");
    final Savepoint later = connection.setSavepoint("later");
    connection.rollback(first);
    assertThrows(SQLException.class, () -> connection.rollback(later));
    connection.releaseSavepoint(first);
    assertThrows(SQLException.class, () -> connection.rollback(first));
  }

  @Test
  void replacingNamedSavepointsDoesNotLeakCheckpoints() throws Exception {
    final Connection driver = mock(Connection.class);
    final AtomicInteger ids = new AtomicInteger();
    when(driver.setSavepoint(anyString()))
        .thenAnswer(call -> new Point(ids.incrementAndGet(), call.getArgument(0)));
    final Connection connection = ProjectionCaptureConnection.wrap(driver);
    Savepoint last = null;
    for (int index = 0; index < 100; index++) {
      last = connection.setSavepoint("replace");
    }
    connection.rollback(last);
    connection.releaseSavepoint(last);
    connection.close();
  }

  @Test
  void activeSavepointsAreBoundedAndFullRollbackReleasesThem() throws Exception {
    final Connection driver = mock(Connection.class);
    final AtomicInteger ids = new AtomicInteger();
    when(driver.setSavepoint()).thenAnswer(call -> new Point(ids.incrementAndGet(), null));
    final Connection connection = ProjectionCaptureConnection.wrap(driver);
    for (int index = 0; index < 64; index++) {
      connection.setSavepoint();
    }
    assertThrows(SQLException.class, connection::setSavepoint);
    connection.rollback();
    final Savepoint reused = connection.setSavepoint();
    connection.releaseSavepoint(reused);
    connection.abort(Runnable::run);
  }

  private record Point(int id, String name) implements Savepoint {
    @Override
    public int getSavepointId() {
      return id;
    }

    @Override
    public String getSavepointName() {
      return name;
    }
  }
}
