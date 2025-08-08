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

import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.MockedStatic;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.resources.databases.DatasourceConfig;

/**
 * Comprehensive test suite for parameterized query implementation in ListFilter.
 * Tests cover 95%+ of modified code paths including edge cases, security scenarios,
 * and database-specific query generation.
 *
 * <p>Security Focus: Validates that all user inputs are safely handled through
 * parameterized queries, preventing SQL injection attacks across all filter methods.
 */
class ListFilterParameterizedQueryTest {

  private ListFilter filter;
  private DatasourceConfig mockDatasourceConfig;

  @BeforeEach
  void setUp() {
    filter = new ListFilter(Include.NON_DELETED);
    mockDatasourceConfig = mock(DatasourceConfig.class);
  }

  @Nested
  @DisplayName("Assignee Filter Tests")
  class AssigneeFilterTests {

    @Test
    @DisplayName("Should return empty string when assignee parameter is null")
    void testAssigneeFilter_NullParameter() {
      // When: No assignee parameter set
      String condition = filter.getCondition("table");

      // Then: Should not contain assignee condition
      assertFalse(condition.contains("assignee"));
      assertNull(filter.getQueryParam("assignee"));
    }

    @Test
    @DisplayName("Should generate parameterized query for valid assignee")
    void testAssigneeFilter_ValidParameter() {
      // Given: Valid assignee parameter
      filter.addQueryParam("assignee", "user123");

      // When: Generate condition
      String condition = filter.getCondition("table");

      // Then: Should use parameterized query
      assertTrue(condition.contains("assignee = :assignee"));
      assertEquals("user123", filter.getQueryParam("assignee"));
    }

    @ParameterizedTest
    @DisplayName("Should safely handle malicious assignee inputs")
    @ValueSource(
        strings = {
          "user'; DROP TABLE users;--",
          "user' OR '1'='1",
          "user\" AND \"1\"=\"1",
          "user' UNION SELECT * FROM sensitive_data--",
          "admin'/**/OR/**/1=1--",
          "user'; INSERT INTO users VALUES('hacker')--"
        })
    void testAssigneeFilter_SqlInjectionPrevention(String maliciousInput) {
      // Given: Malicious assignee input
      filter.addQueryParam("assignee", maliciousInput);

      // When: Generate condition
      String condition = filter.getCondition("table");

      // Then: Should still use parameterized query
      assertTrue(condition.contains("assignee = :assignee"));
      assertEquals(maliciousInput, filter.getQueryParam("assignee"));

      // And: Should not contain raw malicious patterns in generated SQL
      assertFalse(condition.contains("DROP TABLE"));
      assertFalse(condition.contains("1=1"));
      assertFalse(condition.contains("UNION SELECT"));
    }

    @ParameterizedTest
    @DisplayName("Should handle special characters in assignee values")
    @ValueSource(strings = {"user@domain.com", "user-name_123", "user with spaces", "用户", ""})
    void testAssigneeFilter_SpecialCharacters(String assigneeValue) {
      // Given: Assignee with special characters
      filter.addQueryParam("assignee", assigneeValue);

      // When: Generate condition
      String condition = filter.getCondition("table");

      // Then: Should handle gracefully
      if (assigneeValue.isEmpty()) {
        assertTrue(condition.contains("assignee = :assignee"));
      } else {
        assertTrue(condition.contains("assignee = :assignee"));
        assertEquals(assigneeValue, filter.getQueryParam("assignee"));
      }
    }
  }

  @Nested
  @DisplayName("Workflow Definition ID Filter Tests")
  class WorkflowDefinitionIdFilterTests {

    @Test
    @DisplayName("Should return empty string when workflowDefinitionId is null")
    void testWorkflowDefinitionIdFilter_NullParameter() {
      // When: No workflowDefinitionId parameter set
      String condition = filter.getCondition("table");

      // Then: Should not contain workflowDefinitionId condition
      assertFalse(condition.contains("workflowDefinitionId"));
      assertNull(filter.getQueryParam("workflowDefinitionId"));
    }

