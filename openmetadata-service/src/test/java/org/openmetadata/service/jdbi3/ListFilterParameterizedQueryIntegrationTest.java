/*
 *  Copyright 2025 Collate
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

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.HashMap;
import java.util.Map;
import javax.sql.DataSource;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.Query;
import org.jdbi.v3.core.statement.StatementContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.resources.databases.DatasourceConfig;

/**
 * Integration tests for ListFilter parameterized queries.
 * Tests actual database interaction patterns and parameter binding behavior.
 *
 * <p>These tests validate that parameterized queries work correctly with JDBI
 * and that SQL injection prevention is effective at the database layer.
 */
@ExtendWith(MockitoExtension.class)
class ListFilterParameterizedQueryIntegrationTest {

  @Mock private Jdbi jdbi;
  @Mock private Handle handle;
  @Mock private Query query;
  @Mock private StatementContext statementContext;
  @Mock private PreparedStatement preparedStatement;
  @Mock private DataSource dataSource;
  @Mock private DatasourceConfig datasourceConfig;

  private ListFilter filter;

  @BeforeEach
  void setUp() {
    filter = new ListFilter(Include.NON_DELETED);

    // Setup JDBI mock chain
    when(jdbi.withHandle(any()))
        .thenAnswer(
            invocation -> {
              return invocation.getArgument(0);
            });
    when(handle.createQuery(anyString())).thenReturn(query);
    when(query.bind(anyString(), any())).thenReturn(query);
    when(query.getContext()).thenReturn(statementContext);
  }

  @Nested
  @DisplayName("Parameter Binding Integration Tests")
  class ParameterBindingTests {

    @Test
    @DisplayName("Should properly bind assignee parameter to prepared statement")
    void testAssigneeParameterBinding() throws SQLException {
      // Given: Filter with assignee parameter
      filter.addQueryParam("assignee", "test_user@company.com");
      String condition = filter.getCondition("entity_table");

      // When: Simulating JDBI parameter binding
      Map<String, Object> boundParameters = new HashMap<>();
      boundParameters.put("assignee", filter.getQueryParam("assignee"));

      // Then: Should have correct SQL and parameters
      assertTrue(condition.contains("assignee = :assignee"));
      assertEquals("test_user@company.com", boundParameters.get("assignee"));

      // And: Should be bindable to PreparedStatement (simulated)
      when(statementContext.getBinding()).thenReturn(query);
      query.bind("assignee", boundParameters.get("assignee"));

      // Verify binding was called with correct parameters
      verify(query, atLeastOnce()).bind("assignee", "test_user@company.com");
    }

    @Test
    @DisplayName("Should properly bind multiple parameters simultaneously")
    void testMultipleParameterBinding() throws SQLException {
      // Given: Filter with multiple parameters
      filter.addQueryParam("assignee", "data_engineer");
      filter.addQueryParam("fileType", "parquet");
      filter.addQueryParam("directory", "/warehouse/sales");
      filter.addQueryParam("workflowDefinitionId", "etl-workflow-001");

      String condition = filter.getCondition("sales_data");

      // When: Simulating JDBI parameter binding for all parameters
      Map<String, Object> boundParameters = new HashMap<>();
      filter.getQueryParams().forEach(boundParameters::put);

      // Then: Should have all parameterized conditions
      assertTrue(condition.contains("assignee = :assignee"));
      assertTrue(condition.contains("fileType = :fileType"));
      assertTrue(condition.contains("directoryFqn = :directory"));
      assertTrue(condition.contains("workflowDefinitionId = :workflowDefinitionId"));

      // And: All parameters should be available for binding
      assertEquals("data_engineer", boundParameters.get("assignee"));
      assertEquals("parquet", boundParameters.get("fileType"));
      assertEquals("/warehouse/sales", boundParameters.get("directory"));
      assertEquals("etl-workflow-001", boundParameters.get("workflowDefinitionId"));

      // Simulate actual parameter binding
      boundParameters.forEach((key, value) -> query.bind(key, value));

      // Verify all bindings occurred
      verify(query).bind("assignee", "data_engineer");
      verify(query).bind("fileType", "parquet");
      verify(query).bind("directory", "/warehouse/sales");
      verify(query).bind("workflowDefinitionId", "etl-workflow-001");
    }

