/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

public class SearchUtilsTest {

  @Test
  void testSanitizeQueryParameter_NullInput() {
    // Test null input
    assertNull(SearchUtils.sanitizeQueryParameter(null));
  }

  @Test
  void testSanitizeQueryParameter_EmptyInput() {
    // Test empty string
    assertEquals("", SearchUtils.sanitizeQueryParameter(""));
  }

  @Test
  void testSanitizeQueryParameter_EmptyJsonInput() {
    // Test empty JSON object
    assertEquals("{}", SearchUtils.sanitizeQueryParameter("{}"));
  }

  @Test
  void testSanitizeQueryParameter_LegitimateQuery() {
    // Test legitimate queries are preserved
    String legitimateQuery = "{\"term\": {\"field\": \"value\"}}";
    assertEquals(legitimateQuery, SearchUtils.sanitizeQueryParameter(legitimateQuery));
  }

  @Test
  void testSanitizeQueryParameter_ComplexLegitimateQuery() {
    // Test complex legitimate queries are preserved
    String complexQuery =
        "{\"bool\": {\"must\": [{\"term\": {\"status\": \"active\"}}], \"filter\": [{\"range\": {\"date\": {\"gte\": \"2023-01-01\"}}}]}}";
    assertEquals(complexQuery, SearchUtils.sanitizeQueryParameter(complexQuery));
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        // SQL injection patterns from security report
        "false\" AND \"1\"=\"1\" --",
        "false\" OR \"1\"=\"1\" --",
        "false' AND '1'='1' --",
        "false' OR '1'='1' --",
        "field' AND '1'='1",
        "field' AND '1'='2",
        "field\" AND \"1\"=\"1",
        "field\" AND \"1\"=\"2",
        "true AND 1=1",
        "true AND 1=2"
      })
  void testSanitizeQueryParameter_SqlInjectionPatterns(String maliciousInput) {
    // Test that all SQL injection patterns are sanitized
    String result = SearchUtils.sanitizeQueryParameter(maliciousInput);

    // Verify dangerous patterns are removed
    assertTrue(!result.contains("' AND '"));
    assertTrue(!result.contains("\" AND \""));
    assertTrue(!result.contains("' OR '"));
    assertTrue(!result.contains("\" OR \""));
    assertTrue(!result.contains("1=1"));
    assertTrue(!result.contains("1=2"));
    assertTrue(!result.contains("--"));
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        // Time-based SQL injection patterns
        "case randomblob(100000) when not null then 1 else 1 end",
        "case randomblob(1000000) when not null then 1 else 1 end",
        "case randomblob(100000000) when not null then 1 else 1 end",
        "(SELECT UTL_INADDR.get_host_name('10.0.0.1') from dual)",
        "UTL_INADDR.get_host_name('10.0.0.2')",
        "union select * from users"
      })
  void testSanitizeQueryParameter_TimeBasedSqlInjectionPatterns(String maliciousInput) {
    // Test time-based and Oracle-specific SQL injection patterns
    String result = SearchUtils.sanitizeQueryParameter(maliciousInput);

    // Verify dangerous patterns are removed
    assertTrue(!result.contains("randomblob("));
    assertTrue(!result.contains("UTL_INADDR.get_host_name"));
    assertTrue(!result.contains("union select"));
  }

  @Test
  void testSanitizeQueryParameter_CommentInjection() {
    // Test SQL comment injection patterns
    String[] commentPatterns = {
      "field--comment", "field/*comment*/value", "field;DROP TABLE users;", "field/**/value"
    };

    for (String pattern : commentPatterns) {
      String result = SearchUtils.sanitizeQueryParameter(pattern);
      assertTrue(!result.contains("--"));
      assertTrue(!result.contains("/*"));
      assertTrue(!result.contains("*/"));
      assertTrue(!result.contains(";"));
    }
  }

  @Test
  void testSanitizeQueryParameter_LengthLimit() {
    // Test length limit enforcement
    StringBuilder longInput = new StringBuilder();
    for (int i = 0; i < 10001; i++) {
      longInput.append('a');
    }

    assertThrows(
        IllegalArgumentException.class,
        () -> {
          SearchUtils.sanitizeQueryParameter(longInput.toString());
        });
  }

  @Test
  void testSanitizeQueryParameter_LengthLimitBoundary() {
    // Test length limit boundary (exactly 10000 characters should pass)
    StringBuilder maxLengthInput = new StringBuilder();
    for (int i = 0; i < 10000; i++) {
      maxLengthInput.append('a');
    }

    String result = SearchUtils.sanitizeQueryParameter(maxLengthInput.toString());
    assertEquals(10000, result.length());
  }

  @Test
  void testSanitizeQueryParameter_CaseInsensitivePatterns() {
    // Test case insensitive pattern matching
    String[] caseVariations = {
      "field' and '1'='1", "field' AND '1'='1", "field' And '1'='1", "field' aND '1'='1"
    };

    for (String variation : caseVariations) {
      String result = SearchUtils.sanitizeQueryParameter(variation);
      assertTrue(!result.contains("' and '"));
      assertTrue(!result.contains("' AND '"));
      assertTrue(!result.contains("' And '"));
      assertTrue(!result.contains("' aND '"));
    }
  }

  @Test
  void testSanitizeQueryParameter_PreserveValidElasticsearchQuery() {
    // Test that valid Elasticsearch queries are preserved
    String validEsQuery =
        "{\"query\": {\"bool\": {\"must\": [{\"match\": {\"title\": \"search\"}}]}}}";
    String result = SearchUtils.sanitizeQueryParameter(validEsQuery);
    assertEquals(validEsQuery, result);
  }

  @Test
  void testSanitizeQueryParameter_PreserveValidFilters() {
    // Test that valid filter queries are preserved
    String validFilter = "{\"term\": {\"deleted\": false}}";
    String result = SearchUtils.sanitizeQueryParameter(validFilter);
    assertEquals(validFilter, result);
  }

  @Test
  void testSanitizeQueryParameter_MixedContent() {
    // Test input with both valid content and malicious patterns
    String mixedInput = "{\"term\": {\"field\": \"value\"}} AND 1=1 --";
    String result = SearchUtils.sanitizeQueryParameter(mixedInput);

    // Should preserve valid JSON part and remove malicious part
    assertTrue(result.contains("{\"term\": {\"field\": \"value\"}}"));
    assertTrue(!result.contains("AND 1=1"));
    assertTrue(!result.contains("--"));
  }

  @Test
  void testSanitizeQueryParameter_NestedInjectionAttempts() {
    // Test nested/encoded injection attempts
    String nestedInput = "field' OR ('1'='1' AND 'admin'='admin') --";
    String result = SearchUtils.sanitizeQueryParameter(nestedInput);

    assertTrue(!result.contains("' OR '"));
    assertTrue(!result.contains("' AND '"));
    assertTrue(!result.contains("--"));
  }

  @Test
  void testSanitizeQueryParameter_PerformanceWithLargeInput() {
    // Test performance with large legitimate input (under 10k chars limit)
    StringBuilder largeValidInput = new StringBuilder("{\"query\": {\"bool\": {\"must\": [");
    for (int i = 0; i < 200; i++) { // Reduced from 1000 to stay under 10k limit
      if (i > 0) largeValidInput.append(",");
      largeValidInput
          .append("{\"term\": {\"field")
          .append(i)
          .append("\": \"value")
          .append(i)
          .append("\"}}");
    }
    largeValidInput.append("]}}}");

    // Ensure we're under the limit
    assertTrue(largeValidInput.length() < 10000, "Test input should be under 10k character limit");

    long startTime = System.currentTimeMillis();
    String result = SearchUtils.sanitizeQueryParameter(largeValidInput.toString());
    long duration = System.currentTimeMillis() - startTime;

    // Should complete quickly (under 100ms for large input)
    assertTrue(duration < 100, "Sanitization should be fast even for large inputs");
    assertEquals(largeValidInput.toString(), result);
  }

  @Test
  void testSanitizeUserInput_ListFilterAgentTypeVulnerability() {
    // Test the specific vulnerability from /v1/apps?agentType=' OR Select 123; --
    String maliciousAgentType = "' OR Select 123; --";
    String result = SearchUtils.sanitizeUserInput(maliciousAgentType, 255);

    // Should remove dangerous patterns
    assertTrue(!result.contains("' OR "));
    assertTrue(!result.contains("Select")); // Now should work with expanded patterns
    assertTrue(!result.contains("--"));
    assertTrue(!result.contains(";")); // Semicolons are also removed

    // Result should be heavily sanitized - only numbers remain
    assertEquals("123", result.trim()); // Only safe parts remain
  }

  @Test
  void testSanitizeUserInput_DifferentLengthLimits() {
    // Test with short length limit
    String validShortInput = "validAgentType";
    String result = SearchUtils.sanitizeUserInput(validShortInput, 20);
    assertEquals(validShortInput, result);

    // Test length limit enforcement
    String longInput = "this_is_a_very_long_agent_type_name_that_exceeds_limit";
    assertThrows(
        IllegalArgumentException.class,
        () -> {
          SearchUtils.sanitizeUserInput(longInput, 10);
        });
  }

  @Test
  void testSanitizeUserInput_AllListFilterVulnerabilities() {
    // Test patterns that could be used in ListFilter parameters
    String[] vulnerableInputs = {
      "normalValue' OR '1'='1' --",
      "directory' UNION SELECT * FROM users --",
      "fileType'; DROP TABLE test; --",
      "assignee' AND randomblob(100000) --"
    };

    for (String input : vulnerableInputs) {
      String result = SearchUtils.sanitizeUserInput(input, 255);

      // Verify dangerous patterns are removed
      assertTrue(!result.contains("' OR '"));
      assertTrue(!result.contains("' AND '"));
      assertTrue(!result.contains("union select"));
      assertTrue(!result.contains("drop table"));
      assertTrue(!result.contains("--"));
      assertTrue(!result.contains("randomblob("));
    }
  }
}