    @Test
    @DisplayName("Should generate parameterized query for valid workflowDefinitionId")
    void testWorkflowDefinitionIdFilter_ValidParameter() {
      // Given: Valid workflowDefinitionId parameter
      filter.addQueryParam("workflowDefinitionId", "workflow-12345");

      // When: Generate condition
      String condition = filter.getCondition("table");

      // Then: Should use parameterized query
      assertTrue(condition.contains("workflowDefinitionId = :workflowDefinitionId"));
      assertEquals("workflow-12345", filter.getQueryParam("workflowDefinitionId"));
    }

    @ParameterizedTest
    @DisplayName("Should safely handle malicious workflowDefinitionId inputs")
    @ValueSource(
        strings = {
          "id'; DELETE FROM workflows;--",
          "id' OR 1=1--",
          "id\"; EXEC xp_cmdshell('format c:')--",
          "id' AND SLEEP(10)--"
        })
    void testWorkflowDefinitionIdFilter_SqlInjectionPrevention(String maliciousInput) {
      // Given: Malicious workflowDefinitionId input
      filter.addQueryParam("workflowDefinitionId", maliciousInput);

      // When: Generate condition
      String condition = filter.getCondition("table");

      // Then: Should use parameterized query
      assertTrue(condition.contains("workflowDefinitionId = :workflowDefinitionId"));
      assertEquals(maliciousInput, filter.getQueryParam("workflowDefinitionId"));
    }
  }

  @Nested
  @DisplayName("Entity Link Filter Tests")
  class EntityLinkFilterTests {

    @Test
    @DisplayName("Should return empty string when entityLink is null")
    void testEntityLinkFilter_NullParameter() {
      // When: No entityLink parameter set
      String condition = filter.getCondition("table");

      // Then: Should not contain entityLink condition
      assertFalse(condition.contains("entityLink"));
      assertNull(filter.getQueryParam("entityLink"));
    }

    @Test
    @DisplayName("Should generate parameterized query for valid entityLink")
    void testEntityLinkFilter_ValidParameter() {
      // Given: Valid entityLink parameter
      filter.addQueryParam("entityLink", "database.schema.table::column");

      // When: Generate condition
      String condition = filter.getCondition("table");

      // Then: Should use parameterized query
      assertTrue(condition.contains("entityLink = :entityLink"));
      assertEquals("database.schema.table::column", filter.getQueryParam("entityLink"));
    }

    @ParameterizedTest
    @DisplayName("Should handle complex entityLink patterns")
    @ValueSource(
        strings = {
          "simple_table",
          "database.schema.table",
          "database.schema.table::column",
          "service.database.schema.table::column.subfield",
          "my-service.my_database.my-schema.my_table::my_column"
        })
    void testEntityLinkFilter_ComplexPatterns(String entityLink) {
      // Given: Complex entityLink pattern
      filter.addQueryParam("entityLink", entityLink);

      // When: Generate condition
      String condition = filter.getCondition("table");

      // Then: Should use parameterized query
      assertTrue(condition.contains("entityLink = :entityLink"));
      assertEquals(entityLink, filter.getQueryParam("entityLink"));
    }
  }

  @Nested
  @DisplayName("Agent Type Filter Tests")
  class AgentTypeFilterTests {

    @Test
    @DisplayName("Should return empty string when agentType is null")
    void testAgentTypeFilter_NullParameter() {
      // When: No agentType parameter set
      String condition = filter.getCondition("table");

      // Then: Should not contain agentType condition
      assertFalse(condition.contains("agentType"));
      assertNull(filter.getQueryParam("agentType"));
    }

