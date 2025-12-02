package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mockStatic;

import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.service.resources.databases.DatasourceConfig;

/**
 * Comprehensive tests for agentType filtering functionality in ListFilter.
 * Tests both MySQL and PostgreSQL database syntaxes.
 */
class AgentTypeFilterTest {

  @Test
  void test_getAgentTypeCondition_mysql_singleAgentType() {
    try (MockedStatic<DatasourceConfig> mockedConfig = mockStatic(DatasourceConfig.class)) {
      DatasourceConfig mockDatasourceConfig = new DatasourceConfig();
      mockDatasourceConfig.setIsMySQL(true);
      mockedConfig.when(DatasourceConfig::getInstance).thenReturn(mockDatasourceConfig);

      ListFilter filter = new ListFilter();
      filter.addQueryParam("agentType", "CollateAI");

      String condition = filter.getCondition("app_entity");

      assertTrue(condition.contains("JSON_EXTRACT(json, '$.agentType') IN ('CollateAI')"));
      assertTrue(condition.contains("WHERE"));
      assertTrue(condition.contains("app_entity.deleted = FALSE"));
    }
  }

  @Test
  void test_getAgentTypeCondition_postgresql_singleAgentType() {
    try (MockedStatic<DatasourceConfig> mockedConfig = mockStatic(DatasourceConfig.class)) {
      DatasourceConfig mockDatasourceConfig = new DatasourceConfig();
      mockDatasourceConfig.setIsMySQL(false);
      mockedConfig.when(DatasourceConfig::getInstance).thenReturn(mockDatasourceConfig);

      ListFilter filter = new ListFilter();
      filter.addQueryParam("agentType", "CollateAI");

      String condition = filter.getCondition("app_entity");

      assertTrue(condition.contains("json->>'agentType' IN ('CollateAI')"));
      assertTrue(condition.contains("WHERE"));
      assertTrue(condition.contains("app_entity.deleted = FALSE"));
    }
  }

  @Test
  void test_getAgentTypeCondition_mysql_multipleAgentTypes() {
    try (MockedStatic<DatasourceConfig> mockedConfig = mockStatic(DatasourceConfig.class)) {
      DatasourceConfig mockDatasourceConfig = new DatasourceConfig();
      mockDatasourceConfig.setIsMySQL(true);
      mockedConfig.when(DatasourceConfig::getInstance).thenReturn(mockDatasourceConfig);

      ListFilter filter = new ListFilter();
      filter.addQueryParam("agentType", "CollateAI,Metadata,CollateAITierAgent");

      String condition = filter.getCondition("app_entity");

      // Check for IN condition structure
      assertTrue(
          condition.contains(
              "JSON_EXTRACT(json, '$.agentType') IN ('CollateAI', 'Metadata', 'CollateAITierAgent')"));
      assertTrue(condition.contains("WHERE"));
      assertTrue(condition.contains("app_entity.deleted = FALSE"));
    }
  }

  @Test
  void test_getAgentTypeCondition_postgresql_multipleAgentTypes() {
    try (MockedStatic<DatasourceConfig> mockedConfig = mockStatic(DatasourceConfig.class)) {
      DatasourceConfig mockDatasourceConfig = new DatasourceConfig();
      mockDatasourceConfig.setIsMySQL(false);
      mockedConfig.when(DatasourceConfig::getInstance).thenReturn(mockDatasourceConfig);

      ListFilter filter = new ListFilter();
      filter.addQueryParam("agentType", "CollateAI,Metadata");

      String condition = filter.getCondition("app_entity");

      // Check for IN condition structure
      assertTrue(condition.contains("json->>'agentType' IN ('CollateAI', 'Metadata')"));
      assertTrue(condition.contains("WHERE"));
      assertTrue(condition.contains("app_entity.deleted = FALSE"));
    }
  }

  @Test
  void test_getAgentTypeCondition_withWhitespaceHandling() {
    try (MockedStatic<DatasourceConfig> mockedConfig = mockStatic(DatasourceConfig.class)) {
      DatasourceConfig mockDatasourceConfig = new DatasourceConfig();
      mockDatasourceConfig.setIsMySQL(false);
      mockedConfig.when(DatasourceConfig::getInstance).thenReturn(mockDatasourceConfig);

      ListFilter filter = new ListFilter();
      filter.addQueryParam("agentType", " CollateAI , Metadata , CollateAITierAgent ");

      String condition = filter.getCondition("app_entity");

      // Should trim whitespace and create proper IN condition
      assertTrue(
          condition.contains(
              "json->>'agentType' IN ('CollateAI', 'Metadata', 'CollateAITierAgent')"));
      assertFalse(condition.contains(" OR "));
    }
  }

