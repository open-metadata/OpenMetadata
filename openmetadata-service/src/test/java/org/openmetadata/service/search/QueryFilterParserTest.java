package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
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
    assertFalse(QueryFilterParser.matchesFilter(entityMap, (Map<String, List<String>>) null));
  }

  // --- parseFilterClauses tests ---

  @Test
  void parseFilterClausesReturnsEmptyForNullOrEmptyInput() {
    assertTrue(QueryFilterParser.parseFilterClauses(null).isEmpty());
    assertTrue(QueryFilterParser.parseFilterClauses("").isEmpty());
  }

  @Test
  void parseFilterClausesReturnsEmptyClauseForWhitespaceOnly() {
    List<Map<String, List<String>>> clauses = QueryFilterParser.parseFilterClauses("   ");
    assertEquals(1, clauses.size());
    assertTrue(clauses.get(0).isEmpty());
  }

  @Test
  void parseFilterClausesParsesQueryStringAsSingleClause() {
    List<Map<String, List<String>>> clauses =
        QueryFilterParser.parseFilterClauses("tags.tagFQN.keyword:Tier.Gold");

    assertEquals(1, clauses.size());
    assertEquals(List.of("Tier.Gold"), clauses.get(0).get("tags.tagFQN"));
  }

  @Test
  void parseFilterClausesPreservesQuotedQueryStringValues() {
    List<Map<String, List<String>>> clauses =
        QueryFilterParser.parseFilterClauses(
            "displayName:\"Data Stewards\" service.name.keyword:warehouse_service");

    assertEquals(1, clauses.size());
    assertEquals(List.of("Data Stewards"), clauses.get(0).get("displayName"));
    assertEquals(List.of("warehouse_service"), clauses.get(0).get("service.name"));
  }

  @Test
  void parseFilterClausesSeparatesEachMustClause() {
    String jsonFilter =
        """
        {
          "query": {
            "bool": {
              "must": [
                {"term": {"tags.tagFQN.keyword": "Tier.Gold"}},
                {"term": {"tags.tagFQN.keyword": "CustID"}}
              ]
            }
          }
        }
        """;

    List<Map<String, List<String>>> clauses = QueryFilterParser.parseFilterClauses(jsonFilter);

    assertEquals(2, clauses.size());
    assertEquals(List.of("Tier.Gold"), clauses.get(0).get("tags.tagFQN"));
    assertEquals(List.of("CustID"), clauses.get(1).get("tags.tagFQN"));
  }

  @Test
  void parseFilterClausesHandlesMixedTermAndWildcard() {
    String jsonFilter =
        """
        {
          "query": {
            "bool": {
              "must": [
                {"term": {"tags.tagFQN.keyword": "PII.Sensitive"}},
                {"wildcard": {"name": {"value": "*sales*"}}},
                {"wildcard": {"displayName": {"value": "*sales*"}}}
              ]
            }
          }
        }
        """;

    List<Map<String, List<String>>> clauses = QueryFilterParser.parseFilterClauses(jsonFilter);

    assertEquals(3, clauses.size());
    assertEquals(List.of("PII.Sensitive"), clauses.get(0).get("tags.tagFQN"));
    assertEquals(List.of("sales"), clauses.get(1).get("name"));
    assertEquals(List.of("sales"), clauses.get(2).get("displayName"));
  }

  @Test
  void parseFilterClausesFallsBackToWholeNodeIfNoBoolMust() {
    String jsonFilter = """
        {"term": {"tags.tagFQN.keyword": "Tier.Gold"}}
        """;

    List<Map<String, List<String>>> clauses = QueryFilterParser.parseFilterClauses(jsonFilter);

    assertEquals(1, clauses.size());
    assertEquals(List.of("Tier.Gold"), clauses.get(0).get("tags.tagFQN"));
  }

  @Test
  void parseFilterClausesReturnsEmptyForInvalidJson() {
    List<Map<String, List<String>>> clauses = QueryFilterParser.parseFilterClauses("{bad-json");

    assertTrue(clauses.isEmpty());
  }

  @Test
  void parseFilterClausesSkipsEmptyMustClauses() {
    String jsonFilter =
        """
        {
          "query": {
            "bool": {
              "must": [
                {},
                {"term": {"tags.tagFQN.keyword": "Tier.Gold"}}
              ]
            }
          }
        }
        """;

    List<Map<String, List<String>>> clauses = QueryFilterParser.parseFilterClauses(jsonFilter);

    assertEquals(1, clauses.size());
    assertEquals(List.of("Tier.Gold"), clauses.get(0).get("tags.tagFQN"));
  }

  // --- matchesFilterClauses tests ---

  @Test
  void matchesFilterClausesReturnsFalseForNullEntityOrEmptyClauses() {
    assertFalse(QueryFilterParser.matchesFilterClauses(null, List.of()));
    assertFalse(QueryFilterParser.matchesFilterClauses(Map.of("name", "test"), null));
    assertFalse(QueryFilterParser.matchesFilterClauses(Map.of("name", "test"), List.of()));
  }

  @Test
  void matchesFilterClausesReturnsTrueWhenAllClausesMatch() {
    Map<String, Object> entityMap = new HashMap<>();
    entityMap.put("tags", List.of(Map.of("tagFQN", "Tier.Gold"), Map.of("tagFQN", "CustID")));
    entityMap.put("domain", Map.of("name", "Finance"));

    List<Map<String, List<String>>> clauses =
        List.of(
            Map.of("tags.tagFQN", List.of("Tier.Gold")),
            Map.of("tags.tagFQN", List.of("CustID")),
            Map.of("domain.name", List.of("Finance")));

    assertTrue(QueryFilterParser.matchesFilterClauses(entityMap, clauses));
  }

  @Test
  void matchesFilterClausesReturnsFalseWhenAnyClauseFails() {
    Map<String, Object> entityMap = new HashMap<>();
    entityMap.put("tags", List.of(Map.of("tagFQN", "Tier.Gold")));

    List<Map<String, List<String>>> clauses =
        List.of(
            Map.of("tags.tagFQN", List.of("Tier.Gold")), Map.of("tags.tagFQN", List.of("CustID")));

    assertFalse(QueryFilterParser.matchesFilterClauses(entityMap, clauses));
  }

  @Test
  void matchesFilterClausesSingleClauseBehavesLikeMatchesFilter() {
    Map<String, Object> entityMap = Map.of("description", "Monthly sales report");

    List<Map<String, List<String>>> clauses = List.of(Map.of("description", List.of("sales")));

    assertTrue(QueryFilterParser.matchesFilterClauses(entityMap, clauses));
  }

  // --- Wildcard query tests ---

  @Test
  void parseFilterHandlesWildcardQuerySimpleFormat() {
    String jsonFilter = """
        {"wildcard": {"name": "*data*"}}
        """;

    Map<String, List<String>> parsed = QueryFilterParser.parseFilter(jsonFilter);

    assertEquals(List.of("data"), parsed.get("name"));
  }

  @Test
  void parseFilterHandlesWildcardQueryObjectFormat() {
    String jsonFilter = """
        {"wildcard": {"name": {"value": "*data*"}}}
        """;

    Map<String, List<String>> parsed = QueryFilterParser.parseFilter(jsonFilter);

    assertEquals(List.of("data"), parsed.get("name"));
  }

  @Test
  void parseFilterSkipsWildcardWithOnlyStars() {
    String jsonFilter = """
        {"wildcard": {"name": "**"}}
        """;

    Map<String, List<String>> parsed = QueryFilterParser.parseFilter(jsonFilter);

    assertTrue(parsed.isEmpty());
  }

  // --- Name/DisplayName OR logic tests ---

  @Test
  void matchesFilterUsesOrLogicForNameAndDisplayNameSearch() {
    Map<String, Object> entity = new HashMap<>();
    entity.put("name", "sales_report");
    entity.put("displayName", "Monthly Revenue Report");
    entity.put("tags", List.of(Map.of("tagFQN", "PII.Sensitive")));

    Map<String, List<String>> filterMatchByName =
        Map.of(
            "name", List.of("sales"),
            "displayName", List.of("sales"),
            "tags.tagFQN", List.of("PII.Sensitive"));

    assertTrue(QueryFilterParser.matchesFilter(entity, filterMatchByName));

    Map<String, Object> entity2 = new HashMap<>();
    entity2.put("name", "no_match_here");
    entity2.put("displayName", "Sales Dashboard");

    Map<String, List<String>> filterMatchByDisplayName =
        Map.of(
            "name", List.of("sales"),
            "displayName", List.of("sales"));

    assertTrue(QueryFilterParser.matchesFilter(entity2, filterMatchByDisplayName));
  }

  @Test
  void matchesFilterReturnsFalseWhenNameSearchFailsBothFields() {
    Map<String, Object> entity = new HashMap<>();
    entity.put("name", "customer_table");
    entity.put("displayName", "Customer Data Table");

    Map<String, List<String>> filter =
        Map.of(
            "name", List.of("sales"),
            "displayName", List.of("sales"));

    assertFalse(QueryFilterParser.matchesFilter(entity, filter));
  }

  // --- Non-matching name/displayName (different values, not OR) ---

  @Test
  void matchesFilterSkipsNameAndDisplayNameFieldsInAndLoop() {
    Map<String, Object> entity = new HashMap<>();
    entity.put("name", "orders");
    entity.put("displayName", "Order Table");

    Map<String, List<String>> filter =
        Map.of(
            "name", List.of("orders"),
            "displayName", List.of("something_else"));

    assertTrue(QueryFilterParser.matchesFilter(entity, filter));
  }

  // --- Filter with "query" wrapper absent ---

  @Test
  void parseFilterClausesHandlesJsonWithoutQueryWrapper() {
    String jsonFilter =
        """
        {
          "bool": {
            "must": [
              {"term": {"service.name.keyword": "my_svc"}}
            ]
          }
        }
        """;

    List<Map<String, List<String>>> clauses = QueryFilterParser.parseFilterClauses(jsonFilter);

    assertEquals(1, clauses.size());
    assertEquals(List.of("my_svc"), clauses.get(0).get("service.name"));
  }

  // --- Bool filter array (non-array filter node) ---

  @Test
  void parseFilterHandlesBoolFilterAsObject() {
    String jsonFilter =
        """
        {
          "bool": {
            "filter": {"term": {"domain.name.keyword": "HR"}}
          }
        }
        """;

    Map<String, List<String>> parsed = QueryFilterParser.parseFilter(jsonFilter);

    assertEquals(List.of("HR"), parsed.get("domain.name"));
  }

  // --- Terms query within should ---

  @Test
  void parseFilterExtractsTermsFromShouldClause() {
    String jsonFilter =
        """
        {
          "bool": {
            "should": [
              {"terms": {"owners.name.keyword": ["alice", "bob"]}}
            ]
          }
        }
        """;

    Map<String, List<String>> parsed = QueryFilterParser.parseFilter(jsonFilter);

    assertEquals(List.of("alice", "bob"), parsed.get("owners.name"));
  }

  // --- matchesSingleValue uses substring matching ---

  @Test
  void matchesFilterTermQueryMatchesExactAndContains() {
    Map<String, List<String>> parsed =
        QueryFilterParser.parseFilter(
            """
        {"query":{"bool":{"must":[{"term":{"tags.tagFQN":"PII.Sensitive"}}]}}}
        """);

    Map<String, Object> exactMatch = new HashMap<>();
    exactMatch.put("tags", List.of(Map.of("tagFQN", "PII.Sensitive")));
    assertTrue(QueryFilterParser.matchesFilter(exactMatch, parsed));

    // Substring containing the filter value also matches (in-memory filter is permissive)
    Map<String, Object> containsMatch = new HashMap<>();
    containsMatch.put("tags", List.of(Map.of("tagFQN", "PII.SensitiveData")));
    assertTrue(QueryFilterParser.matchesFilter(containsMatch, parsed));

    // Completely unrelated tag should NOT match
    Map<String, Object> noMatch = new HashMap<>();
    noMatch.put("tags", List.of(Map.of("tagFQN", "Public.Open")));
    assertFalse(QueryFilterParser.matchesFilter(noMatch, parsed));
  }

  @Test
  void matchesFilterIsCaseInsensitive() {
    Map<String, List<String>> parsed =
        QueryFilterParser.parseFilter(
            """
        {"query":{"bool":{"must":[{"term":{"tags.tagFQN":"Tier.Tier1"}}]}}}
        """);

    Map<String, Object> entity = new HashMap<>();
    entity.put("tags", List.of(Map.of("tagFQN", "tier.tier1")));
    assertTrue(QueryFilterParser.matchesFilter(entity, parsed));
  }

  @Test
  void matchesFilterNameSearchUsesSubstringMatch() {
    Map<String, List<String>> parsed =
        QueryFilterParser.parseFilter(
            """
        {"query":{"bool":{"must":[
          {"wildcard":{"name":{"value":"*table*"}}},
          {"wildcard":{"displayName":{"value":"*table*"}}}
        ]}}}
        """);

    Map<String, Object> entity = new HashMap<>();
    entity.put("name", "my_table_v2");
    entity.put("displayName", "My Table V2");
    assertTrue(QueryFilterParser.matchesFilter(entity, parsed));

    Map<String, Object> noMatch = new HashMap<>();
    noMatch.put("name", "my_view");
    noMatch.put("displayName", "My View");
    assertFalse(QueryFilterParser.matchesFilter(noMatch, parsed));
  }

  // --- getNestedFieldValue returns null on empty extraction ---

  @Test
  void matchesFilterReturnsNullForMissingNestedField() {
    Map<String, List<String>> parsed =
        QueryFilterParser.parseFilter(
            """
        {"query":{"bool":{"must":[{"term":{"tags.nonExistentField":"value"}}]}}}
        """);

    Map<String, Object> entity = new HashMap<>();
    entity.put("tags", List.of(Map.of("tagFQN", "PII.Sensitive")));
    assertFalse(QueryFilterParser.matchesFilter(entity, parsed));
  }

  @Test
  void matchesFilterScalarSubstringMatch() {
    Map<String, List<String>> parsed =
        QueryFilterParser.parseFilter(
            """
        {"query":{"bool":{"must":[{"term":{"deleted":"false"}}]}}}
        """);

    Map<String, Object> entity = new HashMap<>();
    entity.put("deleted", "false");
    assertTrue(QueryFilterParser.matchesFilter(entity, parsed));

    // Completely different value should not match
    Map<String, Object> mismatch = new HashMap<>();
    mismatch.put("deleted", "true");
    assertFalse(QueryFilterParser.matchesFilter(mismatch, parsed));
  }

  // --- hasNameSearch edge case: different name vs displayName values ---

  @Test
  void matchesFilterNameSearchRequiresSameValuesForOrLogic() {
    // When name and displayName have the SAME values, OR logic applies
    Map<String, List<String>> orParsed =
        QueryFilterParser.parseFilter(
            """
        {"query":{"bool":{"must":[
          {"wildcard":{"name":{"value":"*users*"}}},
          {"wildcard":{"displayName":{"value":"*users*"}}}
        ]}}}
        """);

    Map<String, Object> nameOnly = new HashMap<>();
    nameOnly.put("name", "users_table");
    nameOnly.put("displayName", "Other");
    // OR logic: name contains "users" → true even though displayName doesn't
    assertTrue(QueryFilterParser.matchesFilter(nameOnly, orParsed));

    Map<String, Object> displayNameOnly = new HashMap<>();
    displayNameOnly.put("name", "other");
    displayNameOnly.put("displayName", "users_table");
    // OR logic: displayName contains "users" → true
    assertTrue(QueryFilterParser.matchesFilter(displayNameOnly, orParsed));

    Map<String, Object> neither = new HashMap<>();
    neither.put("name", "other");
    neither.put("displayName", "other");
    assertFalse(QueryFilterParser.matchesFilter(neither, orParsed));
  }

  // --- Wildcard ? character removal ---

  @Test
  void parseFilterStripsQuestionMarkFromWildcard() {
    Map<String, List<String>> parsed =
        QueryFilterParser.parseFilter(
            """
        {"wildcard": {"name": {"value": "tabl?"}}}
        """);

    assertEquals(List.of("tabl"), parsed.get("name"));
  }

  // --- 3+ level nested field extraction ---

  @Test
  void matchesFilterHandlesThreeLevelNesting() {
    Map<String, List<String>> parsed =
        QueryFilterParser.parseFilter(
            """
        {"term": {"service.connection.type": "MySQL"}}
        """);

    Map<String, Object> entity = new HashMap<>();
    entity.put("service", Map.of("connection", Map.of("type", "MySQL")));
    assertTrue(QueryFilterParser.matchesFilter(entity, parsed));

    Map<String, Object> mismatch = new HashMap<>();
    mismatch.put("service", Map.of("connection", Map.of("type", "Postgres")));
    assertFalse(QueryFilterParser.matchesFilter(mismatch, parsed));
  }

  // --- matchesFilter with Map values containing null fields ---

  @Test
  void matchesFilterHandlesMapWithNullSubFields() {
    Map<String, List<String>> parsed =
        QueryFilterParser.parseFilter(
            """
        {"term": {"owners.displayName": "Alice"}}
        """);

    // Map with null displayName should not match
    Map<String, Object> entity = new HashMap<>();
    Map<String, Object> ownerWithNullName = new HashMap<>();
    ownerWithNullName.put("displayName", null);
    ownerWithNullName.put("name", "alice_user");
    entity.put("owners", List.of(ownerWithNullName));
    assertFalse(QueryFilterParser.matchesFilter(entity, parsed));
  }

  @Test
  void matchesFilterQueryUsesExactSemanticsForTermQueries() {
    String queryFilter =
        """
        {"query":{"bool":{"must":[{"term":{"tags.tagFQN.keyword":"PII.Sensitive"}}]}}}
        """;

    Map<String, Object> exactMatch = Map.of("tags", List.of(Map.of("tagFQN", "PII.Sensitive")));
    Map<String, Object> containsMatch =
        Map.of("tags", List.of(Map.of("tagFQN", "PII.SensitiveData")));

    assertTrue(QueryFilterParser.matchesFilter(exactMatch, queryFilter));
    assertFalse(QueryFilterParser.matchesFilter(containsMatch, queryFilter));
  }

  @Test
  void matchesFilterQueryKeepsPartialSemanticsForWildcardQueries() {
    String queryFilter =
        """
        {"query":{"bool":{"must":[
          {"wildcard":{"name":{"value":"*sales*"}}},
          {"wildcard":{"displayName":{"value":"*sales*"}}}
        ]}}}
        """;

    Map<String, Object> entity = Map.of("name", "daily_sales_table", "displayName", "Sales Table");
    Map<String, Object> noMatch = Map.of("name", "inventory", "displayName", "Inventory");

    assertTrue(QueryFilterParser.matchesFilter(entity, queryFilter));
    assertFalse(QueryFilterParser.matchesFilter(noMatch, queryFilter));
  }

  @Test
  void matchesFilterQuerySupportsMustNotClauses() {
    String queryFilter =
        """
        {"query":{"bool":{"must":[{"term":{"entityType":"table"}}],"must_not":[{"term":{"deleted":"true"}}]}}}
        """;

    Map<String, Object> activeEntity = Map.of("entityType", "table", "deleted", "false");
    Map<String, Object> deletedEntity = Map.of("entityType", "table", "deleted", "true");

    assertTrue(QueryFilterParser.matchesFilter(activeEntity, queryFilter));
    assertFalse(QueryFilterParser.matchesFilter(deletedEntity, queryFilter));
  }

  @Test
  void matchesFilterQuerySupportsExistsClauses() {
    String queryFilter =
        """
        {"query":{"bool":{"filter":[{"exists":{"field":"owners.displayName"}}]}}}
        """;

    Map<String, Object> entityWithOwners =
        Map.of("owners", List.of(Map.of("displayName", "Data Steward")));
    Map<String, Object> entityWithoutOwners = Map.of("owners", List.of(Map.of("name", "steward")));

    assertTrue(QueryFilterParser.matchesFilter(entityWithOwners, queryFilter));
    assertFalse(QueryFilterParser.matchesFilter(entityWithoutOwners, queryFilter));
  }

  @Test
  void matchesFilterQuerySupportsPrefixClauses() {
    String queryFilter =
        """
        {"query":{"bool":{"must":[{"prefix":{"name":{"value":"cust"}}}]}}}
        """;

    Map<String, Object> matchingEntity = Map.of("name", "customer_orders");
    Map<String, Object> nonMatchingEntity = Map.of("name", "orders_customer");

    assertTrue(QueryFilterParser.matchesFilter(matchingEntity, queryFilter));
    assertFalse(QueryFilterParser.matchesFilter(nonMatchingEntity, queryFilter));
  }

  @Test
  void matchesFilterQuerySupportsRangeClauses() {
    String queryFilter =
        """
        {"query":{"bool":{"filter":[{"range":{"usageCount":{"gte":3,"lt":10}}}]}}}
        """;

    Map<String, Object> matchingEntity = Map.of("usageCount", 5);
    Map<String, Object> tooSmall = Map.of("usageCount", 2);
    Map<String, Object> tooLarge = Map.of("usageCount", 10);

    assertTrue(QueryFilterParser.matchesFilter(matchingEntity, queryFilter));
    assertFalse(QueryFilterParser.matchesFilter(tooSmall, queryFilter));
    assertFalse(QueryFilterParser.matchesFilter(tooLarge, queryFilter));
  }

  @Test
  void matchesTypedFilterClausesRequireEveryRepeatedMustClause() {
    String queryFilter =
        """
        {
          "query": {
            "bool": {
              "must": [
                {"term": {"tags.tagFQN.keyword": "Tier.Gold"}},
                {"term": {"tags.tagFQN.keyword": "CustID"}}
              ]
            }
          }
        }
        """;

    Map<String, Object> matchingEntity =
        Map.of("tags", List.of(Map.of("tagFQN", "Tier.Gold"), Map.of("tagFQN", "CustID")));
    Map<String, Object> missingSecondTag = Map.of("tags", List.of(Map.of("tagFQN", "Tier.Gold")));

    assertTrue(QueryFilterParser.matchesFilter(matchingEntity, queryFilter));
    assertFalse(QueryFilterParser.matchesFilter(missingSecondTag, queryFilter));
  }
}