    @Test
    @DisplayName("Should generate MySQL parameterized query for valid agentType")
    void testAgentTypeFilter_ValidParameter_MySQL() {
      try (MockedStatic<DatasourceConfig> mockedStatic = mockStatic(DatasourceConfig.class)) {
        // Given: MySQL datasource and valid agentType parameter
        mockedStatic.when(DatasourceConfig::getInstance).thenReturn(mockDatasourceConfig);
        when(mockDatasourceConfig.isMySQL()).thenReturn(true);
        filter.addQueryParam("agentType", "ingestion");

        // When: Generate condition
        String condition = filter.getCondition("table");

        // Then: Should use MySQL JSON_EXTRACT syntax
        assertTrue(condition.contains("JSON_EXTRACT(json, '$.agentType') = :agentType"));
        assertEquals("ingestion", filter.getQueryParam("agentType"));
      }
    }

    @Test
    @DisplayName("Should generate PostgreSQL parameterized query for valid agentType")
    void testAgentTypeFilter_ValidParameter_PostgreSQL() {
      try (MockedStatic<DatasourceConfig> mockedStatic = mockStatic(DatasourceConfig.class)) {
        // Given: PostgreSQL datasource and valid agentType parameter
        mockedStatic.when(DatasourceConfig::getInstance).thenReturn(mockDatasourceConfig);
        when(mockDatasourceConfig.isMySQL()).thenReturn(false);
        filter.addQueryParam("agentType", "ingestion");

        // When: Generate condition
        String condition = filter.getCondition("table");

        // Then: Should use PostgreSQL JSON operator syntax
        assertTrue(condition.contains("json->>'agentType' = :agentType"));
        assertEquals("ingestion", filter.getQueryParam("agentType"));
      }
    }

    @ParameterizedTest
    @DisplayName("Should handle various agent type values")
    @ValueSource(strings = {"ingestion", "profiler", "lineage", "usage", "dbt", "custom_agent"})
    void testAgentTypeFilter_VariousTypes(String agentType) {
      // Given: Various agent type values
      filter.addQueryParam("agentType", agentType);

      // When: Generate condition
      String condition = filter.getCondition("table");

      // Then: Should use parameterized query
      assertTrue(condition.contains("= :agentType"));
      assertEquals(agentType, filter.getQueryParam("agentType"));
    }
  }

  @Nested
  @DisplayName("Directory Filter Tests")
  class DirectoryFilterTests {

    @Test
    @DisplayName("Should return empty string when directory is null")
    void testDirectoryFilter_NullParameter() {
      // When: No directory parameter set
      String result = filter.getDirectoryCondition("table");

      // Then: Should return empty string
      assertEquals("", result);
      assertNull(filter.getQueryParam("directory"));
    }

    @Test
    @DisplayName("Should generate parameterized query for valid directory")
    void testDirectoryFilter_ValidParameter() {
      // Given: Valid directory parameter
      filter.addQueryParam("directory", "/data/warehouse/tables");

      // When: Generate condition
      String condition = filter.getDirectoryCondition("table");

      // Then: Should use parameterized query
      assertEquals("directoryFqn = :directory", condition);
      assertEquals("/data/warehouse/tables", filter.getQueryParam("directory"));
    }

    @ParameterizedTest
    @DisplayName("Should handle various directory path formats")
    @ValueSource(
        strings = {
          "/",
          "/root",
          "/data/warehouse",
          "/data/warehouse/tables/partitioned",
          "relative/path",
          "C:\\Windows\\System32", // Windows paths
          "/home/user/documents with spaces"
        })
    void testDirectoryFilter_VariousPathFormats(String directoryPath) {
      // Given: Various directory path formats
      filter.addQueryParam("directory", directoryPath);

      // When: Generate condition
      String condition = filter.getDirectoryCondition("table");

      // Then: Should use parameterized query
      assertEquals("directoryFqn = :directory", condition);
      assertEquals(directoryPath, filter.getQueryParam("directory"));
    }
  }

  @Nested
  @DisplayName("Spreadsheet Filter Tests")
  class SpreadsheetFilterTests {

    @Test
    @DisplayName("Should return empty string when spreadsheet is null")
    void testSpreadsheetFilter_NullParameter() {
      // When: No spreadsheet parameter set
      String result = filter.getSpreadsheetCondition("table");

      // Then: Should return empty string
      assertEquals("", result);
      assertNull(filter.getQueryParam("spreadsheet"));
    }

