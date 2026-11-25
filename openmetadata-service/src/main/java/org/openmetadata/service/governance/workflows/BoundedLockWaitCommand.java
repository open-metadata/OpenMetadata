package org.openmetadata.service.governance.workflows;

import static org.flowable.common.engine.impl.AbstractEngineConfiguration.DATABASE_TYPE_MYSQL;
import static org.flowable.common.engine.impl.AbstractEngineConfiguration.DATABASE_TYPE_POSTGRES;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Duration;
import org.flowable.common.engine.api.FlowableException;
import org.flowable.common.engine.impl.interceptor.Command;
import org.flowable.common.engine.impl.interceptor.CommandContext;
import org.flowable.common.engine.impl.interceptor.CommandContextCloseListener;
import org.flowable.engine.impl.util.CommandContextUtil;

/**
 * Runs Flowable work as one command whose row-lock waits are bounded by {@code lockWait}: a
 * statement that waits longer for a row lock fails with the database's lock-timeout error instead
 * of holding the caller for the server-wide wait, which is unbounded on Postgres by default.
 *
 * <p>Flowable writes a command's changes when it flushes the command's sessions, after {@code
 * work} returned; the commands {@code work} runs reuse this command's context, so their statements
 * run on its connection and in its transaction. On Postgres the bound is {@code SET LOCAL
 * lock_timeout}, which ends with the transaction. MySQL has no transaction-scoped form of {@code
 * innodb_lock_wait_timeout}, so the session value is set, and restored once the sessions are
 * flushed or the command failed, before the pooled connection is released. Other databases run
 * {@code work} unbounded.
 */
record BoundedLockWaitCommand(Duration lockWait, Runnable work) implements Command<Void> {

  private static final String MYSQL_SESSION_LOCK_WAIT_SQL =
      "SELECT @@SESSION.innodb_lock_wait_timeout";
  private static final String MYSQL_SET_LOCK_WAIT_SQL = "SET SESSION innodb_lock_wait_timeout = %d";
  private static final String POSTGRES_SET_LOCK_TIMEOUT_SQL = "SET LOCAL lock_timeout = '%dms'";

  @Override
  public Void execute(CommandContext commandContext) {
    Connection connection =
        CommandContextUtil.getDbSqlSession(commandContext).getSqlSession().getConnection();
    String databaseType =
        CommandContextUtil.getProcessEngineConfiguration(commandContext).getDatabaseType();
    try {
      switch (databaseType) {
        case DATABASE_TYPE_MYSQL -> boundMySqlLockWait(commandContext, connection);
        case DATABASE_TYPE_POSTGRES -> execute(
            connection, POSTGRES_SET_LOCK_TIMEOUT_SQL.formatted(lockWait.toMillis()));
        default -> {
          // No session setting bounds the lock wait on this database; the work runs as it is.
        }
      }
    } catch (SQLException e) {
      throw new FlowableException("Could not bound the lock wait on %s".formatted(databaseType), e);
    }
    work.run();
    return null;
  }

  private void boundMySqlLockWait(CommandContext commandContext, Connection connection)
      throws SQLException {
    long sessionLockWaitSeconds = querySessionLockWaitSeconds(connection);
    execute(connection, MYSQL_SET_LOCK_WAIT_SQL.formatted(Math.max(1, lockWait.toSeconds())));
    commandContext.addCloseListener(new MySqlLockWaitRestorer(connection, sessionLockWaitSeconds));
  }

  private static long querySessionLockWaitSeconds(Connection connection) throws SQLException {
    try (Statement statement = connection.createStatement();
        ResultSet resultSet = statement.executeQuery(MYSQL_SESSION_LOCK_WAIT_SQL)) {
      resultSet.next();
      return resultSet.getLong(1);
    }
  }

  private static void execute(Connection connection, String sql) throws SQLException {
    try (Statement statement = connection.createStatement()) {
      statement.execute(sql);
    }
  }

  /** Puts the session's own innodb_lock_wait_timeout back on the pooled connection. */
  private record MySqlLockWaitRestorer(Connection connection, long sessionLockWaitSeconds)
      implements CommandContextCloseListener {

    @Override
    public void closing(CommandContext commandContext) {
      // The bound has to hold through the flush that follows.
    }

    @Override
    public void afterSessionsFlush(CommandContext commandContext) {
      restore();
    }

    @Override
    public void closed(CommandContext commandContext) {
      // Restored after the flush, before the commit.
    }

    @Override
    public void closeFailure(CommandContext commandContext) {
      restore();
    }

    @Override
    public Integer order() {
      return 0;
    }

    @Override
    public boolean multipleAllowed() {
      return true;
    }

    private void restore() {
      try {
        execute(connection, MYSQL_SET_LOCK_WAIT_SQL.formatted(sessionLockWaitSeconds));
      } catch (SQLException e) {
        throw new FlowableException("Could not restore the session's lock wait timeout", e);
      }
    }
  }
}