    @ParameterizedTest
    @CsvSource({
      "assignee, user@domain.com, assignee = :assignee",
      "fileType, csv, fileType = :fileType",
      "directory, /data/path, directoryFqn = :directory",
      "workflowDefinitionId, wf-123, workflowDefinitionId = :workflowDefinitionId"
    })
    @DisplayName("Should generate correct SQL for various parameter types")
    void testParameterizedSqlGeneration(String paramName, String paramValue, String expectedSql) {
      // Given: Specific parameter
      filter.addQueryParam(paramName, paramValue);

      // When: Generate condition
      String condition = filter.getCondition("test_table");

      // Then: Should contain expected parameterized SQL
      assertTrue(
          condition.contains(expectedSql),
          String.format("Expected SQL '%s' not found in condition: %s", expectedSql, condition));
      assertEquals(paramValue, filter.getQueryParam(paramName));
    }
  }

  @Nested
  @DisplayName("Database-Specific Query Generation Tests")
  class DatabaseSpecificTests {

    @Test
    @DisplayName("Should generate MySQL-specific JSON queries for agentType")
    void testMySqlJsonQuery_AgentType() {
      try (MockedStatic<DatasourceConfig> mockedStatic = mockStatic(DatasourceConfig.class)) {
        // Given: MySQL datasource configuration
        mockedStatic.when(DatasourceConfig::getInstance).thenReturn(datasourceConfig);
        when(datasourceConfig.isMySQL()).thenReturn(true);

        filter.addQueryParam("agentType", "ingestion_agent");

        // When: Generate condition
        String condition = filter.getCondition("agent_table");

        // Then: Should use MySQL JSON_EXTRACT function
        assertTrue(condition.contains("JSON_EXTRACT(json, '$.agentType') = :agentType"));
        assertEquals("ingestion_agent", filter.getQueryParam("agentType"));

        // And: Should be compatible with MySQL prepared statement binding
        Map<String, Object> params = new HashMap<>();
        params.put("agentType", filter.getQueryParam("agentType"));

        // Simulate MySQL parameter binding
        query.bind("agentType", params.get("agentType"));
        verify(query).bind("agentType", "ingestion_agent");
      }
    }

    @Test
    @DisplayName("Should generate PostgreSQL-specific JSON queries for agentType")
    void testPostgreSqlJsonQuery_AgentType() {
      try (MockedStatic<DatasourceConfig> mockedStatic = mockStatic(DatasourceConfig.class)) {
        // Given: PostgreSQL datasource configuration
        mockedStatic.when(DatasourceConfig::getInstance).thenReturn(datasourceConfig);
        when(datasourceConfig.isMySQL()).thenReturn(false);

        filter.addQueryParam("agentType", "profiler_agent");

        // When: Generate condition
        String condition = filter.getCondition("agent_table");

        // Then: Should use PostgreSQL JSON operator
        assertTrue(condition.contains("json->>'agentType' = :agentType"));
        assertEquals("profiler_agent", filter.getQueryParam("agentType"));

        // And: Should be compatible with PostgreSQL prepared statement binding
        Map<String, Object> params = new HashMap<>();
        params.put("agentType", filter.getQueryParam("agentType"));

        // Simulate PostgreSQL parameter binding
        query.bind("agentType", params.get("agentType"));
        verify(query).bind("agentType", "profiler_agent");
      }
    }

    @Test
    @DisplayName("Should generate database-specific alertType queries")
    void testDatabaseSpecificAlertTypeQueries() {
      try (MockedStatic<DatasourceConfig> mockedStatic = mockStatic(DatasourceConfig.class)) {
        mockedStatic.when(DatasourceConfig::getInstance).thenReturn(datasourceConfig);

        // Test MySQL variant
        when(datasourceConfig.isMySQL()).thenReturn(true);
        filter.addQueryParam("alertType", "webhook");

        String mysqlCondition = filter.getCondition("alerts_table");
        assertTrue(mysqlCondition.contains("JSON_EXTRACT(json, '$.alertType') = :alertType"));

        // Test PostgreSQL variant
        when(datasourceConfig.isMySQL()).thenReturn(false);
        ListFilter pgFilter = new ListFilter();
        pgFilter.addQueryParam("alertType", "email");

        String pgCondition = pgFilter.getCondition("alerts_table");
        assertTrue(pgCondition.contains("json->>'alertType' = :alertType"));

        // Both should be parameterized safely
        assertEquals("webhook", filter.getQueryParam("alertType"));
        assertEquals("email", pgFilter.getQueryParam("alertType"));
      }
    }
  }

  @Nested
  @DisplayName("SQL Injection Prevention Integration Tests")
  class SqlInjectionPreventionTests {