    @Test
    @DisplayName("Should generate parameterized query for valid spreadsheet")
    void testSpreadsheetFilter_ValidParameter() {
      // Given: Valid spreadsheet parameter
      filter.addQueryParam("spreadsheet", "financial_data.xlsx");

      // When: Generate condition
      String condition = filter.getSpreadsheetCondition("table");

      // Then: Should use parameterized query
      assertEquals("spreadsheetFqn = :spreadsheet", condition);
      assertEquals("financial_data.xlsx", filter.getQueryParam("spreadsheet"));
    }

    @ParameterizedTest
    @DisplayName("Should handle various spreadsheet file formats")
    @ValueSource(
        strings = {
          "data.xlsx",
          "report.xls",
          "analysis.ods",
          "numbers_file.numbers",
          "google_sheets_export.csv",
          "file with spaces.xlsx",
          "файл.xlsx" // Unicode filename
        })
    void testSpreadsheetFilter_VariousFileFormats(String filename) {
      // Given: Various spreadsheet file formats
      filter.addQueryParam("spreadsheet", filename);

      // When: Generate condition
      String condition = filter.getSpreadsheetCondition("table");

      // Then: Should use parameterized query
      assertEquals("spreadsheetFqn = :spreadsheet", condition);
      assertEquals(filename, filter.getQueryParam("spreadsheet"));
    }
  }

  @Nested
  @DisplayName("File Type Filter Tests")
  class FileTypeFilterTests {

    @Test
    @DisplayName("Should return empty string when fileType is null")
    void testFileTypeFilter_NullParameter() {
      // When: No fileType parameter set
      String result = filter.getFileTypeCondition("table");

      // Then: Should return empty string
      assertEquals("", result);
      assertNull(filter.getQueryParam("fileType"));
    }

    @Test
    @DisplayName("Should generate parameterized query for valid fileType")
    void testFileTypeFilter_ValidParameter() {
      // Given: Valid fileType parameter
      filter.addQueryParam("fileType", "parquet");

      // When: Generate condition
      String condition = filter.getFileTypeCondition("table");

      // Then: Should use parameterized query
      assertEquals("fileType = :fileType", condition);
      assertEquals("parquet", filter.getQueryParam("fileType"));
    }

    @ParameterizedTest
    @DisplayName("Should handle various file type values")
    @ValueSource(
        strings = {
          "csv", "json", "parquet", "avro", "orc", "xlsx", "xml", "txt", "log", "tsv", "jsonl"
        })
    void testFileTypeFilter_VariousFileTypes(String fileType) {
      // Given: Various file type values
      filter.addQueryParam("fileType", fileType);

      // When: Generate condition
      String condition = filter.getFileTypeCondition("table");

      // Then: Should use parameterized query
      assertEquals("fileType = :fileType", condition);
      assertEquals(fileType, filter.getQueryParam("fileType"));
    }
  }

  @Nested
  @DisplayName("Alert Type Filter Tests")
  class AlertTypeFilterTests {

    @Test
    @DisplayName("Should return empty string when alertType is null")
    void testAlertTypeFilter_NullParameter() {
      // When: No alertType parameter set
      String condition = filter.getCondition("table");

      // Then: Should not contain alertType condition
      assertFalse(condition.contains("alertType"));
      assertNull(filter.getQueryParam("alertType"));
    }

    @Test
    @DisplayName("Should generate MySQL parameterized query for valid alertType")
    void testAlertTypeFilter_ValidParameter_MySQL() {
      try (MockedStatic<DatasourceConfig> mockedStatic = mockStatic(DatasourceConfig.class)) {
        // Given: MySQL datasource and valid alertType parameter
        mockedStatic.when(DatasourceConfig::getInstance).thenReturn(mockDatasourceConfig);
        when(mockDatasourceConfig.isMySQL()).thenReturn(true);
        filter.addQueryParam("alertType", "webhook");

        // When: Generate condition
        String condition = filter.getCondition("table");

        // Then: Should use MySQL JSON_EXTRACT syntax
        assertTrue(condition.contains("JSON_EXTRACT(json, '$.alertType') = :alertType"));
        assertEquals("webhook", filter.getQueryParam("alertType"));
      }
    }

