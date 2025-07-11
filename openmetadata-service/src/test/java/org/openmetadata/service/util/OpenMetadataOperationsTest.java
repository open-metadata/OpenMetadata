package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.FlywayException;
import org.flywaydb.core.api.configuration.FlywayConfiguration;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.Query;
import org.jdbi.v3.core.statement.Update;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.MigrationWorkflow;
import org.openmetadata.service.migration.api.MigrationProcess;
import org.openmetadata.service.resources.CollectionRegistry;
import org.openmetadata.service.search.SearchRepository;

public class OpenMetadataOperationsTest {

    private OpenMetadataOperations operations;
    private Flyway flyway;
    private Jdbi jdbi;
    private SearchRepository searchRepository;
    private MigrationDAO migrationDAO;
    private FlywayConfiguration flywayConfiguration;
    private DataSource dataSource;
    private Connection connection;
    private Handle handle;
    private Query query;
    private Update update;

    @BeforeEach
    void setUp() throws Exception {
        operations = new OpenMetadataOperations();
        flyway = mock(Flyway.class);
        operations.flyway = flyway;
        jdbi = mock(Jdbi.class);
        operations.jdbi = jdbi;
        searchRepository = mock(SearchRepository.class);
        operations.searchRepository = searchRepository;
        migrationDAO = mock(MigrationDAO.class);
        when(jdbi.onDemand(MigrationDAO.class)).thenReturn(migrationDAO);
        flywayConfiguration = mock(FlywayConfiguration.class);
        when(flyway.getConfiguration()).thenReturn(flywayConfiguration);
        dataSource = mock(DataSource.class);
        connection = mock(Connection.class);
        when(flywayConfiguration.getDataSource()).thenReturn(dataSource);
        when(dataSource.getConnection()).thenReturn(connection);
        handle = mock(Handle.class);
        when(jdbi.open()).thenReturn(handle);
        when(jdbi.withHandle(any())).thenReturn(new ArrayList<>());
        query = mock(Query.class);
        update = mock(Update.class);
        when(handle.createQuery(anyString())).thenReturn(query);
        when(handle.createUpdate(anyString())).thenReturn(update);
        when(query.mapTo(Integer.class)).thenReturn(query);
        when(query.findOne()).thenReturn(java.util.Optional.of(1));
        operations.nativeSQLScriptRootPath = "path/to/native";
        operations.extensionSQLScriptRootPath = "path/to/extension";
    }

    @Test
    void testInfo_Success() {
        MigrationDAO.ServerChangeLog changeLog = new MigrationDAO.ServerChangeLog();
        changeLog.setVersion("1.0.0");
        changeLog.setInstalledOn("2023-01-01");
        changeLog.setMetrics("{\"records\":100}");

        when(migrationDAO.listMetricsFromDBMigrations()).thenReturn(Arrays.asList(changeLog));
        Integer result = operations.info();
        assertEquals(0, result);
        verify(migrationDAO, times(1)).listMetricsFromDBMigrations();
    }

    @Test
    void testInfo_Exception() {
        when(migrationDAO.listMetricsFromDBMigrations()).thenThrow(new RuntimeException("Database error"));
        Integer result = operations.info();
        assertEquals(1, result);
    }

    @Test
    void testRepair_Success() {
        List<String> failedVersions = Arrays.asList("1.0.1", "1.0.2");
        when(jdbi.withHandle(any())).thenReturn(failedVersions);
        Integer result = operations.repair();
        assertEquals(0, result);
        verify(flyway, times(1)).repair();
        verify(handle, times(1)).createQuery("SELECT version FROM SERVER_CHANGE_LOG WHERE status = 'FAILED'");
        verify(handle, times(1)).createUpdate("DELETE FROM SERVER_CHANGE_LOG WHERE status = 'FAILED'");
        verify(handle, times(2)).createUpdate("DELETE FROM SERVER_MIGRATION_SQL_LOGS WHERE version = :version");
    }

    @Test
    void testRepair_FlywayException() {
        doThrow(new FlywayException("Flyway error")).when(flyway).repair();
        Integer result = operations.repair();
        assertEquals(1, result);
    }

    @Test
    void testRepair_JdbiException() {
        when(jdbi.withHandle(any())).thenThrow(new RuntimeException("JDBI error"));
        Integer result = operations.repair();
        assertEquals(1, result);
    }

    @Test
    void testValidate_Success() {
        when(jdbi.withHandle(any())).thenReturn(new ArrayList<>());
        Integer result = operations.validate();
        assertEquals(0, result);
        verify(flyway, times(1)).validate();
    }

    @Test
    void testValidate_PendingMigrations() {
        List<String> pendingMigrations = Arrays.asList("1.0.1");
        when(jdbi.withHandle(any())).thenReturn(pendingMigrations).thenReturn(new ArrayList<>());
        Integer result = operations.validate();
        assertEquals(1, result);
    }

    @Test
    void testValidate_FailedMigrations() {
        when(jdbi.withHandle(any())).thenReturn(new ArrayList<>()).thenReturn(Arrays.asList("1.0.1"));
        Integer result = operations.validate();
        assertEquals(1, result);
    }

    @Test
    void testValidate_FlywayException() {
        doThrow(new FlywayException("Flyway validation error")).when(flyway).validate();
        Integer result = operations.validate();
        assertEquals(1, result);
    }

    @Test
    void testCheckConnection_Success() throws SQLException {
        Integer result = operations.checkConnection();
        assertEquals(0, result);
        verify(flywayConfiguration.getDataSource(), times(1)).getConnection();
        verify(handle, times(1)).createQuery("SELECT COUNT(*) FROM SERVER_CHANGE_LOG");
        verify(handle, times(1)).createQuery("SELECT COUNT(*) FROM SERVER_MIGRATION_SQL_LOGS");
        verify(connection, times(1)).close();
    }

    @Test
    void testCheckConnection_ServerChangeLogException() throws SQLException {
        when(handle.createQuery("SELECT COUNT(*) FROM SERVER_CHANGE_LOG"))
                .thenThrow(new RuntimeException("Table does not exist"));
        Integer result = operations.checkConnection();
        assertEquals(0, result);
        verify(connection, times(1)).close();
    }

    @Test
    void testCheckConnection_ConnectionException() throws SQLException {
        when(dataSource.getConnection()).thenThrow(new SQLException("Connection error"));
        Integer result = operations.checkConnection();
        assertEquals(1, result);
    }
}
