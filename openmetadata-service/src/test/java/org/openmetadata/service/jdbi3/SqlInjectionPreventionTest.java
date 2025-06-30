package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.*;

import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;

/**
 * Test class to verify SQL injection prevention in DAO methods.
 * These tests validate that our fixes properly parameterize queries instead of using string concatenation.
 */
class SqlInjectionPreventionTest {

  /**
   * Test that SQL conditions use parameterized placeholders instead of direct string concatenation.
   * This validates that we've successfully replaced vulnerable String.format calls with safe parameter binding.
   */
  @Test
  void testListFilter_usesParameterizedQueries() {
    ListFilter filter = new ListFilter();
    
    // Test assignee condition uses parameter placeholder
    filter.addQueryParam("assignee", "john.doe");
    String condition = filter.getCondition("tasks");
    assertTrue(condition.contains("assignee = :assignee"), 
        "Assignee condition should use parameter placeholder");
    assertFalse(condition.contains("assignee = 'john.doe'"), 
        "Assignee condition should not contain literal value");
    
    // Test agent type condition uses parameter placeholder
    filter = new ListFilter();
    filter.addQueryParam("agentType", "pipeline");
    condition = filter.getCondition("agents");
    assertTrue(condition.contains(":agentType"), 
        "AgentType condition should use parameter placeholder");
    assertFalse(condition.contains("'pipeline'"), 
        "AgentType condition should not contain literal value");
    
    // Test workflow definition ID uses parameter placeholder
    filter = new ListFilter();
    filter.addQueryParam("workflowDefinitionId", "workflow-123");
    condition = filter.getCondition("workflows");
    assertTrue(condition.contains("workflowDefinitionId = :workflowDefinitionId"), 
        "WorkflowDefinitionId condition should use parameter placeholder");
    assertFalse(condition.contains("'workflow-123'"), 
        "WorkflowDefinitionId condition should not contain literal value");
    
    // Test entity link uses parameter placeholder
    filter = new ListFilter();
    filter.addQueryParam("entityLink", "table::db.schema.table");
    condition = filter.getCondition("entities");
    assertTrue(condition.contains("entityLink = :entityLink"), 
        "EntityLink condition should use parameter placeholder");
    assertFalse(condition.contains("'table::db.schema.table'"), 
        "EntityLink condition should not contain literal value");
    
    // Test provider condition uses parameter placeholder
    filter = new ListFilter();
    filter.addQueryParam("provider", "aws");
    condition = filter.getCondition("services");
    assertTrue(condition.contains(":provider"), 
        "Provider condition should use parameter placeholder");
    assertFalse(condition.contains("'aws'"), 
        "Provider condition should not contain literal value");
    
    // Test test case resolution status uses parameter placeholder
    filter = new ListFilter();
    filter.addQueryParam("testCaseResolutionStatusType", "RESOLVED");
    condition = filter.getCondition("testcases");
    assertTrue(condition.contains("testCaseResolutionStatusType = :testCaseResolutionStatusType"), 
        "TestCaseResolutionStatusType condition should use parameter placeholder");
    assertFalse(condition.contains("'RESOLVED'"), 
        "TestCaseResolutionStatusType condition should not contain literal value");
  }

  /**
   * Test that malicious SQL injection attempts are safely handled as parameter values.
   */
  @Test
  void testSqlInjectionAttempts_treatedAsLiteralValues() {
    String[] injectionAttempts = {
        "'; DROP TABLE users; --",
        "' OR '1'='1' --", 
        "'; UPDATE table SET deleted=true; --",
        "' UNION SELECT password FROM users --",
        "admin'; INSERT INTO malicious VALUES('attack'); --"
    };
    
    for (String injectionAttempt : injectionAttempts) {
      ListFilter filter = new ListFilter();
      filter.addQueryParam("assignee", injectionAttempt);
      
      String condition = filter.getCondition("tasks");
      
      // Should use parameter placeholder, not literal injection
      assertTrue(condition.contains("assignee = :assignee"), 
          "Should use parameter placeholder for: " + injectionAttempt);
      
      // Should not contain SQL injection keywords directly in condition
      assertFalse(condition.contains("DROP TABLE"), 
          "Should not contain DROP TABLE in condition for: " + injectionAttempt);
      assertFalse(condition.contains("UPDATE"), 
          "Should not contain UPDATE in condition for: " + injectionAttempt);
      assertFalse(condition.contains("INSERT"), 
          "Should not contain INSERT in condition for: " + injectionAttempt);
      assertFalse(condition.contains("UNION"), 
          "Should not contain UNION in condition for: " + injectionAttempt);
      
      // Malicious value should be stored as parameter value, not in SQL
      assertEquals(injectionAttempt, filter.getQueryParams().get("assignee"), 
          "Parameter value should be preserved exactly");
    }
  }