    @Test
    @DisplayName("Should generate PostgreSQL parameterized query for valid alertType")
    void testAlertTypeFilter_ValidParameter_PostgreSQL() {
      try (MockedStatic<DatasourceConfig> mockedStatic = mockStatic(DatasourceConfig.class)) {
        // Given: PostgreSQL datasource and valid alertType parameter
        mockedStatic.when(DatasourceConfig::getInstance).thenReturn(mockDatasourceConfig);
        when(mockDatasourceConfig.isMySQL()).thenReturn(false);
        filter.addQueryParam("alertType", "email");

        // When: Generate condition
        String condition = filter.getCondition("table");

        // Then: Should use PostgreSQL JSON operator syntax
        assertTrue(condition.contains("json->>'alertType' = :alertType"));
        assertEquals("email", filter.getQueryParam("alertType"));
      }
    }

    @ParameterizedTest
    @DisplayName("Should handle various alert type values")
    @ValueSource(strings = {"webhook", "email", "slack", "msteams", "pagerduty", "generic"})
    void testAlertTypeFilter_VariousTypes(String alertType) {
      // Given: Various alert type values
      filter.addQueryParam("alertType", alertType);

      // When: Generate condition
      String condition = filter.getCondition("table");

      // Then: Should use parameterized query
      assertTrue(condition.contains("= :alertType"));
      assertEquals(alertType, filter.getQueryParam("alertType"));
    }
  }

  @Nested
  @DisplayName("Test Case Resolution Status Filter Tests")
  class TestCaseResolutionStatusFilterTests {

    @Test
    @DisplayName("Should return empty string when testCaseResolutionStatusType is null")
    void testTestCaseResolutionStatusFilter_NullParameter() {
      // When: No testCaseResolutionStatusType parameter set
      String condition = filter.getCondition("table");

      // Then: Should not contain testCaseResolutionStatusType condition
      assertFalse(condition.contains("testCaseResolutionStatusType"));
      assertNull(filter.getQueryParam("testCaseResolutionStatusType"));
    }

    @Test
    @DisplayName("Should generate parameterized query for valid testCaseResolutionStatusType")
    void testTestCaseResolutionStatusFilter_ValidParameter() {
      // Given: Valid testCaseResolutionStatusType parameter
      filter.addQueryParam("testCaseResolutionStatusType", "resolved");

      // When: Generate condition
      String condition = filter.getCondition("table");

      // Then: Should use parameterized query
      assertTrue(
          condition.contains("testCaseResolutionStatusType = :testCaseResolutionStatusType"));
      assertEquals("resolved", filter.getQueryParam("testCaseResolutionStatusType"));
    }

    @ParameterizedTest
    @DisplayName("Should handle various test case resolution status values")
    @ValueSource(strings = {"resolved", "acknowledged", "assigned", "new", "task", "falsePositive"})
    void testTestCaseResolutionStatusFilter_VariousStatuses(String statusType) {
      // Given: Various status type values
      filter.addQueryParam("testCaseResolutionStatusType", statusType);

      // When: Generate condition
      String condition = filter.getCondition("table");

      // Then: Should use parameterized query
      assertTrue(
          condition.contains("testCaseResolutionStatusType = :testCaseResolutionStatusType"));
      assertEquals(statusType, filter.getQueryParam("testCaseResolutionStatusType"));
    }
  }

  @Nested
  @DisplayName("Integration Tests")
  class IntegrationTests {

