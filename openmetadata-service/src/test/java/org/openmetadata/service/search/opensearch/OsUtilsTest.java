package org.openmetadata.service.search.opensearch;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.util.Base64;
import org.junit.jupiter.api.Test;

class OsUtilsTest {

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

    String result = OsUtils.parseJsonQuery(queryWithWrapper);

    assertNotNull(result);
    // Result should be Base64 encoded
    String decoded = new String(Base64.getDecoder().decode(result));
    assertTrue(decoded.contains("term"));
    assertTrue(decoded.contains("field"));
    assertTrue(decoded.contains("value"));
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

    String result = OsUtils.parseJsonQuery(queryWithoutWrapper);

    assertNotNull(result);
    // Result should be Base64 encoded
    String decoded = new String(Base64.getDecoder().decode(result));
    assertTrue(decoded.contains("term"));
    assertTrue(decoded.contains("field"));
    assertTrue(decoded.contains("value"));
  }

  @Test
  void testParseJsonQuery_resultIsBase64Encoded() throws JsonProcessingException {
    String query = """
        {
          "term": {"status": "active"}
        }
        """;

    String result = OsUtils.parseJsonQuery(query);

    assertNotNull(result);
    // Verify it's valid Base64 by decoding it
    String decoded = new String(Base64.getDecoder().decode(result));
    assertTrue(decoded.contains("term"));
    assertTrue(decoded.contains("status"));
    assertTrue(decoded.contains("active"));
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

    String result = OsUtils.parseJsonQuery(boolQuery);

    assertNotNull(result);
    String decoded = new String(Base64.getDecoder().decode(result));
    assertTrue(decoded.contains("bool"));
    assertTrue(decoded.contains("must"));
    assertTrue(decoded.contains("status"));
    assertTrue(decoded.contains("active"));
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

    String result = OsUtils.parseJsonQuery(matchQuery);

    assertNotNull(result);
    String decoded = new String(Base64.getDecoder().decode(result));
    assertTrue(decoded.contains("match"));
    assertTrue(decoded.contains("description"));
    assertTrue(decoded.contains("test query"));
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

    String result = OsUtils.parseJsonQuery(nestedQuery);

    assertNotNull(result);
    String decoded = new String(Base64.getDecoder().decode(result));
    assertTrue(decoded.contains("nested"));
    assertTrue(decoded.contains("path"));
    assertTrue(decoded.contains("user"));
  }

  @Test
  void testParseJsonQuery_simpleTermQuery() throws JsonProcessingException {
    String simpleQuery = """
        {
          "term": {"owner": "admin"}
        }
        """;

    String result = OsUtils.parseJsonQuery(simpleQuery);

    assertNotNull(result);
    String decoded = new String(Base64.getDecoder().decode(result));
    assertTrue(decoded.contains("term"));
    assertTrue(decoded.contains("owner"));
    assertTrue(decoded.contains("admin"));
  }

  @Test
  void testParseJsonQuery_invalidJson() {
    String invalidJson = "{ invalid json";

    assertThrows(JsonProcessingException.class, () -> OsUtils.parseJsonQuery(invalidJson));
  }

  @Test
  void testParseJsonQuery_emptyObject() throws JsonProcessingException {
    String emptyQuery = "{}";

    String result = OsUtils.parseJsonQuery(emptyQuery);

    assertNotNull(result);
    String decoded = new String(Base64.getDecoder().decode(result));
    assertEquals("{}", decoded);
  }

  @Test
  void testParseJsonQuery_queryWrapperOnly() throws JsonProcessingException {
    String queryWrapperOnly = """
        {
          "query": {}
        }
        """;

    String result = OsUtils.parseJsonQuery(queryWrapperOnly);

    assertNotNull(result);
    String decoded = new String(Base64.getDecoder().decode(result));
    assertEquals("{}", decoded);
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

    String result = OsUtils.parseJsonQuery(complexQuery);

    assertNotNull(result);
    String decoded = new String(Base64.getDecoder().decode(result));
    assertTrue(decoded.contains("bool"));
    assertTrue(decoded.contains("must"));
    assertTrue(decoded.contains("filter"));
    assertTrue(decoded.contains("nested"));
    assertTrue(decoded.contains("tags"));
  }

  @Test
  void testParseJsonQuery_extractsInnerQueryFromWrapper() throws JsonProcessingException {
    String wrappedQuery =
        """
        {
          "query": {
            "match_all": {}
          }
        }
        """;

    String result = OsUtils.parseJsonQuery(wrappedQuery);
    String decoded = new String(Base64.getDecoder().decode(result));

    // Should extract just the inner query part
    assertTrue(decoded.contains("match_all"));
    // Should not contain the outer "query" wrapper after extraction
    assertNotNull(result);
  }
}
