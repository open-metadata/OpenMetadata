package org.openmetadata.service.governance.workflows;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.apache.ibatis.session.SqlSession;
import org.flowable.common.engine.impl.AbstractEngineConfiguration;
import org.flowable.common.engine.impl.db.DbSqlSession;
import org.flowable.common.engine.impl.interceptor.CommandContext;
import org.flowable.common.engine.impl.interceptor.CommandContextCloseListener;
import org.flowable.common.engine.impl.interceptor.EngineConfigurationConstants;
import org.flowable.engine.impl.cfg.ProcessEngineConfigurationImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * The session SQL that bounds a command's row-lock wait, recorded from the JDBC connection the
 * command's Flowable session runs on, in the order the database receives it.
 */
class BoundedLockWaitCommandTest {

  private static final long MYSQL_SESSION_LOCK_WAIT_SECONDS = 50;

  private final List<String> statements = new ArrayList<>();
  private final CommandContext commandContext = mock(CommandContext.class);
  private final ProcessEngineConfigurationImpl engineConfiguration =
      mock(ProcessEngineConfigurationImpl.class);
  private final AtomicReference<CommandContextCloseListener> closeListener =
      new AtomicReference<>();

  @BeforeEach
  void setUp() throws SQLException {
    Connection connection = recordingConnection();
    SqlSession sqlSession = mock(SqlSession.class);
    when(sqlSession.getConnection()).thenReturn(connection);
    DbSqlSession dbSqlSession = mock(DbSqlSession.class);
    when(dbSqlSession.getSqlSession()).thenReturn(sqlSession);
    when(commandContext.getSession(DbSqlSession.class)).thenReturn(dbSqlSession);
    when(commandContext.getEngineConfigurations())
        .thenReturn(
            Map.of(EngineConfigurationConstants.KEY_PROCESS_ENGINE_CONFIG, engineConfiguration));
    doAnswer(
            invocation -> {
              closeListener.set(invocation.getArgument(0));
              return null;
            })
        .when(commandContext)
        .addCloseListener(any());
  }

  @Test
  void postgresBoundsTheLockWaitForTheTransactionOnly() {
    when(engineConfiguration.getDatabaseType())
        .thenReturn(AbstractEngineConfiguration.DATABASE_TYPE_POSTGRES);

    run(Duration.ofSeconds(5));

    assertEquals(List.of("SET LOCAL lock_timeout = '5000ms'", "work"), statements);
    assertNull(closeListener.get());
  }

  @Test
  void mysqlRestoresTheSessionLockWaitOnceTheSessionsAreFlushed() {
    when(engineConfiguration.getDatabaseType())
        .thenReturn(AbstractEngineConfiguration.DATABASE_TYPE_MYSQL);

    run(Duration.ofSeconds(5));
    closeListener.get().closing(commandContext);
    statements.add("flush");
    closeListener.get().afterSessionsFlush(commandContext);

    assertEquals(
        List.of(
            "SELECT @@SESSION.innodb_lock_wait_timeout",
            "SET SESSION innodb_lock_wait_timeout = 5",
            "work",
            "flush",
            "SET SESSION innodb_lock_wait_timeout = 50"),
        statements);
  }

  @Test
  void mysqlRestoresTheSessionLockWaitWhenTheCommandFails() {
    when(engineConfiguration.getDatabaseType())
        .thenReturn(AbstractEngineConfiguration.DATABASE_TYPE_MYSQL);

    run(Duration.ofSeconds(5));
    closeListener.get().closeFailure(commandContext);

    assertEquals("SET SESSION innodb_lock_wait_timeout = 50", statements.getLast());
    assertTrue(closeListener.get().multipleAllowed());
  }

  @Test
  void otherDatabasesRunTheWorkUnbounded() {
    when(engineConfiguration.getDatabaseType()).thenReturn("h2");

    run(Duration.ofSeconds(5));

    assertEquals(List.of("work"), statements);
  }

  private void run(Duration lockWait) {
    new BoundedLockWaitCommand(lockWait, () -> statements.add("work")).execute(commandContext);
  }

  private Connection recordingConnection() throws SQLException {
    Statement statement = mock(Statement.class);
    doAnswer(
            invocation -> {
              statements.add(invocation.getArgument(0));
              return true;
            })
        .when(statement)
        .execute(anyString());
    ResultSet resultSet = mock(ResultSet.class);
    when(resultSet.next()).thenReturn(true);
    when(resultSet.getLong(1)).thenReturn(MYSQL_SESSION_LOCK_WAIT_SECONDS);
    when(statement.executeQuery(anyString()))
        .thenAnswer(
            invocation -> {
              statements.add(invocation.getArgument(0));
              return resultSet;
            });
    Connection connection = mock(Connection.class);
    when(connection.createStatement()).thenReturn(statement);
    return connection;
  }
}