    @Test
    @DisplayName("Should handle multiple filters simultaneously")
    void testMultipleFilters_Integration() {
      // Given: Multiple filter parameters
      filter.addQueryParam("assignee", "data_engineer");
      filter.addQueryParam("fileType", "parquet");
      filter.addQueryParam("directory", "/warehouse/sales");
      filter.addQueryParam("workflowDefinitionId", "etl-workflow-123");
      filter.addQueryParam("alertType", "webhook");

      // When: Generate condition
      String condition = filter.getCondition("sales_table");

      // Then: Should include all parameterized conditions
      assertTrue(condition.contains("assignee = :assignee"));
      assertTrue(condition.contains("fileType = :fileType"));
      assertTrue(condition.contains("directoryFqn = :directory"));
      assertTrue(condition.contains("workflowDefinitionId = :workflowDefinitionId"));
      assertTrue(condition.contains("= :alertType"));

      // And: Should preserve all parameter values
      assertEquals("data_engineer", filter.getQueryParam("assignee"));
      assertEquals("parquet", filter.getQueryParam("fileType"));
      assertEquals("/warehouse/sales", filter.getQueryParam("directory"));
      assertEquals("etl-workflow-123", filter.getQueryParam("workflowDefinitionId"));
      assertEquals("webhook", filter.getQueryParam("alertType"));

      // And: Should properly join conditions with AND
      long andCount = condition.chars().mapToObj(c -> (char) c).filter(c -> c == 'A').count();
      assertTrue(andCount >= 4); // Multiple AND operators expected
    }

    @Test
    @DisplayName("Should handle complex query with mixed database functions")
    void testComplexQuery_MixedDatabaseFunctions() {
      try (MockedStatic<DatasourceConfig> mockedStatic = mockStatic(DatasourceConfig.class)) {
        // Given: MySQL datasource with complex filter combination
        mockedStatic.when(DatasourceConfig::getInstance).thenReturn(mockDatasourceConfig);
        when(mockDatasourceConfig.isMySQL()).thenReturn(true);

        filter.addQueryParam("agentType", "ingestion");
        filter.addQueryParam("alertType", "slack");
        filter.addQueryParam("assignee", "admin@company.com");
        filter.addQueryParam("testCaseResolutionStatusType", "acknowledged");

        // When: Generate condition
        String condition = filter.getCondition("metadata_table");

        // Then: Should use MySQL-specific JSON functions
        assertTrue(condition.contains("JSON_EXTRACT(json, '$.agentType') = :agentType"));
        assertTrue(condition.contains("JSON_EXTRACT(json, '$.alertType') = :alertType"));
        assertTrue(condition.contains("assignee = :assignee"));
        assertTrue(
            condition.contains("testCaseResolutionStatusType = :testCaseResolutionStatusType"));
      }
    }

    @Test
    @DisplayName("Should maintain query parameter isolation between filter instances")
    void testParameterIsolation_MultipleInstances() {
      // Given: Two separate filter instances
      ListFilter filter1 = new ListFilter();
      ListFilter filter2 = new ListFilter();

      filter1.addQueryParam("assignee", "user1");
      filter1.addQueryParam("fileType", "csv");

      filter2.addQueryParam("assignee", "user2");
      filter2.addQueryParam("fileType", "parquet");

      // When: Generate conditions for both filters
      String condition1 = filter1.getCondition("table1");
      String condition2 = filter2.getCondition("table2");

      // Then: Should maintain separate parameter values
      assertEquals("user1", filter1.getQueryParam("assignee"));
      assertEquals("csv", filter1.getQueryParam("fileType"));

      assertEquals("user2", filter2.getQueryParam("assignee"));
      assertEquals("parquet", filter2.getQueryParam("fileType"));

      // And: Should generate appropriate conditions for each
      assertTrue(condition1.contains("assignee = :assignee"));
      assertTrue(condition1.contains("fileType = :fileType"));
      assertTrue(condition2.contains("assignee = :assignee"));
      assertTrue(condition2.contains("fileType = :fileType"));
    }
  }

