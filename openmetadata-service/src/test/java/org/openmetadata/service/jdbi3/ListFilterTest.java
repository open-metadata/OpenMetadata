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
    assertEquals("WHERE foo.deleted = FALSE AND status = :testCaseStatus", condition);
  }

  @Test
  void testSqlInjectionPrevention_assigneeCondition() {
    ListFilter filter = new ListFilter();
    
    // Test normal assignee parameter
    filter.addQueryParam("assignee", "john.doe");
    String condition = filter.getCondition("tasks");
    assertTrue(condition.contains("assignee = :assignee"));
    assertFalse(condition.contains("'"));
    assertEquals("john.doe", filter.getQueryParams().get("assignee"));
    
    // Test SQL injection attempt - should be safely parameterized
    filter = new ListFilter();
    filter.addQueryParam("assignee", "'; DROP TABLE users; --");
    condition = filter.getCondition("tasks");
    assertTrue(condition.contains("assignee = :assignee"));
    assertFalse(condition.contains("DROP TABLE"));
    assertEquals("'; DROP TABLE users; --", filter.getQueryParams().get("assignee"));
  }

  @Test
  void testSqlInjectionPrevention_agentTypeCondition() {
    ListFilter filter = new ListFilter();
    
    // Test normal agent type
    filter.addQueryParam("agentType", "pipeline");
    String condition = filter.getCondition("agents");
    assertTrue(condition.contains("JSON_EXTRACT(json, '$.agentType') = :agentType") ||
               condition.contains("json->>'agentType' = :agentType"));
    assertEquals("pipeline", filter.getQueryParams().get("agentType"));
    
    // Test SQL injection attempt
    filter = new ListFilter();
    filter.addQueryParam("agentType", "pipeline'; UPDATE agents SET deleted=true; --");
    condition = filter.getCondition("agents");
    assertTrue(condition.contains(":agentType"));
    assertFalse(condition.contains("UPDATE agents"));
    assertEquals("pipeline'; UPDATE agents SET deleted=true; --", filter.getQueryParams().get("agentType"));
  }

  @Test
  void testSqlInjectionPrevention_workflowDefinitionId() {
    ListFilter filter = new ListFilter();
    
    // Test normal workflow definition ID
    filter.addQueryParam("workflowDefinitionId", "workflow-123");
    String condition = filter.getCondition("workflows");
    assertTrue(condition.contains("workflowDefinitionId = :workflowDefinitionId"));
    assertEquals("workflow-123", filter.getQueryParams().get("workflowDefinitionId"));
    
    // Test SQL injection attempt
    filter = new ListFilter();
    filter.addQueryParam("workflowDefinitionId", "123'; DELETE FROM workflows WHERE 1=1; --");
    condition = filter.getCondition("workflows");
    assertTrue(condition.contains(":workflowDefinitionId"));
    assertFalse(condition.contains("DELETE FROM"));
    assertEquals("123'; DELETE FROM workflows WHERE 1=1; --", filter.getQueryParams().get("workflowDefinitionId"));
  }

  @Test
  void testSqlInjectionPrevention_entityLink() {
    ListFilter filter = new ListFilter();
    
    // Test normal entity link
    filter.addQueryParam("entityLink", "table::database.schema.table");
    String condition = filter.getCondition("entities");
    assertTrue(condition.contains("entityLink = :entityLink"));
    assertEquals("table::database.schema.table", filter.getQueryParams().get("entityLink"));
    
    // Test SQL injection attempt
    filter = new ListFilter();
    filter.addQueryParam("entityLink", "table'; TRUNCATE TABLE entities; --");
    condition = filter.getCondition("entities");
    assertTrue(condition.contains(":entityLink"));
    assertFalse(condition.contains("TRUNCATE TABLE"));
    assertEquals("table'; TRUNCATE TABLE entities; --", filter.getQueryParams().get("entityLink"));
  }

  @Test
  void testSqlInjectionPrevention_providerCondition() {
    ListFilter filter = new ListFilter();
    
    // Test normal provider
    filter.addQueryParam("provider", "aws");
    String condition = filter.getCondition("services");
    assertTrue(condition.contains("JSON_EXTRACT(json, '$.provider') = :provider") ||
               condition.contains("json->>'provider' = :provider"));
    assertEquals("aws", filter.getQueryParams().get("provider"));
    
    // Test SQL injection attempt  
    filter = new ListFilter();
    filter.addQueryParam("provider", "aws'; INSERT INTO services VALUES('malicious'); --");
    condition = filter.getCondition("services");
    assertTrue(condition.contains(":provider"));
    assertFalse(condition.contains("INSERT INTO"));
    assertEquals("aws'; INSERT INTO services VALUES('malicious'); --", filter.getQueryParams().get("provider"));
  }

  @Test
  void testSqlInjectionPrevention_testCaseResolutionStatus() {
    ListFilter filter = new ListFilter();
    
    // Test normal status
    filter.addQueryParam("testCaseResolutionStatusType", "RESOLVED");
    String condition = filter.getCondition("testcases");
    assertTrue(condition.contains("testCaseResolutionStatusType = :testCaseResolutionStatusType"));
    assertEquals("RESOLVED", filter.getQueryParams().get("testCaseResolutionStatusType"));
    
    // Test SQL injection attempt
    filter = new ListFilter();
    filter.addQueryParam("testCaseResolutionStatusType", "RESOLVED'; DROP DATABASE testdb; --");
    condition = filter.getCondition("testcases");
    assertTrue(condition.contains(":testCaseResolutionStatusType"));
    assertFalse(condition.contains("DROP DATABASE"));
    assertEquals("RESOLVED'; DROP DATABASE testdb; --", filter.getQueryParams().get("testCaseResolutionStatusType"));
  }

  @Test
  void testParameterizedInClause_pipelineType() {
    ListFilter filter = new ListFilter();
    
    // Test single pipeline type
    filter.addQueryParam("pipelineType", "ETL");
    String condition = filter.getCondition("pipelines");
    assertTrue(condition.contains(":pipelineType0"));
    assertEquals("ETL", filter.getQueryParams().get("pipelineType0"));
    
    // Test multiple pipeline types (comma-separated)
    filter = new ListFilter();
    filter.addQueryParam("pipelineType", "ETL,ML,Analytics");
    condition = filter.getCondition("pipelines");
    assertTrue(condition.contains(":pipelineType0"));
    assertTrue(condition.contains(":pipelineType1"));
    assertTrue(condition.contains(":pipelineType2"));
    assertEquals("ETL", filter.getQueryParams().get("pipelineType0"));
    assertEquals("ML", filter.getQueryParams().get("pipelineType1"));
    assertEquals("Analytics", filter.getQueryParams().get("pipelineType2"));
    
    // Test SQL injection attempt in pipeline type list
    filter = new ListFilter();
    filter.addQueryParam("pipelineType", "ETL'; DROP TABLE pipelines; --,ML");
    condition = filter.getCondition("pipelines");
    assertTrue(condition.contains(":pipelineType0"));
    assertTrue(condition.contains(":pipelineType1"));
    assertFalse(condition.contains("DROP TABLE"));
    // The malicious input should be escaped and stored as a parameter value
    assertTrue(filter.getQueryParams().get("pipelineType0").contains("ETL"));
    assertEquals("ML", filter.getQueryParams().get("pipelineType1"));
  }
}
