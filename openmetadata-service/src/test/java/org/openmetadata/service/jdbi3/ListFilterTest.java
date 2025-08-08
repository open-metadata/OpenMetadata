package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.*;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class ListFilterTest {
  @Test
  void test_escapeApostrophe() {
    assertEquals("abcd", ListFilter.escape("abcd"));
    assertEquals("a''bcd", ListFilter.escape("a'bcd"));
    assertEquals("a''b''cd", ListFilter.escape("a'b'cd"));
    assertEquals("a''b''c''d", ListFilter.escape("a'b'c'd"));
    assertEquals("a''b''c\\_d", ListFilter.escape("a'b'c_d"));
    assertEquals("a''b\\_c\\_d", ListFilter.escape("a'b_c_d"));
    assertEquals("a\\_b\\_c\\_d", ListFilter.escape("a_b_c_d"));
  }

  @Test
  void addCondition() {
    String condition;
    ListFilter filter = new ListFilter();

    condition = filter.addCondition(List.of("a", "b"));
    assertEquals("a AND b", condition);

    condition = filter.addCondition(List.of("foo=`abcf`", "", ""));
    assertEquals("foo=`abcf`", condition);

    condition = filter.addCondition(List.of("foo=`abcf`", "v in ('A', 'B')", "x > 6"));
    assertEquals("foo=`abcf` AND v in ('A', 'B') AND x > 6", condition);

    condition = filter.addCondition(new ArrayList<>());
    assertEquals("", condition);
  }

  @Test
  void getCondition() {
    ListFilter filter = new ListFilter();
    String condition = filter.getCondition("foo");
    assertEquals("WHERE foo.deleted = FALSE", condition);

    filter = new ListFilter();
    filter.addQueryParam("testCaseStatus", "Failed");
    condition = filter.getCondition("foo");
    assertEquals("WHERE foo.deleted = FALSE AND status = 'Failed'", condition);
  }

  @Test
  void testParameterizedQuery_AssigneeCondition() {
    ListFilter filter = new ListFilter();

    // Test parameterized query for assignee through getCondition
    filter.addQueryParam("assignee", "user123");
    String condition = filter.getCondition("table");
    assertTrue(condition.contains("assignee = :assignee"));
    assertEquals("user123", filter.getQueryParam("assignee"));

    // Test with malicious input - should still use parameterized query
    filter = new ListFilter();
    filter.addQueryParam("assignee", "user' OR '1'='1");
    condition = filter.getCondition("table");
    assertTrue(condition.contains("assignee = :assignee"));
    assertEquals("user' OR '1'='1", filter.getQueryParam("assignee"));
  }

  @Test
  void testParameterizedQuery_WorkflowDefinitionIdCondition() {
    ListFilter filter = new ListFilter();

    // Test parameterized query through getCondition
    filter.addQueryParam("workflowDefinitionId", "workflow-123");
    String condition = filter.getCondition("table");
    assertTrue(condition.contains("workflowDefinitionId = :workflowDefinitionId"));
    assertEquals("workflow-123", filter.getQueryParam("workflowDefinitionId"));

    // Test with SQL injection attempt
    filter = new ListFilter();
    filter.addQueryParam("workflowDefinitionId", "test'; DROP TABLE users;--");
    condition = filter.getCondition("table");
    assertTrue(condition.contains("workflowDefinitionId = :workflowDefinitionId"));
  }

  @Test
  void testParameterizedQuery_EntityLinkCondition() {
    ListFilter filter = new ListFilter();

    // Test parameterized query through getCondition
    filter.addQueryParam("entityLink", "table1::column1");
    String condition = filter.getCondition("table");
    assertTrue(condition.contains("entityLink = :entityLink"));
    assertEquals("table1::column1", filter.getQueryParam("entityLink"));
  }

  @Test
  void testParameterizedQuery_AgentTypeCondition() {
    ListFilter filter = new ListFilter();

    // Test parameterized query through getCondition
    filter.addQueryParam("agentType", "ingestion");
    String condition = filter.getCondition("table");
    assertTrue(condition.contains("= :agentType"));
    assertEquals("ingestion", filter.getQueryParam("agentType"));
  }

  @Test
  void testParameterizedQuery_DirectoryCondition() {
    ListFilter filter = new ListFilter();

    // Test null returns empty string
    assertEquals("", filter.getDirectoryCondition("table"));

    // Test parameterized query
    filter.addQueryParam("directory", "/path/to/directory");
    assertEquals("directoryFqn = :directory", filter.getDirectoryCondition("table"));
    assertEquals("/path/to/directory", filter.getQueryParam("directory"));
  }

  @Test
  void testParameterizedQuery_SpreadsheetCondition() {
    ListFilter filter = new ListFilter();

    // Test null returns empty string
    assertEquals("", filter.getSpreadsheetCondition("table"));

    // Test parameterized query
    filter.addQueryParam("spreadsheet", "spreadsheet.xlsx");
    assertEquals("spreadsheetFqn = :spreadsheet", filter.getSpreadsheetCondition("table"));
    assertEquals("spreadsheet.xlsx", filter.getQueryParam("spreadsheet"));
  }

  @Test
  void testParameterizedQuery_FileTypeCondition() {
    ListFilter filter = new ListFilter();

    // Test null returns empty string
    assertEquals("", filter.getFileTypeCondition("table"));

    // Test parameterized query
    filter.addQueryParam("fileType", "csv");
    assertEquals("fileType = :fileType", filter.getFileTypeCondition("table"));
    assertEquals("csv", filter.getQueryParam("fileType"));
  }

  @Test
  void testParameterizedQuery_AlertTypeCondition() {
    ListFilter filter = new ListFilter();

    // Test parameterized query through getCondition
    filter.addQueryParam("alertType", "webhook");
    String condition = filter.getCondition("table");
    assertTrue(condition.contains("= :alertType"));
    assertEquals("webhook", filter.getQueryParam("alertType"));
  }

  @Test
  void testParameterizedQuery_TestCaseResolutionStatusType() {
    ListFilter filter = new ListFilter();

    // Test parameterized query through getCondition
    filter.addQueryParam("testCaseResolutionStatusType", "resolved");
    String condition = filter.getCondition("table");
    assertTrue(condition.contains("testCaseResolutionStatusType = :testCaseResolutionStatusType"));
    assertEquals("resolved", filter.getQueryParam("testCaseResolutionStatusType"));
  }

  @Test
  void testParameterizedQuery_SecurityBenefit() {
    ListFilter filter = new ListFilter();

    // Test that SQL injection attempts are safely handled through parameterization
    String[] maliciousInputs = {
      "value'; DROP TABLE users;--",
      "value' OR '1'='1",
      "value\" AND \"1\"=\"1",
      "value' UNION SELECT * FROM users--"
    };

    for (String maliciousInput : maliciousInputs) {
      filter = new ListFilter();
      filter.addQueryParam("assignee", maliciousInput);

      // Verify that the condition still uses parameterized query
      String condition = filter.getCondition("table");
      assertTrue(condition.contains("assignee = :assignee"));

      // Verify the malicious input is stored as-is (will be safely parameterized at runtime)
      assertEquals(maliciousInput, filter.getQueryParam("assignee"));
    }
  }

  @Test
  void testParameterizedQuery_IntegrationTest() {
    ListFilter filter = new ListFilter();

    // Test multiple parameterized conditions together
    filter.addQueryParam("assignee", "user123");
    filter.addQueryParam("fileType", "csv");
    filter.addQueryParam("directory", "/data/files");
    filter.addQueryParam("alertType", "webhook");

    String condition = filter.getCondition("table");

    // Verify all parameterized queries are present
    assertTrue(condition.contains("assignee = :assignee"));
    assertTrue(condition.contains("fileType = :fileType"));
    assertTrue(condition.contains("directoryFqn = :directory"));
    assertTrue(condition.contains("= :alertType"));

    // Verify all parameters are preserved
    assertEquals("user123", filter.getQueryParam("assignee"));
    assertEquals("csv", filter.getQueryParam("fileType"));
    assertEquals("/data/files", filter.getQueryParam("directory"));
    assertEquals("webhook", filter.getQueryParam("alertType"));
  }
}
