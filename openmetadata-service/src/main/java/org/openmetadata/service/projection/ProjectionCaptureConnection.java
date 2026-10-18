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

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Savepoint;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.openmetadata.service.projection.ProjectionCapturePlugin.CaptureConnection;

/** Couples buffered facts to JDBC commit and savepoint semantics, including implicit commits. */
final class ProjectionCaptureConnection implements InvocationHandler {
  private static final int MAX_SAVEPOINTS = 64;
  private final Connection delegate;
  private final ProjectionCaptureBuffer buffer = new ProjectionCaptureBuffer();
  private final List<Checkpoint> checkpoints = new ArrayList<>();

  private ProjectionCaptureConnection(final Connection delegate) {
    this.delegate = delegate;
  }

  static Connection wrap(final Connection connection) {
    return (Connection)
        Proxy.newProxyInstance(
            CaptureConnection.class.getClassLoader(),
            new Class<?>[] {CaptureConnection.class},
            new ProjectionCaptureConnection(connection));
  }

  @Override
  public Object invoke(final Object proxy, final Method method, final Object[] arguments)
      throws Throwable {
    return switch (method.getName()) {
      case "projectionCaptureBuffer" -> buffer;
      case "commit" -> commit();
      case "setAutoCommit" -> autoCommit((Boolean) arguments[0]);
      case "rollback" -> rollback(arguments == null ? null : (Savepoint) arguments[0]);
      case "setSavepoint" -> savepoint(arguments == null ? null : (String) arguments[0]);
      case "releaseSavepoint" -> release((Savepoint) arguments[0]);
      case "close", "abort" -> close(method, arguments);
      case "equals" -> proxy == arguments[0];
      case "hashCode" -> System.identityHashCode(proxy);
      case "isWrapperFor" -> ((Class<?>) arguments[0]).isInstance(proxy)
          || delegate.isWrapperFor((Class<?>) arguments[0]);
      case "unwrap" -> ((Class<?>) arguments[0]).isInstance(proxy)
          ? proxy
          : delegate.unwrap((Class<?>) arguments[0]);
      default -> forward(method, arguments);
    };
  }

  private Object commit() throws SQLException {
    try {
      buffer.flush();
      delegate.commit();
    } catch (SQLException | RuntimeException | Error failure) {
      abort(failure);
      throw failure;
    } finally {
      clear();
    }
    return null;
  }

  private Object autoCommit(final boolean enabled) throws SQLException {
    if (enabled && !delegate.getAutoCommit()) {
      // JDBC setAutoCommit(true) commits pending writes; capture must precede it as well.
      try {
        buffer.flush();
        delegate.setAutoCommit(true);
      } catch (SQLException | RuntimeException | Error failure) {
        abort(failure);
        throw failure;
      } finally {
        clear();
      }
    } else {
      delegate.setAutoCommit(enabled);
    }
    return null;
  }

  private Savepoint savepoint(final String name) throws SQLException {
    if (checkpoints.size() == MAX_SAVEPOINTS) {
      throw new SQLException(
          "Projection capture supports at most " + MAX_SAVEPOINTS + " active savepoints");
    }
    final Savepoint savepoint =
        name == null ? delegate.setSavepoint() : delegate.setSavepoint(name);
    if (name != null) {
      checkpoints.removeIf(checkpoint -> name.equals(checkpoint.name()));
    }
    checkpoints.add(new Checkpoint(savepoint, name, buffer.snapshot()));
    return savepoint;
  }

  private Object rollback(final Savepoint savepoint) throws SQLException {
    if (savepoint == null) {
      try {
        delegate.rollback();
      } finally {
        clear();
      }
    } else {
      final int index = checkpointIndex(savepoint);
      delegate.rollback(savepoint);
      buffer.restore(checkpoints.get(index).snapshot());
      checkpoints.subList(index + 1, checkpoints.size()).clear();
    }
    return null;
  }

  private Object release(final Savepoint savepoint) throws SQLException {
    final int index = checkpointIndex(savepoint);
    delegate.releaseSavepoint(savepoint);
    // MySQL and PostgreSQL both discard every savepoint established after the released one.
    checkpoints.subList(index, checkpoints.size()).clear();
    return null;
  }

  private int checkpointIndex(final Savepoint savepoint) throws SQLException {
    for (int index = 0; index < checkpoints.size(); index++) {
      if (Objects.equals(checkpoints.get(index).savepoint(), savepoint)) {
        return index;
      }
    }
    throw new SQLException("Projection capture cannot restore an unknown savepoint");
  }

  private Object close(final Method method, final Object[] arguments) throws Throwable {
    try {
      return forward(method, arguments);
    } finally {
      clear();
    }
  }

  /**
   * Leaves a connection whose rollback failed open: closing it here made JDBI's auto-commit restore
   * fail on a closed connection and replace the original failure, hiding a deadlock from retry. The
   * pool validates and evicts a broken connection when the handle returns it.
   */
  private void abort(final Throwable failure) {
    try {
      delegate.rollback();
    } catch (SQLException rollbackFailure) {
      failure.addSuppressed(rollbackFailure);
    }
  }

  private void clear() {
    buffer.clear();
    checkpoints.clear();
  }

  private Object forward(final Method method, final Object[] arguments) throws Throwable {
    try {
      return method.invoke(delegate, arguments);
    } catch (InvocationTargetException failure) {
      throw failure.getCause();
    }
  }

  private record Checkpoint(
      Savepoint savepoint, String name, ProjectionCaptureBuffer.Snapshot snapshot) {}
}
