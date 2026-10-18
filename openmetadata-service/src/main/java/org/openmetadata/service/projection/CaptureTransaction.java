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

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Savepoint;
import java.util.concurrent.Callable;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.HandleCallback;
import org.jdbi.v3.core.statement.UnableToExecuteStatementException;
import org.jdbi.v3.core.transaction.TransactionException;
import org.openmetadata.service.jdbi3.TransactionRollbackTracker;

/** Preserves a DAO statement's atomicity when capture turns it into several SQL statements. */
final class CaptureTransaction implements AutoCloseable {
  private final Connection connection;
  private final Savepoint savepoint;
  private boolean completed;

  private CaptureTransaction(final Handle handle) {
    connection = handle.getConnection();
    try {
      savepoint = connection.setSavepoint();
    } catch (SQLException failure) {
      throw new TransactionException("Cannot begin atomic projection capture", failure);
    }
  }

  static <R, X extends Exception> R execute(final Handle handle, final HandleCallback<R, X> work)
      throws X {
    ProjectionCapturePlugin.requireBuffer(handle);
    if (!handle.isInTransaction()) {
      return handle.inTransaction(work::withHandle);
    }
    try (CaptureTransaction scope = new CaptureTransaction(handle)) {
      final R result = work.withHandle(handle);
      scope.completed = true;
      return result;
    }
  }

  /**
   * For single-statement writes whose capture only reads before the statement and buffers after it.
   * A statement the database rejects applied nothing, so the caller may carry on exactly as without
   * capture, and no savepoint round trips are needed. Any other failure leaves the statement's
   * outcome unknown, so it poisons the transaction, as a failed buffer spill does. Autocommit
   * callers still get a transaction, so capture commits with them.
   */
  static <R, X extends Exception> R executeBuffered(
      final Handle handle, final HandleCallback<R, X> work) throws X {
    final ProjectionCaptureBuffer buffer = ProjectionCapturePlugin.requireBuffer(handle);
    if (!handle.isInTransaction()) {
      return handle.inTransaction(work::withHandle);
    }
    boolean settled = false;
    try {
      final R result = work.withHandle(handle);
      settled = true;
      return result;
    } catch (UnableToExecuteStatementException rejected) {
      settled = true;
      throw rejected;
    } finally {
      if (!settled) {
        buffer.poison(new IllegalStateException("A captured write ended with an unknown outcome"));
      }
    }
  }

  /**
   * Runs capture work that follows a statement which already applied. The write cannot be undone
   * without a savepoint, so a failure here poisons the transaction instead of letting the write
   * commit uncaptured.
   */
  static <R> R afterWrite(final Handle handle, final Callable<R> work) throws Exception {
    boolean captured = false;
    try {
      final R result = work.call();
      captured = true;
      return result;
    } finally {
      if (!captured) {
        ProjectionCapturePlugin.requireBuffer(handle)
            .poison(new IllegalStateException("Capture failed after its write applied"));
      }
    }
  }

  /** How a captured DAO call stays atomic with its capture: a savepoint, or none. */
  @FunctionalInterface
  interface Boundary {
    Object run(Handle handle, HandleCallback<Object, Exception> work) throws Exception;
  }

  @Override
  public void close() {
    try {
      if (!completed) {
        connection.rollback(savepoint);
      }
      connection.releaseSavepoint(savepoint);
    } catch (SQLException failure) {
      abortCapture(failure);
    }
  }

  private void abortCapture(final SQLException failure) {
    // Leave the connection open so JDBI isolation cleanup cannot mask the source deadlock.
    TransactionRollbackTracker.recordRollback(failure);
    try {
      connection.rollback();
    } catch (SQLException rollbackFailure) {
      failure.addSuppressed(rollbackFailure);
    }
    throw new TransactionException("Projection capture lost its transaction savepoint", failure);
  }
}