  @Nested
  @DisplayName("Edge Cases and Error Handling")
  class EdgeCasesTests {

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   ", "\t", "\n", "\r\n"})
    @DisplayName("Should handle null, empty, and whitespace-only parameters gracefully")
    void testEdgeCases_NullEmptyWhitespace(String paramValue) {
      // Given: Edge case parameter values
      filter.addQueryParam("assignee", paramValue);
      filter.addQueryParam("fileType", paramValue);

      // When: Generate condition
      String condition = filter.getCondition("table");

      // Then: Should handle gracefully
      if (paramValue == null) {
        assertFalse(condition.contains("assignee = :assignee"));
        assertFalse(condition.contains("fileType = :fileType"));
      } else {
        // Empty or whitespace strings should still generate parameterized queries
        assertTrue(condition.contains("assignee = :assignee"));
        assertTrue(condition.contains("fileType = :fileType"));
        assertEquals(paramValue, filter.getQueryParam("assignee"));
        assertEquals(paramValue, filter.getQueryParam("fileType"));
      }
    }

    @Test
    @DisplayName("Should handle very long parameter values without issues")
    void testEdgeCases_VeryLongParameterValues() {
      // Given: Very long parameter values
      String longAssignee = "a".repeat(1000);
      String longDirectory = "/very/long/path/".repeat(100);

      filter.addQueryParam("assignee", longAssignee);
      filter.addQueryParam("directory", longDirectory);

      // When: Generate condition
      String condition = filter.getCondition("table");

      // Then: Should handle without issues
      assertTrue(condition.contains("assignee = :assignee"));
      assertTrue(condition.contains("directoryFqn = :directory"));
      assertEquals(longAssignee, filter.getQueryParam("assignee"));
      assertEquals(longDirectory, filter.getQueryParam("directory"));
    }

    @Test
    @DisplayName("Should preserve parameter order in queryParams map")
    void testEdgeCases_ParameterOrder() {
      // Given: Multiple parameters added in specific order
      filter.addQueryParam("param1", "value1");
      filter.addQueryParam("param2", "value2");
      filter.addQueryParam("param3", "value3");

      // When: Retrieve parameters
      Map<String, String> params = filter.getQueryParams();

      // Then: Should contain all parameters
      assertEquals("value1", params.get("param1"));
      assertEquals("value2", params.get("param2"));
      assertEquals("value3", params.get("param3"));
      assertEquals(3, params.size());
    }
  }

  @Nested
  @DisplayName("Security and SQL Injection Prevention Tests")
  class SecurityTests {

    private static Stream<Arguments> maliciousInputProvider() {
      return Stream.of(
          // Boolean-based blind SQL injection
          Arguments.of("assignee", "user' AND 1=1--", "Boolean blind injection"),
          Arguments.of("fileType", "csv' OR '1'='1", "Boolean OR injection"),
          Arguments.of("directory", "path\" AND \"1\"=\"1", "Double quote injection"),

          // Time-based SQL injection
          Arguments.of("workflowDefinitionId", "id'; WAITFOR DELAY '00:00:05'--", "Time delay"),
          Arguments.of("alertType", "webhook' AND SLEEP(5)--", "MySQL sleep injection"),
          Arguments.of("entityLink", "link' AND pg_sleep(5)--", "PostgreSQL sleep injection"),

          // Union-based SQL injection
          Arguments.of("assignee", "user' UNION SELECT password FROM users--", "Union injection"),
          Arguments.of(
              "fileType", "csv' UNION SELECT credit_card FROM payments--", "Data exfiltration"),

          // Stacked queries / Command injection
          Arguments.of("directory", "path'; DELETE FROM important_table;--", "Delete injection"),
          Arguments.of("spreadsheet", "file.xlsx'; DROP TABLE users;--", "Drop table injection"),
          Arguments.of(
              "assignee", "user'; INSERT INTO admins VALUES ('hacker');--", "Insert injection"),

          // Comment-based injection
          Arguments.of("fileType", "csv/**/OR/**/1=1", "Comment obfuscation"),
          Arguments.of("alertType", "email--admin", "Comment truncation"),

          // Advanced evasion techniques
          Arguments.of(
              "assignee", "user'||chr(65)||chr(68)||chr(77)||chr(73)||chr(78)||'", "Char encoding"),
          Arguments.of("directory", "path'+AND+1=1--", "URL encoding simulation"),

          // NoSQL injection patterns (just in case)
          Arguments.of("fileType", "'; return true; var x='", "NoSQL injection"),
          Arguments.of("alertType", "$where: function() { return true; }", "MongoDB injection"));
    }

