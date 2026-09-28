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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.micrometer.core.instrument.Metrics;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.sql.Connection;
import java.sql.SQLException;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.core.transaction.TransactionException;
import org.jdbi.v3.core.transaction.TransactionHandler;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.DeadlockRetry;

class AbortedTransactionGuardTest {
  private static final String LOSING_STATEMENT = "EntityRelationshipDAO.insert";

  private final SimpleMeterRegistry meters = new SimpleMeterRegistry();
  private final Handle handle = mock(Handle.class);
  private final Connection connection = mock(Connection.class);
  private final StatementContext statement = mock(StatementContext.class);
  private final TransactionHandler transaction = mock(TransactionHandler.class);
  private AbortedTransactionGuard guard;
  private TransactionHandler guarded;

  @BeforeEach
  void setUp() throws SQLException {
    Metrics.addRegistry(meters);
    TransactionHandler delegate = mock(TransactionHandler.class);
    when(delegate.specialize(handle)).thenReturn(transaction);
    when(handle.getConnection()).thenReturn(connection);
    when(statement.getConnection()).thenReturn(connection);
    when(statement.getRenderedSql()).thenReturn("/* " + LOSING_STATEMENT + " */ INSERT INTO t");
    when(connection.getAutoCommit()).thenReturn(false);
    guard = new AbortedTransactionGuard(delegate);
    guarded = guard.specialize(handle);
  }

  @AfterEach
  void tearDown() {
    Metrics.removeRegistry(meters);
  }

  @Test
  void aTransactionThatLostADeadlockIsRolledBackAndReplayedInsteadOfCommitted() {
    guard.onStatementFailure(statement, deadlock());

    TransactionException refused =
        assertThrows(TransactionException.class, () -> guarded.commit(handle));

    assertTrue(DeadlockRetry.isDeadlock(refused), "the refusal must be replayable");
    verify(transaction).rollback(handle);
    verify(transaction, never()).commit(handle);
  }

  @Test
  void aTransactionWithoutAConcurrencyFailureCommits() {
    guard.onStatementFailure(statement, new SQLException("Data too long", "22001", 1406));

    guarded.commit(handle);

    verify(transaction).commit(handle);
  }

  @Test
  void aDeadlockOutsideATransactionDoesNotBlockTheNextCommit() throws SQLException {
    when(connection.getAutoCommit()).thenReturn(true);
    guard.onStatementFailure(statement, deadlock());

    guarded.commit(handle);

    verify(transaction).commit(handle);
  }

  @Test
  void aConnectionWhoseTransactionStateIsUnreadableIsNotGuarded() throws SQLException {
    when(connection.getAutoCommit()).thenThrow(new SQLException("Connection is closed", "08003"));
    guard.onStatementFailure(statement, deadlock());

    guarded.commit(handle);

    verify(transaction).commit(handle);
  }

  @Test
  void aNewTransactionDoesNotInheritAnEarlierFailure() {
    guard.onStatementFailure(statement, deadlock());

    guarded.begin(handle);
    guarded.commit(handle);

    verify(transaction).commit(handle);
  }

  @Test
  void aRollbackClearsTheFailure() {
    guard.onStatementFailure(statement, deadlock());

    guarded.rollback(handle);
    guarded.commit(handle);

    verify(transaction).commit(handle);
  }

  @Test
  void theSqlLoggerCountsTheLosingStatementAndGuardsItsTransaction() {
    new OMSqlLogger(guard).logException(statement, deadlock());

    assertEquals(
        1.0,
        meters
            .get(OMSqlLogger.DEADLOCK_METRIC)
            .tag(OMSqlLogger.STATEMENT_TAG, LOSING_STATEMENT)
            .counter()
            .count());
    assertThrows(TransactionException.class, () -> guarded.commit(handle));
  }

  private static SQLException deadlock() {
    return new SQLException(
        "Deadlock found when trying to get lock; try restarting transaction", "40001", 1213);
  }
}
