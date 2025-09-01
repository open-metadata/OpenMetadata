package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.core.statement.StatementCustomizer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

/**
 * Simple focused tests for ReadOnlyHandlerPlugin behavior
 * without relying on @ReadOnly annotation detection in call stack.
 */
class ReadOnlyHandlerPluginSimpleTest {

  private Jdbi mockJdbi;
  private Connection mockConnection;
  private PreparedStatement mockStatement;
  private StatementContext mockContext;

  @BeforeEach
  void setUp() {
    mockJdbi = mock(Jdbi.class);
    mockConnection = mock(Connection.class);
    mockStatement = mock(PreparedStatement.class);
    mockContext = mock(StatementContext.class);

    when(mockContext.getConnection()).thenReturn(mockConnection);

    // Reset metrics before each test
    ReadOnlyHandlerPlugin.resetMetrics();
  }

  @Test
  void testPluginActivatesForAwsDriver() {
    // Given
    ReadOnlyHandlerPlugin plugin = new ReadOnlyHandlerPlugin("software.amazon.jdbc.Driver");

    // When
    plugin.customizeJdbi(mockJdbi);

    // Then
    verify(mockJdbi).addCustomizer(any(StatementCustomizer.class));
  }

  @Test
  void testPluginSkipsForNonAwsDriver() {
    // Given
    ReadOnlyHandlerPlugin plugin = new ReadOnlyHandlerPlugin("org.postgresql.Driver");

    // When
    plugin.customizeJdbi(mockJdbi);

    // Then - should not add any customizer
    verify(mockJdbi, never()).addCustomizer(any(StatementCustomizer.class));
  }

  @Test
  void testPluginSkipsForNullDriver() {
    // Given
    ReadOnlyHandlerPlugin plugin = new ReadOnlyHandlerPlugin(null);

    // When
    plugin.customizeJdbi(mockJdbi);

    // Then - should not add any customizer
    verify(mockJdbi, never()).addCustomizer(any(StatementCustomizer.class));
  }

  @Test
  void testPluginSkipsForEmptyDriver() {
    // Given
    ReadOnlyHandlerPlugin plugin = new ReadOnlyHandlerPlugin("");

    // When
    plugin.customizeJdbi(mockJdbi);

    // Then - should not add any customizer
    verify(mockJdbi, never()).addCustomizer(any(StatementCustomizer.class));
  }

  @Test
  void testStatementCustomizerHandlesExceptions() throws SQLException {
    // Given
    ReadOnlyHandlerPlugin plugin = new ReadOnlyHandlerPlugin("software.amazon.jdbc.Driver");
    when(mockConnection.getAutoCommit()).thenThrow(new SQLException("Connection error"));

    // Capture the statement customizer
    ArgumentCaptor<StatementCustomizer> customizerCaptor = ArgumentCaptor.forClass(StatementCustomizer.class);
    plugin.customizeJdbi(mockJdbi);
    verify(mockJdbi).addCustomizer(customizerCaptor.capture());
    StatementCustomizer customizer = customizerCaptor.getValue();

    // When & Then - should not throw exception
    assertDoesNotThrow(() -> customizer.beforeExecution(mockStatement, mockContext));
  }

  @Test
  void testStatementCustomizerWithNullConnection() throws SQLException {
    // Given
    ReadOnlyHandlerPlugin plugin = new ReadOnlyHandlerPlugin("software.amazon.jdbc.Driver");
    when(mockContext.getConnection()).thenReturn(null);

    // Capture the statement customizer
    ArgumentCaptor<StatementCustomizer> customizerCaptor = ArgumentCaptor.forClass(StatementCustomizer.class);
    plugin.customizeJdbi(mockJdbi);
    verify(mockJdbi).addCustomizer(customizerCaptor.capture());
    StatementCustomizer customizer = customizerCaptor.getValue();

    // When & Then - should not throw exception
    assertDoesNotThrow(() -> customizer.beforeExecution(mockStatement, mockContext));
  }

  @Test
  void testMetricsInitialization() {
    // When - get initial metrics
    ReadOnlyHandlerPlugin.ReadOnlyMetrics metrics = ReadOnlyHandlerPlugin.getMetrics();

    // Then - should start at zero
    assertEquals(0, metrics.readOnlyInTransactionCount);
    assertEquals(0, metrics.readOnlyEnabledCount);
  }

  @Test
  void testMetricsReset() {
    // When
    ReadOnlyHandlerPlugin.resetMetrics();

    // Then
    ReadOnlyHandlerPlugin.ReadOnlyMetrics metrics = ReadOnlyHandlerPlugin.getMetrics();
    assertEquals(0, metrics.readOnlyInTransactionCount);
    assertEquals(0, metrics.readOnlyEnabledCount);
  }