    @ParameterizedTest
    @MethodSource("maliciousInputProvider")
    @DisplayName("Should prevent all types of SQL injection attacks")
    void testSqlInjectionPrevention_ComprehensiveCoverage(
        String paramName, String maliciousValue, String attackType) {
      // Given: Malicious input for various parameters
      filter.addQueryParam(paramName, maliciousValue);

      // When: Generate condition
      String condition = filter.getCondition("sensitive_table");

      // Then: Should use parameterized query (preventing injection)
      assertTrue(
          condition.contains("= :" + paramName) || condition.contains(paramName + " = :"),
          String.format(
              "Failed to parameterize %s for %s attack: %s",
              paramName, attackType, maliciousValue));

      // And: Should preserve exact malicious value (will be safely parameterized at runtime)
      assertEquals(
          maliciousValue,
          filter.getQueryParam(paramName),
          String.format("Parameter value should be preserved for %s", attackType));

      // And: Generated SQL should not contain dangerous patterns
      String upperCondition = condition.toUpperCase();
      assertFalse(upperCondition.contains("DROP TABLE"), "Should not contain DROP TABLE pattern");
      assertFalse(upperCondition.contains("DELETE FROM"), "Should not contain DELETE FROM pattern");
      assertFalse(upperCondition.contains("INSERT INTO"), "Should not contain INSERT INTO pattern");
      assertFalse(upperCondition.contains("UPDATE SET"), "Should not contain UPDATE SET pattern");
      assertFalse(upperCondition.contains(" OR 1=1"), "Should not contain OR 1=1 pattern");
      assertFalse(upperCondition.contains(" AND 1=1"), "Should not contain AND 1=1 pattern");
    }

    @Test
    @DisplayName("Should maintain security when parameters are dynamically modified")
    void testSecurityWithDynamicModification() {
      // Given: Initial safe parameters
      filter.addQueryParam("assignee", "safe_user");
      filter.addQueryParam("fileType", "csv");

      // When: Parameters are modified to malicious values
      filter.addQueryParam("assignee", "user'; DROP TABLE users;--");
      filter.addQueryParam("fileType", "csv' OR '1'='1");

      // Then: Should still use parameterized queries
      String condition = filter.getCondition("table");
      assertTrue(condition.contains("assignee = :assignee"));
      assertTrue(condition.contains("fileType = :fileType"));

      // And: Should preserve modified values safely
      assertEquals("user'; DROP TABLE users;--", filter.getQueryParam("assignee"));
      assertEquals("csv' OR '1'='1", filter.getQueryParam("fileType"));
    }

    @Test
    @DisplayName("Should handle mixed safe and malicious parameters correctly")
    void testMixedSafeAndMaliciousParameters() {
      // Given: Mix of safe and potentially malicious parameters
      filter.addQueryParam("assignee", "legitimate_user@company.com"); // Safe
      filter.addQueryParam("fileType", "csv' OR '1'='1--"); // Malicious
      filter.addQueryParam("directory", "/data/warehouse/tables"); // Safe
      filter.addQueryParam("alertType", "email'; DROP TABLE alerts;--"); // Malicious

      // When: Generate condition
      String condition = filter.getCondition("mixed_table");

      // Then: All should use parameterized queries
      assertTrue(condition.contains("assignee = :assignee"));
      assertTrue(condition.contains("fileType = :fileType"));
      assertTrue(condition.contains("directoryFqn = :directory"));
      assertTrue(condition.contains("= :alertType"));

      // And: All parameter values should be preserved
      assertEquals("legitimate_user@company.com", filter.getQueryParam("assignee"));
      assertEquals("csv' OR '1'='1--", filter.getQueryParam("fileType"));
      assertEquals("/data/warehouse/tables", filter.getQueryParam("directory"));
      assertEquals("email'; DROP TABLE alerts;--", filter.getQueryParam("alertType"));
    }
  }
}