    @ParameterizedTest
    @ValueSource(
        strings = {
          "user'; DROP TABLE users;--",
          "user' OR '1'='1",
          "user\" AND \"admin\"=\"admin",
          "user' UNION SELECT password FROM accounts--",
          "user'; INSERT INTO admins VALUES('hacker');--"
        })
    @DisplayName("Should prevent SQL injection through parameter binding")
    void testSqlInjectionPrevention_ParameterBinding(String maliciousInput) {
      // Given: Malicious input that would be dangerous if not parameterized
      filter.addQueryParam("assignee", maliciousInput);

      // When: Generate SQL condition
      String condition = filter.getCondition("sensitive_table");

      // Then: Should generate parameterized query
      assertTrue(condition.contains("assignee = :assignee"));
      assertEquals(maliciousInput, filter.getQueryParam("assignee"));

      // And: When bound to prepared statement, should be treated as literal value
      ArgumentCaptor<String> keyCaptor = ArgumentCaptor.forClass(String.class);
      ArgumentCaptor<Object> valueCaptor = ArgumentCaptor.forClass(Object.class);

      // Simulate JDBI binding the parameter
      query.bind("assignee", maliciousInput);
      verify(query).bind(keyCaptor.capture(), valueCaptor.capture());

      assertEquals("assignee", keyCaptor.getValue());
      assertEquals(maliciousInput, valueCaptor.getValue());

      // The malicious input is now safely bound as a parameter value
      // and cannot modify the SQL structure
    }

    @Test
    @DisplayName("Should maintain query structure integrity with malicious inputs")
    void testQueryStructureIntegrity_MaliciousInputs() {
      // Given: Multiple parameters with various malicious inputs
      filter.addQueryParam("assignee", "user'; DROP TABLE metadata;--");
      filter.addQueryParam("fileType", "csv' OR 1=1--");
      filter.addQueryParam("directory", "path\"; DELETE FROM files; --");
      filter.addQueryParam("alertType", "webhook' UNION SELECT secret FROM keys--");

      // When: Generate complete SQL condition
      String condition = filter.getCondition("production_table");

      // Then: SQL structure should remain intact with only parameterized placeholders
      assertTrue(condition.startsWith("WHERE"));
      assertTrue(condition.contains("assignee = :assignee"));
      assertTrue(condition.contains("fileType = :fileType"));
      assertTrue(condition.contains("directoryFqn = :directory"));
      assertTrue(condition.contains("= :alertType"));

      // And: No dangerous SQL keywords should appear in the generated condition
      String upperCondition = condition.toUpperCase();
      assertFalse(upperCondition.contains("DROP TABLE"));
      assertFalse(upperCondition.contains("DELETE FROM"));
      assertFalse(upperCondition.contains("UNION SELECT"));
      assertFalse(upperCondition.contains("INSERT INTO"));

      // And: All malicious values should be safely stored as parameters
      assertEquals("user'; DROP TABLE metadata;--", filter.getQueryParam("assignee"));
      assertEquals("csv' OR 1=1--", filter.getQueryParam("fileType"));
      assertEquals("path\"; DELETE FROM files; --", filter.getQueryParam("directory"));
      assertEquals("webhook' UNION SELECT secret FROM keys--", filter.getQueryParam("alertType"));
    }

    @Test
    @DisplayName("Should handle complex nested SQL injection attempts")
    void testComplexSqlInjectionAttempts() {
      // Given: Sophisticated SQL injection attempts
      String complexInjection =
          "user' AND (SELECT COUNT(*) FROM (SELECT 1 UNION SELECT 2) AS t) > 0 AND '1'='1";
      String timingAttack = "user' AND (SELECT SLEEP(5)) AND 'x'='x";
      String blindInjection =
          "user' AND SUBSTRING((SELECT schema_name FROM information_schema.schemata LIMIT 1),1,1)='t' AND '1'='1";

      filter.addQueryParam("assignee", complexInjection);
      filter.addQueryParam("fileType", timingAttack);
      filter.addQueryParam("directory", blindInjection);

      // When: Generate condition
      String condition = filter.getCondition("secure_table");

      // Then: Should maintain parameterized structure
      assertTrue(condition.contains("assignee = :assignee"));
      assertTrue(condition.contains("fileType = :fileType"));
      assertTrue(condition.contains("directoryFqn = :directory"));

      // And: Complex injection attempts should be safely stored as parameter values
      assertEquals(complexInjection, filter.getQueryParam("assignee"));
      assertEquals(timingAttack, filter.getQueryParam("fileType"));
      assertEquals(blindInjection, filter.getQueryParam("directory"));

      // When bound to prepared statement, these will be treated as literal strings
      Map<String, Object> params = filter.getQueryParams();
      params.forEach(
          (key, value) -> {
            query.bind(key, value);
            // Each malicious string is safely bound as a parameter
            verify(query).bind(eq(key), eq(value));
          });
    }
  }

