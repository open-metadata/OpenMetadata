package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class QueryFilterParserTest {

  @Test
  void parseFilterExtractsFieldValuesFromJsonDsl() {
    String jsonFilter =
        """
        {
          "query": {
            "bool": {
              "must": [
                {"term": {"service.name.keyword": "warehouse_service"}},
                {"terms": {"tags.tagFQN.keyword": ["PII.Sensitive", "Glossary.Location"]}}
              ],
              "should": {"match": {"owners.displayName": "Data Stewards"}},
              "filter": [{"match": {"domain.name.keyword": "Finance"}}]
            }
          }
        }
        """;

    Map<String, List<String>> parsed = QueryFilterParser.parseFilter(jsonFilter);

    assertEquals(List.of("warehouse_service"), parsed.get("service.name"));
    assertEquals(List.of("PII.Sensitive", "Glossary.Location"), parsed.get("tags.tagFQN"));
    assertEquals(List.of("Data Stewards"), parsed.get("owners.displayName"));
    assertEquals(List.of("Finance"), parsed.get("domain.name"));
  }

  @Test
  void parseFilterHandlesQueryStringsAndInvalidJson() {
    Map<String, List<String>> parsed =
        QueryFilterParser.parseFilter(
            "owners.displayName.keyword:DataStewards tags.tagFQN.keyword:Tier.Gold sqlQuery:select:1");

    assertEquals(List.of("DataStewards"), parsed.get("owners.displayName"));
    assertEquals(List.of("Tier.Gold"), parsed.get("tags.tagFQN"));
    assertEquals(List.of("select:1"), parsed.get("sqlQuery"));

    assertTrue(QueryFilterParser.parseFilter("   ").isEmpty());
    assertTrue(QueryFilterParser.parseFilter("{not-json").isEmpty());
  }

  @Test
  void matchesFilterSupportsNestedMapsListsAndScalars() {
    Map<String, Object> entityMap =
        Map.of(
            "owners", List.of(Map.of("displayName", "Data Stewards"), Map.of("name", "governance")),
            "tags", List.of(Map.of("tagFQN", "PII.Sensitive")),
            "domain", Map.of("name", "Finance"),
            "followers", List.of("alice", "bob"),
            "description", "Fact table for monthly sales");

    Map<String, List<String>> parsedFilter =
        Map.of(
            "owners", List.of("stewards"),
            "tags", List.of("sensitive"),
            "domain", List.of("fin"),
            "followers", List.of("ali"),
            "description", List.of("sales"));

    assertTrue(QueryFilterParser.matchesFilter(entityMap, parsedFilter));
  }

  @Test
  void matchesFilterReturnsFalseForMissingOrEmptyCriteria() {
    Map<String, Object> entityMap =
        Map.of("owners", List.of(Map.of("displayName", "Data Stewards")), "description", "sales");

    assertFalse(QueryFilterParser.matchesFilter(entityMap, Map.of("owners", List.of("finance"))));
    assertFalse(
        QueryFilterParser.matchesFilter(entityMap, Map.of("missing.field", List.of("anything"))));
    assertFalse(QueryFilterParser.matchesFilter(entityMap, Map.of()));
    assertFalse(QueryFilterParser.matchesFilter(null, Map.of("description", List.of("sales"))));
    assertFalse(QueryFilterParser.matchesFilter(entityMap, null));
  }
}
