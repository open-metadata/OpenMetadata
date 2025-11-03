package org.openmetadata.service.search.elasticsearch;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.core.JsonProcessingException;
import org.junit.jupiter.api.Test;

class EsUtilsTest {
  @Test
  void testParseJsonQuery_withOuterQueryWrapper() throws JsonProcessingException {
    String queryWithWrapper =
        """
        {
          "query": {
            "term": {
              "field": "value"
            }
          }
        }
        """;

    String result = EsUtils.parseJsonQuery(queryWithWrapper);

    assertNotNull(result);
    assertTrue(result.contains("term"));
    assertTrue(result.contains("field"));
    assertTrue(result.contains("value"));
  }

  @Test
  void testParseJsonQuery_withoutOuterQueryWrapper() throws JsonProcessingException {
    String queryWithoutWrapper =
        """
        {
          "term": {
            "field": "value"
          }
        }
        """;

    String result = EsUtils.parseJsonQuery(queryWithoutWrapper);

    assertNotNull(result);
    assertTrue(result.contains("term"));
    assertTrue(result.contains("field"));
    assertTrue(result.contains("value"));
    assertEquals(queryWithoutWrapper.trim().replaceAll("\\s+", ""), result.replaceAll("\\s+", ""));
  }

  @Test
  void testParseJsonQuery_withBoolQuery() throws JsonProcessingException {
    String boolQuery =
        """
        {
          "query": {
            "bool": {
              "must": [
                {"term": {"status": "active"}},
                {"range": {"age": {"gte": 18}}}
              ]
            }
          }
        }
        """;

    String result = EsUtils.parseJsonQuery(boolQuery);

    assertNotNull(result);
    assertTrue(result.contains("bool"));
    assertTrue(result.contains("must"));
    assertTrue(result.contains("status"));
    assertTrue(result.contains("active"));
  }

  @Test
  void testParseJsonQuery_withMatchQuery() throws JsonProcessingException {
    String matchQuery =
        """
        {
          "query": {
            "match": {
              "description": "test query"
            }
          }
        }
        """;

    String result = EsUtils.parseJsonQuery(matchQuery);

    assertNotNull(result);
    assertTrue(result.contains("match"));
    assertTrue(result.contains("description"));
    assertTrue(result.contains("test query"));
  }

  @Test
  void testParseJsonQuery_withNestedQuery() throws JsonProcessingException {
    String nestedQuery =
        """
        {
          "query": {
            "nested": {
              "path": "user",
              "query": {
                "term": {"user.name": "john"}
              }
            }
          }
        }
        """;

    String result = EsUtils.parseJsonQuery(nestedQuery);

    assertNotNull(result);
    assertTrue(result.contains("nested"));
    assertTrue(result.contains("path"));
    assertTrue(result.contains("user"));
  }

  @Test
  void testParseJsonQuery_simpleTermQuery() throws JsonProcessingException {
    String simpleQuery = """
        {
          "term": {"owner": "admin"}
        }
        """;

    String result = EsUtils.parseJsonQuery(simpleQuery);

    assertNotNull(result);
    assertTrue(result.contains("term"));
    assertTrue(result.contains("owner"));
    assertTrue(result.contains("admin"));
  }

  @Test
  void testParseJsonQuery_invalidJson() {
    String invalidJson = "{ invalid json";

    assertThrows(JsonProcessingException.class, () -> EsUtils.parseJsonQuery(invalidJson));
  }

  @Test
  void testParseJsonQuery_emptyObject() throws JsonProcessingException {
    String emptyQuery = "{}";

    String result = EsUtils.parseJsonQuery(emptyQuery);

    assertNotNull(result);
    assertEquals("{}", result);
  }

  @Test
  void testParseJsonQuery_queryWrapperOnly() throws JsonProcessingException {
    String queryWrapperOnly = """
        {
          "query": {}
        }
        """;

    String result = EsUtils.parseJsonQuery(queryWrapperOnly);

    assertNotNull(result);
    assertEquals("{}", result);
  }

  @Test
  void testParseJsonQuery_complexNestedStructure() throws JsonProcessingException {
    String complexQuery =
        """
        {
          "query": {
            "bool": {
              "must": [
                {
                  "nested": {
                    "path": "tags",
                    "query": {
                      "term": {"tags.name": "important"}
                    }
                  }
                }
              ],
              "filter": [
                {"term": {"deleted": false}}
              ]
            }
          }
        }
        """;

    String result = EsUtils.parseJsonQuery(complexQuery);

    assertNotNull(result);
    assertTrue(result.contains("bool"));
    assertTrue(result.contains("must"));
    assertTrue(result.contains("filter"));
    assertTrue(result.contains("nested"));
    assertTrue(result.contains("tags"));
  }
}
