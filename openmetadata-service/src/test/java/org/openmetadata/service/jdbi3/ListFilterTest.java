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
  void test_getAgentTypeCondition_singleAgentType() {
    ListFilter filter = new ListFilter();

    filter.addQueryParam("agentType", "CollateAI");
    String condition = filter.getCondition("app_entity");
    assertTrue(
        condition.contains("JSON_EXTRACT(json, '$.agentType') IN (:agentType_0)")
            || condition.contains("json->>'agentType' IN (:agentType_0)"));
    assertEquals("CollateAI", filter.getQueryParams().get("agentType_0"));
  }

  @Test
  void test_getAgentTypeCondition_multipleAgentTypes() {
    ListFilter filter = new ListFilter();

    filter.addQueryParam("agentType", "CollateAI,Metadata,CollateAITierAgent");
    String condition = filter.getCondition("app_entity");

    assertTrue(condition.contains("IN (:agentType_0,:agentType_1,:agentType_2)"));
    assertFalse(condition.contains(" OR "));
    assertEquals("CollateAI", filter.getQueryParams().get("agentType_0"));
    assertEquals("Metadata", filter.getQueryParams().get("agentType_1"));
    assertEquals("CollateAITierAgent", filter.getQueryParams().get("agentType_2"));
  }

  @Test
  void test_getAgentTypeCondition_withWhitespace() {
    ListFilter filter = new ListFilter();

    filter.addQueryParam("agentType", " CollateAI , Metadata , CollateAITierAgent ");
    String condition = filter.getCondition("app_entity");

    assertTrue(condition.contains("IN (:agentType_0,:agentType_1,:agentType_2)"));
    assertFalse(condition.contains(" OR "));
    assertEquals("CollateAI", filter.getQueryParams().get("agentType_0"));
    assertEquals("Metadata", filter.getQueryParams().get("agentType_1"));
    assertEquals("CollateAITierAgent", filter.getQueryParams().get("agentType_2"));
  }

  @Test
  void test_getAgentTypeCondition_emptyOrNull() {
    ListFilter filter = new ListFilter();

    // Test null agent type
    String condition = filter.getCondition("app_entity");
    assertFalse(condition.contains("agentType"));

    // Test empty agent type
    filter.addQueryParam("agentType", "");
    condition = filter.getCondition("app_entity");
    assertFalse(condition.contains("agentType"));

    // Test whitespace only
    filter = new ListFilter();
    filter.addQueryParam("agentType", "   ");
    condition = filter.getCondition("app_entity");
    assertFalse(condition.contains("agentType"));
  }

  @Test
  void test_getAgentTypeCondition_singleAgentTypeWithComma() {
    ListFilter filter = new ListFilter();

    filter.addQueryParam("agentType", "CollateAI,");
    String condition = filter.getCondition("app_entity");

    assertTrue(condition.contains(":agentType_0"));
    assertEquals("CollateAI", filter.getQueryParams().get("agentType_0"));
    assertNull(filter.getQueryParams().get("agentType_1"));
  }
}
