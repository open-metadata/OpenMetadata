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
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Savepoint;
import java.util.concurrent.atomic.AtomicBoolean;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.transaction.TransactionException;
import org.jdbi.v3.sqlobject.customizer.SqlStatementCustomizerFactory;
import org.jdbi.v3.sqlobject.customizer.SqlStatementCustomizingAnnotation;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.DeadlockRetry;

/** Real JDBI with faults at the JDBC and annotation-factory boundaries. */
class CaptureBoundaryFailureTest {
  private Connection connection;
  private Handle handle;

  @BeforeEach
  void openHandle() throws SQLException {
    connection = mock(Connection.class);
    when(connection.getAutoCommit()).thenReturn(false);
    handle = Jdbi.create(() -> connection).installPlugin(new ProjectionCapturePlugin()).open();
  }

  @AfterEach
  void closeHandle() {
    handle.close();
  }

  @Test
  void unavailableSavepointPreventsTheSourceMutation() throws SQLException {
    final SQLException unavailable = new SQLException("connection unavailable");
    when(connection.setSavepoint()).thenThrow(unavailable);
    final AtomicBoolean changed = new AtomicBoolean();
    final var failure =
        assertThrows(
            TransactionException.class,
            () ->
                CaptureTransaction.execute(
                    handle,
                    transaction -> {
                      changed.set(true);
                      return null;
                    }));
    assertSame(unavailable, failure.getCause());
    assertFalse(changed.get());
  }

  @Test
  void rollbackFailuresDoNotHideTheOriginalReplayableError() throws SQLException {
    final Savepoint savepoint = mock(Savepoint.class);
    final SQLException lostSavepoint = new SQLException("savepoint no longer exists");
    final SQLException unavailable = new SQLException("connection unavailable");
    when(connection.setSavepoint()).thenReturn(savepoint);
    doThrow(lostSavepoint).when(connection).rollback(savepoint);
    doThrow(unavailable).when(connection).rollback();
    final var original =
        new IllegalStateException(
            "source mutation failed", new SQLException("deadlock", "40001", 1213));
    final var failure =
        assertThrows(
            IllegalStateException.class,
            () ->
                CaptureTransaction.execute(
                    handle,
                    transaction -> {
                      throw original;
                    }));
    assertSame(original, failure);
    assertTrue(DeadlockRetry.isDeadlock(failure));
    assertEquals(1, failure.getSuppressed().length);
    assertSame(lostSavepoint, failure.getSuppressed()[0].getCause());
    assertSame(unavailable, lostSavepoint.getSuppressed()[0]);
  }

  @Test
  void releaseFailureCannotReportSuccessfulCapture() throws SQLException {
    final Savepoint savepoint = mock(Savepoint.class);
    final SQLException unavailable = new SQLException("release failed");
    when(connection.setSavepoint()).thenReturn(savepoint);
    doThrow(unavailable).when(connection).releaseSavepoint(savepoint);
    final var failure =
        assertThrows(
            TransactionException.class,
            () -> CaptureTransaction.execute(handle, transaction -> "success"));
    assertSame(unavailable, failure.getCause());
  }

  @Test
  void unusableParameterFactoryFailsWithTheDaoMethodContext() throws NoSuchMethodException {
    final var method = InvalidBindings.class.getDeclaredMethod("mutation", String.class);
    final var failure =
        assertThrows(IllegalArgumentException.class, () -> new SqlObjectBindings(method));
    assertTrue(failure.getMessage().contains("InvalidBindings.mutation"));
    assertSame(IllegalStateException.class, failure.getCause().getCause().getClass());
  }

  private interface InvalidBindings {
    void mutation(@UnavailableBinding String value);
  }

  @Target(ElementType.PARAMETER)
  @Retention(RetentionPolicy.RUNTIME)
  @SqlStatementCustomizingAnnotation(UnavailableFactory.class)
  private @interface UnavailableBinding {}

  public static final class UnavailableFactory implements SqlStatementCustomizerFactory {
    public UnavailableFactory() {
      throw new IllegalStateException("customizer unavailable");
    }
  }
}