  @Test
  void test_getAgentTypeCondition_emptyAgentType() {
    ListFilter filter = new ListFilter();
    filter.addQueryParam("agentType", "");

    String condition = filter.getCondition("app_entity");

    // Should not include agentType condition when empty
    assertFalse(condition.contains("agentType"));
    assertTrue(condition.contains("WHERE app_entity.deleted = FALSE"));
  }

  @Test
  void test_getAgentTypeCondition_nullAgentType() {
    ListFilter filter = new ListFilter();
    // Don't set agentType parameter (null by default)

    String condition = filter.getCondition("app_entity");

    // Should not include agentType condition when null
    assertFalse(condition.contains("agentType"));
    assertTrue(condition.contains("WHERE app_entity.deleted = FALSE"));
  }

  @Test
  void test_getAgentTypeCondition_whitespaceOnlyAgentType() {
    ListFilter filter = new ListFilter();
    filter.addQueryParam("agentType", "   ");

    String condition = filter.getCondition("app_entity");

    // Should not include agentType condition when only whitespace
    assertFalse(condition.contains("agentType"));
    assertTrue(condition.contains("WHERE app_entity.deleted = FALSE"));
  }

  @Test
  void test_getAgentTypeCondition_singleAgentTypeWithTrailingComma() {
    try (MockedStatic<DatasourceConfig> mockedConfig = mockStatic(DatasourceConfig.class)) {
      DatasourceConfig mockDatasourceConfig = new DatasourceConfig();
      mockDatasourceConfig.setIsMySQL(false);
      mockedConfig.when(DatasourceConfig::getInstance).thenReturn(mockDatasourceConfig);

      ListFilter filter = new ListFilter();
      filter.addQueryParam("agentType", "CollateAI,");

      String condition = filter.getCondition("app_entity");

      // Should handle trailing comma properly and filter out empty values
      assertTrue(condition.contains("json->>'agentType' IN ('CollateAI')"));
      // Should not contain empty string in the IN clause
      assertFalse(condition.contains("'',"));
      assertFalse(condition.contains(", '')"));
    }
  }

  @Test
  void test_getAgentTypeCondition_emptyValuesFiltered() {
    try (MockedStatic<DatasourceConfig> mockedConfig = mockStatic(DatasourceConfig.class)) {
      DatasourceConfig mockDatasourceConfig = new DatasourceConfig();
      mockDatasourceConfig.setIsMySQL(false);
      mockedConfig.when(DatasourceConfig::getInstance).thenReturn(mockDatasourceConfig);

      ListFilter filter = new ListFilter();
      filter.addQueryParam("agentType", "CollateAI,, ,Metadata,");

      String condition = filter.getCondition("app_entity");

      // Should filter out empty and whitespace-only values
      assertTrue(condition.contains("json->>'agentType' IN ('CollateAI', 'Metadata')"));
      assertFalse(condition.contains("''"));
    }
  }

  @Test
  void test_getAgentTypeCondition_combinedWithOtherFilters() {
    try (MockedStatic<DatasourceConfig> mockedConfig = mockStatic(DatasourceConfig.class)) {
      DatasourceConfig mockDatasourceConfig = new DatasourceConfig();
      mockDatasourceConfig.setIsMySQL(false);
      mockedConfig.when(DatasourceConfig::getInstance).thenReturn(mockDatasourceConfig);

      ListFilter filter = new ListFilter();
      filter.addQueryParam("agentType", "CollateAI,Metadata");
      filter.addQueryParam("testCaseStatus", "Failed");

      String condition = filter.getCondition("app_entity");

      // Should combine agentType filter with other filters using AND
      assertTrue(
          condition.contains(
              "(json->>'agentType' = 'CollateAI' OR json->>'agentType' = 'Metadata')"));
      assertTrue(condition.contains("status = :testCaseStatus"));
      assertTrue(condition.contains("AND"));
    }
  }

  @Test
  void test_getAgentTypeCondition_specialCharactersInAgentType() {
    try (MockedStatic<DatasourceConfig> mockedConfig = mockStatic(DatasourceConfig.class)) {
      DatasourceConfig mockDatasourceConfig = new DatasourceConfig();
      mockDatasourceConfig.setIsMySQL(false);
      mockedConfig.when(DatasourceConfig::getInstance).thenReturn(mockDatasourceConfig);

      ListFilter filter = new ListFilter();
      // Test with agent type containing special characters (though this might not be realistic)
      filter.addQueryParam("agentType", "Collate-AI_Test");

      String condition = filter.getCondition("app_entity");

      // Should handle special characters in agent type names
      assertTrue(condition.contains("json->>'agentType' IN ('Collate-AI_Test')"));
    }
  }
}