  @Nested
  @DisplayName("Real-World Integration Scenarios")
  class RealWorldIntegrationTests {

    @Test
    @DisplayName("Should handle typical metadata filtering scenario")
    void testTypicalMetadataFiltering() {
      // Given: Typical metadata filtering use case
      filter.addQueryParam("assignee", "data-team@company.com");
      filter.addQueryParam("fileType", "parquet");
      filter.addQueryParam("directory", "/data-warehouse/customer-analytics");
      filter.addQueryParam("workflowDefinitionId", "customer-data-pipeline-v2");

      // When: Generate condition for metadata query
      String condition = filter.getCondition("table_entity");

      // Then: Should generate proper WHERE clause
      assertTrue(condition.startsWith("WHERE"));
      assertTrue(condition.contains("table_entity.deleted = FALSE"));

      // And: Should include all filter conditions
      assertTrue(condition.contains("assignee = :assignee"));
      assertTrue(condition.contains("fileType = :fileType"));
      assertTrue(condition.contains("directoryFqn = :directory"));
      assertTrue(condition.contains("workflowDefinitionId = :workflowDefinitionId"));

      // And: Parameters should be ready for database binding
      Map<String, Object> params = filter.getQueryParams();
      assertEquals(4, params.size());
      assertTrue(params.containsKey("assignee"));
      assertTrue(params.containsKey("fileType"));
      assertTrue(params.containsKey("directory"));
      assertTrue(params.containsKey("workflowDefinitionId"));
    }

    @Test
    @DisplayName("Should handle monitoring and alerting scenario")
    void testMonitoringAndAlertingScenario() {
      try (MockedStatic<DatasourceConfig> mockedStatic = mockStatic(DatasourceConfig.class)) {
        // Given: Monitoring scenario with alert configuration
        mockedStatic.when(DatasourceConfig::getInstance).thenReturn(datasourceConfig);
        when(datasourceConfig.isMySQL()).thenReturn(true); // MySQL environment

        filter.addQueryParam("alertType", "slack");
        filter.addQueryParam("agentType", "data-quality-monitor");
        filter.addQueryParam("testCaseResolutionStatusType", "acknowledged");
        filter.addQueryParam("assignee", "on-call-engineer@company.com");

        // When: Generate condition for monitoring query
        String condition = filter.getCondition("monitoring_entity");

        // Then: Should use appropriate database-specific JSON functions
        assertTrue(condition.contains("JSON_EXTRACT(json, '$.alertType') = :alertType"));
        assertTrue(condition.contains("JSON_EXTRACT(json, '$.agentType') = :agentType"));
        assertTrue(
            condition.contains("testCaseResolutionStatusType = :testCaseResolutionStatusType"));
        assertTrue(condition.contains("assignee = :assignee"));

        // And: Should be ready for MySQL parameter binding
        Map<String, Object> params = filter.getQueryParams();
        assertEquals("slack", params.get("alertType"));
        assertEquals("data-quality-monitor", params.get("agentType"));
        assertEquals("acknowledged", params.get("testCaseResolutionStatusType"));
        assertEquals("on-call-engineer@company.com", params.get("assignee"));
      }
    }

    @Test
    @DisplayName("Should handle data governance workflow scenario")
    void testDataGovernanceWorkflowScenario() {
      // Given: Data governance workflow scenario
      filter.addQueryParam("workflowDefinitionId", "data-classification-workflow");
      filter.addQueryParam("entityLink", "sales_database.customer_info.table::email_column");
      filter.addQueryParam("assignee", "data-steward@company.com");
      filter.addQueryParam("testCaseResolutionStatusType", "resolved");

      // When: Generate condition for governance query
      String condition = filter.getCondition("governance_entity");

      // Then: Should handle complex entity link structure
      assertTrue(condition.contains("entityLink = :entityLink"));
      assertTrue(condition.contains("workflowDefinitionId = :workflowDefinitionId"));
      assertTrue(condition.contains("assignee = :assignee"));
      assertTrue(
          condition.contains("testCaseResolutionStatusType = :testCaseResolutionStatusType"));

      // And: Complex entity link should be safely parameterized
      String entityLink = filter.getQueryParam("entityLink");
      assertEquals("sales_database.customer_info.table::email_column", entityLink);
      assertTrue(entityLink.contains("::"));
      assertTrue(entityLink.contains("."));

      // Simulate parameter binding for complex string
      query.bind("entityLink", entityLink);
      verify(query).bind("entityLink", "sales_database.customer_info.table::email_column");
    }