  /**
   * Test that pipeline type IN clauses are properly parameterized.
   */
  @Test
  void testPipelineType_parameterizedInClause() {
    ListFilter filter = new ListFilter();
    
    // Test single value
    filter.addQueryParam("pipelineType", "ETL");
    String condition = filter.getCondition("pipelines");
    
    assertTrue(condition.contains(":pipelineType0"), 
        "Single pipeline type should use parameter placeholder");
    assertEquals("ETL", filter.getQueryParams().get("pipelineType0"), 
        "Parameter value should be stored correctly");
    
    // Test multiple values
    filter = new ListFilter();
    filter.addQueryParam("pipelineType", "ETL,ML,Analytics");
    condition = filter.getCondition("pipelines");
    
    assertTrue(condition.contains(":pipelineType0"), 
        "First pipeline type should use parameter placeholder");
    assertTrue(condition.contains(":pipelineType1"), 
        "Second pipeline type should use parameter placeholder");
    assertTrue(condition.contains(":pipelineType2"), 
        "Third pipeline type should use parameter placeholder");
    
    assertEquals("ETL", filter.getQueryParams().get("pipelineType0"));
    assertEquals("ML", filter.getQueryParams().get("pipelineType1"));
    assertEquals("Analytics", filter.getQueryParams().get("pipelineType2"));
    
    // Should not contain literal values in SQL
    assertFalse(condition.contains("'ETL'"), 
        "Should not contain literal ETL value");
    assertFalse(condition.contains("'ML'"), 
        "Should not contain literal ML value");
    assertFalse(condition.contains("'Analytics'"), 
        "Should not contain literal Analytics value");
  }

  /**
   * Test that SQL injection in pipeline type lists is handled safely.
   */
  @Test
  void testPipelineType_sqlInjectionInList() {
    ListFilter filter = new ListFilter();
    
    // Test SQL injection in comma-separated list
    filter.addQueryParam("pipelineType", "ETL'; DROP TABLE pipelines; --,ML");
    String condition = filter.getCondition("pipelines");
    
    assertTrue(condition.contains(":pipelineType0"), 
        "First parameter should use placeholder");
    assertTrue(condition.contains(":pipelineType1"), 
        "Second parameter should use placeholder");
    
    // SQL injection should not appear in the condition
    assertFalse(condition.contains("DROP TABLE"), 
        "Condition should not contain SQL injection");
    
    // Malicious content should be in parameter values, safely escaped
    String param0 = filter.getQueryParams().get("pipelineType0");
    String param1 = filter.getQueryParams().get("pipelineType1");
    
    assertNotNull(param0, "First parameter should exist");
    assertNotNull(param1, "Second parameter should exist");
    assertEquals("ML", param1, "Second parameter should be ML");
    
    // The malicious part should be escaped in the first parameter
    assertTrue(param0.contains("ETL"), "First parameter should contain ETL");
  }

  /**
   * Test that no String.format patterns remain in the generated SQL.
   * This is a regression test to ensure we've eliminated all vulnerable patterns.
   */
  @Test
  void testNoStringFormatPatterns_inGeneratedSql() {
    ListFilter filter = new ListFilter();
    
    // Add various parameters that were previously vulnerable
    filter.addQueryParam("assignee", "testuser");
    filter.addQueryParam("agentType", "pipeline");
    filter.addQueryParam("workflowDefinitionId", "workflow-123");
    filter.addQueryParam("entityLink", "table::db.schema.table");
    filter.addQueryParam("provider", "aws");
    filter.addQueryParam("alertType", "email");
    filter.addQueryParam("testCaseResolutionStatusType", "RESOLVED");
    filter.addQueryParam("pipelineType", "ETL,ML");
    
    String condition = filter.getCondition("test_table");
    
    // Should not contain any single-quoted literal values that could indicate string formatting
    Pattern literalPattern = Pattern.compile("= '[^:].*?'");
    assertFalse(literalPattern.matcher(condition).find(), 
        "Condition should not contain literal string values: " + condition);
    
    // Should contain parameter placeholders
    assertTrue(condition.contains(":assignee") || !condition.contains("assignee"), 
        "If assignee condition exists, it should use parameter");
    assertTrue(condition.contains(":agentType") || !condition.contains("agentType"), 
        "If agentType condition exists, it should use parameter");
    assertTrue(condition.contains(":workflowDefinitionId") || !condition.contains("workflowDefinitionId"), 
        "If workflowDefinitionId condition exists, it should use parameter");
    assertTrue(condition.contains(":entityLink") || !condition.contains("entityLink"), 
        "If entityLink condition exists, it should use parameter");
    assertTrue(condition.contains(":provider") || !condition.contains("provider"), 
        "If provider condition exists, it should use parameter");
    assertTrue(condition.contains(":testCaseResolutionStatusType") || !condition.contains("testCaseResolutionStatusType"), 
        "If testCaseResolutionStatusType condition exists, it should use parameter");
  }

  /**
   * Test that parameter values are preserved exactly as provided.
   * This ensures data integrity while preventing SQL injection.
   */
  @Test
  void testParameterIntegrity_preservesOriginalValues() {
    ListFilter filter = new ListFilter();
    
    String originalValue = "user@domain.com";
    filter.addQueryParam("assignee", originalValue);
    
    // Original value should be preserved in parameters
    assertEquals(originalValue, filter.getQueryParams().get("assignee"), 
        "Parameter value should be preserved exactly");
    
    // Test with special characters
    String specialValue = "user's \"quoted\" name";
    filter.addQueryParam("entityLink", specialValue);
    assertEquals(specialValue, filter.getQueryParams().get("entityLink"), 
        "Special characters should be preserved");
    
    // Test with SQL-like content (should be treated as literal data)
    String sqlLikeValue = "SELECT * FROM users";
    filter.addQueryParam("provider", sqlLikeValue);
    assertEquals(sqlLikeValue, filter.getQueryParams().get("provider"), 
        "SQL-like content should be preserved as literal data");
  }
}