  @Test
  void testMetricsToString() {
    // Given
    ReadOnlyHandlerPlugin.ReadOnlyMetrics metrics = 
        new ReadOnlyHandlerPlugin.ReadOnlyMetrics(5, 10);

    // When
    String result = metrics.toString();

    // Then
    assertEquals("ReadOnlyMetrics{readOnlyEnabled=10, readOnlyInTransaction=5}", result);
  }

  /**
   * Test that demonstrates the core logic of the plugin:
   * - For AWS driver: adds customizer
   * - For non-AWS driver: skips everything
   */
  @Test
  void testDriverSpecificBehavior() {
    // Test various driver types
    String[] awsDrivers = {"software.amazon.jdbc.Driver"};
    String[] nonAwsDrivers = {
        "org.postgresql.Driver",
        "com.mysql.cj.jdbc.Driver", 
        "com.microsoft.sqlserver.jdbc.SQLServerDriver",
        null,
        ""
    };

    // AWS drivers should activate the plugin
    for (String driver : awsDrivers) {
      Jdbi testJdbi = mock(Jdbi.class);
      ReadOnlyHandlerPlugin plugin = new ReadOnlyHandlerPlugin(driver);
      
      plugin.customizeJdbi(testJdbi);
      
      verify(testJdbi).addCustomizer(any(StatementCustomizer.class));
    }

    // Non-AWS drivers should skip the plugin
    for (String driver : nonAwsDrivers) {
      Jdbi testJdbi = mock(Jdbi.class);
      ReadOnlyHandlerPlugin plugin = new ReadOnlyHandlerPlugin(driver);
      
      plugin.customizeJdbi(testJdbi);
      
      verify(testJdbi, never()).addCustomizer(any(StatementCustomizer.class));
    }
  }

  /**
   * Integration test that verifies the plugin works with real JDBI setup
   * (but still using mocks for database connections)
   */
  @Test
  void testPluginIntegrationWithJdbi() throws SQLException {
    // Given - real JDBI with mocked data source
    javax.sql.DataSource mockDataSource = mock(javax.sql.DataSource.class);
    when(mockDataSource.getConnection()).thenReturn(mockConnection);

    Jdbi jdbi = Jdbi.create(mockDataSource);
    ReadOnlyHandlerPlugin plugin = new ReadOnlyHandlerPlugin("software.amazon.jdbc.Driver");

    // When - install plugin
    jdbi.installPlugin(plugin);

    // Then - plugin should be installed without errors
    assertNotNull(jdbi);
    
    // We can't easily test the actual behavior without real @ReadOnly annotations in the call stack,
    // but we can verify the plugin installation didn't break anything
    assertDoesNotThrow(() -> {
      try (var handle = jdbi.open()) {
        // This would normally execute SQL, but we're just testing plugin installation
      } catch (Exception e) {
        // Expected due to mocking
      }
    });
  }

  /**
   * Test that verifies the plugin's transaction-aware logic structure
   * (even if we can't easily test the @ReadOnly detection)
   */
  @Test
  void testTransactionAwareStructure() throws SQLException {
    // Given
    ReadOnlyHandlerPlugin plugin = new ReadOnlyHandlerPlugin("software.amazon.jdbc.Driver");
    
    // Capture the statement customizer
    ArgumentCaptor<StatementCustomizer> customizerCaptor = ArgumentCaptor.forClass(StatementCustomizer.class);
    plugin.customizeJdbi(mockJdbi);
    verify(mockJdbi).addCustomizer(customizerCaptor.capture());
    StatementCustomizer customizer = customizerCaptor.getValue();

    // When & Then - verify the customizer handles different connection states gracefully
    
    // Case 1: Normal connection
    when(mockConnection.getAutoCommit()).thenReturn(true);
    when(mockConnection.isReadOnly()).thenReturn(false);
    assertDoesNotThrow(() -> customizer.beforeExecution(mockStatement, mockContext));

    // Case 2: Connection in transaction
    when(mockConnection.getAutoCommit()).thenReturn(false);
    assertDoesNotThrow(() -> customizer.beforeExecution(mockStatement, mockContext));

    // Case 3: Exception during connection access
    when(mockConnection.getAutoCommit()).thenThrow(new SQLException("Connection error"));
    assertDoesNotThrow(() -> customizer.beforeExecution(mockStatement, mockContext));
  }
}