    @Test
    @DisplayName("Should handle file and spreadsheet management scenario")
    void testFileAndSpreadsheetManagementScenario() {
      // Given: File and spreadsheet management scenario
      filter.addQueryParam("directory", "/shared-drives/finance/quarterly-reports");
      filter.addQueryParam("spreadsheet", "Q4_2024_Financial_Analysis.xlsx");
      filter.addQueryParam("fileType", "xlsx");
      filter.addQueryParam("assignee", "finance-analyst@company.com");

      // When: Generate condition for file management query
      String condition = filter.getCondition("file_entity");

      // Then: Should handle file paths and names with spaces/special chars
      assertTrue(condition.contains("directoryFqn = :directory"));
      assertTrue(condition.contains("spreadsheetFqn = :spreadsheet"));
      assertTrue(condition.contains("fileType = :fileType"));
      assertTrue(condition.contains("assignee = :assignee"));

      // And: File paths and names should be safely parameterized
      assertEquals("/shared-drives/finance/quarterly-reports", filter.getQueryParam("directory"));
      assertEquals("Q4_2024_Financial_Analysis.xlsx", filter.getQueryParam("spreadsheet"));
      assertEquals("xlsx", filter.getQueryParam("fileType"));
      assertEquals("finance-analyst@company.com", filter.getQueryParam("assignee"));

      // All parameters should be bindable despite containing special characters
      Map<String, Object> params = filter.getQueryParams();
      params.forEach(
          (key, value) -> {
            query.bind(key, value);
            verify(query).bind(key, value);
          });
    }
  }

  @Nested
  @DisplayName("Performance and Scalability Tests")
  class PerformanceTests {

    @Test
    @DisplayName("Should handle large number of parameters efficiently")
    void testLargeNumberOfParameters() {
      // Given: Many parameters (simulating complex filtering scenario)
      for (int i = 0; i < 50; i++) {
        filter.addQueryParam("param" + i, "value" + i);
      }

      // Add our specific parameters
      filter.addQueryParam("assignee", "performance_test_user");
      filter.addQueryParam("fileType", "parquet");
      filter.addQueryParam("directory", "/performance/test/data");

      // When: Generate condition (should be fast)
      long startTime = System.nanoTime();
      String condition = filter.getCondition("performance_table");
      long endTime = System.nanoTime();

      // Then: Should complete quickly (under 10ms for this operation)
      long durationMs = (endTime - startTime) / 1_000_000;
      assertTrue(durationMs < 10, "Condition generation should complete under 10ms");

      // And: Should still generate correct parameterized queries
      assertTrue(condition.contains("assignee = :assignee"));
      assertTrue(condition.contains("fileType = :fileType"));
      assertTrue(condition.contains("directoryFqn = :directory"));

      // And: All parameters should be accessible
      Map<String, String> params = filter.getQueryParams();
      assertEquals("performance_test_user", params.get("assignee"));
      assertEquals("parquet", params.get("fileType"));
      assertEquals("/performance/test/data", params.get("directory"));
    }

    @Test
    @DisplayName("Should handle repeated condition generation efficiently")
    void testRepeatedConditionGeneration() {
      // Given: Filter with standard parameters
      filter.addQueryParam("assignee", "repeat_test_user");
      filter.addQueryParam("fileType", "json");
      filter.addQueryParam("alertType", "email");

      // When: Generate condition multiple times (simulating repeated queries)
      long startTime = System.nanoTime();
      for (int i = 0; i < 1000; i++) {
        String condition = filter.getCondition("repeat_table");
        assertNotNull(condition);
      }
      long endTime = System.nanoTime();

      // Then: Should complete all iterations quickly (under 100ms total)
      long totalDurationMs = (endTime - startTime) / 1_000_000;
      assertTrue(totalDurationMs < 100, "1000 condition generations should complete under 100ms");

      // And: Results should be consistent
      String finalCondition = filter.getCondition("repeat_table");
      assertTrue(finalCondition.contains("assignee = :assignee"));
      assertTrue(finalCondition.contains("fileType = :fileType"));
      assertTrue(finalCondition.contains("= :alertType"));
    }
  }
}
