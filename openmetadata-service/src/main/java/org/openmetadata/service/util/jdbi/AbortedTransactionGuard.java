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

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.core.transaction.DelegatingTransactionHandler;
import org.jdbi.v3.core.transaction.TransactionException;
import org.jdbi.v3.core.transaction.TransactionHandler;
import org.openmetadata.service.jdbi3.DeadlockRetry;

/**
 * Refuses to commit a transaction that the database has already rolled back.
 *
 * <p>A deadlock makes MySQL roll back the whole transaction, and a lock wait timeout rolls back
 * the statement. Code that catches that error and carries on runs its remaining statements in a
 * fresh transaction, so committing would persist only part of the unit of work. Instead the commit
 * becomes a rollback that rethrows the original failure, which {@link DeadlockRetry} replays.
 */
@Slf4j
public final class AbortedTransactionGuard extends DelegatingTransactionHandler {
  private final Map<Connection, SQLException> abortedTransactions =
      Collections.synchronizedMap(new IdentityHashMap<>());

  public AbortedTransactionGuard(final TransactionHandler delegate) {
    super(delegate);
  }

  /** Remembers a deadlock or lock wait timeout that hit a statement inside a transaction. */
  public void onStatementFailure(final StatementContext context, final SQLException failure) {
    final Connection connection = context.getConnection();
    if (DeadlockRetry.isDeadlock(failure) && isInTransaction(connection)) {
      abortedTransactions.put(connection, failure);
    }
  }

  @Override
  public TransactionHandler specialize(final Handle handle) throws SQLException {
    return new GuardedTransaction(getDelegate().specialize(handle));
  }

  private static boolean isInTransaction(final Connection connection) {
    try {
      return connection != null && !connection.getAutoCommit();
    } catch (SQLException e) {
      LOG.debug("Could not read the auto-commit mode of a failed statement's connection", e);
      return false;
    }
  }

  private final class GuardedTransaction extends DelegatingTransactionHandler {
    private GuardedTransaction(final TransactionHandler delegate) {
      super(delegate);
    }

    @Override
    public void begin(final Handle handle) {
      abortedTransactions.remove(handle.getConnection());
      super.begin(handle);
    }

    @Override
    public void commit(final Handle handle) {
      final SQLException failure = abortedTransactions.remove(handle.getConnection());
      if (failure != null) {
        super.rollback(handle);
        throw new TransactionException(
            "The database rolled back this transaction after a deadlock or lock wait timeout,"
                + " so the statements that ran after it were not committed",
            failure);
      }
      super.commit(handle);
    }

    @Override
    public void rollback(final Handle handle) {
      abortedTransactions.remove(handle.getConnection());
      super.rollback(handle);
    }
  }
}
