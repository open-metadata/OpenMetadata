package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class VectorSearchQueryBuilderTest {

  private static final ObjectMapper MAPPER = new ObjectMapper();

  @Test
  void testBuildsValidQueryWithNoFilters() throws Exception {
    float[] vector = {0.1f, 0.2f, 0.3f};
    int size = 10;
    int k = 100;
    Map<String, List<String>> filters = Map.of();

    String query = VectorSearchQueryBuilder.build(vector, size, k, filters);

    assertNotNull(query);

    JsonNode root = MAPPER.readTree(query);
    assertEquals(size, root.get("size").asInt());

    // Verify knn structure
    JsonNode knn = root.get("query").get("knn");
    assertNotNull(knn);

    JsonNode embedding = knn.get("embedding");
    assertNotNull(embedding);
    assertEquals(k, embedding.get("k").asInt());

    // Verify vector array
    JsonNode vectorNode = embedding.get("vector");
    assertNotNull(vectorNode);
    assertTrue(vectorNode.isArray());
    assertEquals(3, vectorNode.size());

    // Verify deleted=false filter is always present
    JsonNode filter = embedding.get("filter").get("bool").get("must");
    assertNotNull(filter);
    assertTrue(filter.isArray());

    // First filter should always be deleted=false
    JsonNode deletedFilter = filter.get(0);
    assertTrue(deletedFilter.has("term"));
    assertEquals(false, deletedFilter.get("term").get("deleted").asBoolean());
  }

  @Test
  void testBuildsQueryWithEntityTypeFilter() throws Exception {
    float[] vector = {0.5f, 0.5f};
    int size = 5;
    int k = 50;
    Map<String, List<String>> filters = Map.of("entityType", List.of("table", "dashboard"));

    String query = VectorSearchQueryBuilder.build(vector, size, k, filters);

    JsonNode root = MAPPER.readTree(query);
    JsonNode mustFilters =
        root.get("query").get("knn").get("embedding").get("filter").get("bool").get("must");

    // Should have 2 filters: deleted=false + entityType
    assertEquals(2, mustFilters.size());

    // Second filter should be entityType
    JsonNode entityTypeFilter = mustFilters.get(1);
    assertTrue(entityTypeFilter.has("terms"));
    assertTrue(entityTypeFilter.get("terms").has("entityType"));

    JsonNode entityTypes = entityTypeFilter.get("terms").get("entityType");
    assertEquals(2, entityTypes.size());
    assertEquals("table", entityTypes.get(0).asText());
    assertEquals("dashboard", entityTypes.get(1).asText());
  }

  @Test
  void testBuildsQueryWithOwnersFilter() throws Exception {
    float[] vector = {0.1f};
    int size = 10;
    int k = 100;
    Map<String, List<String>> filters = Map.of("owners", List.of("user1", "team2"));

    String query = VectorSearchQueryBuilder.build(vector, size, k, filters);

    JsonNode root = MAPPER.readTree(query);
    JsonNode mustFilters =
        root.get("query").get("knn").get("embedding").get("filter").get("bool").get("must");

    // Should have 2 filters: deleted=false + owners
    assertEquals(2, mustFilters.size());

    // Second filter should be bool.should with nested owners queries
    JsonNode ownersFilter = mustFilters.get(1);
    assertTrue(ownersFilter.has("bool"));

    JsonNode boolQuery = ownersFilter.get("bool");
    JsonNode shouldClauses = boolQuery.get("should");
    assertNotNull(shouldClauses);
    assertEquals(2, shouldClauses.size());

    // Each should clause should be a nested query
    JsonNode firstOwner = shouldClauses.get(0);
    assertTrue(firstOwner.has("nested"));
    assertEquals("owners", firstOwner.get("nested").get("path").asText());

    // Verify owner names are present
    String ownersJson = shouldClauses.toString();
    assertTrue(ownersJson.contains("user1"));
    assertTrue(ownersJson.contains("team2"));
  }

  @Test
  void testBuildsQueryWithSpecialOwnerValue__ANY__() throws Exception {
    float[] vector = {0.1f};
    int size = 10;
    int k = 100;
    Map<String, List<String>> filters = Map.of("owners", List.of("__ANY__"));

    String query = VectorSearchQueryBuilder.build(vector, size, k, filters);

    JsonNode root = MAPPER.readTree(query);
    JsonNode mustFilters =
        root.get("query").get("knn").get("embedding").get("filter").get("bool").get("must");

    // Should have 2 filters: deleted=false + owners exists
    assertEquals(2, mustFilters.size());

    // Second filter should be bool.should with nested exists query
    JsonNode ownersFilter = mustFilters.get(1);
    assertTrue(ownersFilter.has("bool"));

    JsonNode boolQuery = ownersFilter.get("bool");
    JsonNode shouldClauses = boolQuery.get("should");
    assertNotNull(shouldClauses);
    assertEquals(1, shouldClauses.size());

    // Should have a nested query with exists inside
    JsonNode ownerClause = shouldClauses.get(0);
    assertTrue(ownerClause.has("nested"));
    JsonNode nested = ownerClause.get("nested");
    assertEquals("owners", nested.get("path").asText());

    JsonNode existsQuery = nested.get("query").get("exists");
    assertNotNull(existsQuery);
    assertEquals("owners.name", existsQuery.get("field").asText());
  }

  @Test
  void testBuildsQueryWithSpecialOwnerValue__NONE__() throws Exception {
    float[] vector = {0.1f};
    int size = 10;
    int k = 100;
    Map<String, List<String>> filters = Map.of("owners", List.of("__NONE__"));

    String query = VectorSearchQueryBuilder.build(vector, size, k, filters);

    JsonNode root = MAPPER.readTree(query);
    JsonNode mustFilters =
        root.get("query").get("knn").get("embedding").get("filter").get("bool").get("must");

    // Should have 2 filters: deleted=false + must_not owners
    assertEquals(2, mustFilters.size());

    // Second filter should be bool with must_not
    JsonNode noOwnersFilter = mustFilters.get(1);
    assertTrue(noOwnersFilter.has("bool"));

    JsonNode mustNot = noOwnersFilter.get("bool").get("must_not");
    assertNotNull(mustNot);

    JsonNode nested = mustNot.get("nested");
    assertEquals("owners", nested.get("path").asText());
  }

  @Test
  void testBuildsQueryWithTagsFilter() throws Exception {
    float[] vector = {0.1f, 0.2f};
    int size = 10;
    int k = 100;
    Map<String, List<String>> filters =
        Map.of("tags", List.of("PII.Sensitive", "Classification.Public"));

    String query = VectorSearchQueryBuilder.build(vector, size, k, filters);

    JsonNode root = MAPPER.readTree(query);
    JsonNode mustFilters =
        root.get("query").get("knn").get("embedding").get("filter").get("bool").get("must");

    // Should have 2 filters: deleted=false + tags
    assertEquals(2, mustFilters.size());

    // Second filter should be nested tags query
    JsonNode tagsFilter = mustFilters.get(1);
    assertTrue(tagsFilter.has("nested"));

    JsonNode nested = tagsFilter.get("nested");
    assertEquals("tags", nested.get("path").asText());

    // Multiple tags use bool.should with term queries
    JsonNode boolQuery = nested.get("query").get("bool");
    assertNotNull(boolQuery);

    JsonNode shouldClauses = boolQuery.get("should");
    assertNotNull(shouldClauses);
    assertEquals(2, shouldClauses.size());

    // Verify both tag values are present
    String tagsJson = shouldClauses.toString();
    assertTrue(tagsJson.contains("PII.Sensitive"));
    assertTrue(tagsJson.contains("Classification.Public"));
  }

  @Test
  void testBuildsQueryWithTierFilter() throws Exception {
    float[] vector = {0.1f, 0.2f};
    int size = 10;
    int k = 100;
    Map<String, List<String>> filters = Map.of("tier", List.of("Tier.Tier1", "Tier.Tier2"));

    String query = VectorSearchQueryBuilder.build(vector, size, k, filters);

    JsonNode root = MAPPER.readTree(query);
    JsonNode mustFilters =
        root.get("query").get("knn").get("embedding").get("filter").get("bool").get("must");

    // Should have 2 filters: deleted=false + tier
    assertEquals(2, mustFilters.size());

    // Second filter should be terms query on tier
    JsonNode tierFilter = mustFilters.get(1);
    assertTrue(tierFilter.has("terms"));

    JsonNode termsQuery = tierFilter.get("terms");
    assertTrue(termsQuery.has("tier.tagFQN"));

    JsonNode tiers = termsQuery.get("tier.tagFQN");
    assertEquals(2, tiers.size());
    assertEquals("Tier.Tier1", tiers.get(0).asText());
    assertEquals("Tier.Tier2", tiers.get(1).asText());
  }

  @Test
  void testBuildsQueryWithMultipleFilters() throws Exception {
    float[] vector = {0.1f, 0.2f, 0.3f, 0.4f};
    int size = 20;
    int k = 200;
    Map<String, List<String>> filters =
        Map.of(
            "entityType", List.of("table"),
            "tier", List.of("Tier.Tier1"),
            "owners", List.of("DataTeam"),
            "serviceType", List.of("BigQuery"));

    String query = VectorSearchQueryBuilder.build(vector, size, k, filters);

    JsonNode root = MAPPER.readTree(query);
    JsonNode mustFilters =
        root.get("query").get("knn").get("embedding").get("filter").get("bool").get("must");

    // Should have 5 filters: deleted=false + 4 user filters
    assertEquals(5, mustFilters.size());

    // First should always be deleted=false
    assertEquals(false, mustFilters.get(0).get("term").get("deleted").asBoolean());

    // Verify all filters are present (order may vary)
    String filtersJson = mustFilters.toString();
    assertTrue(filtersJson.contains("entityType"));
    assertTrue(filtersJson.contains("tier"));
    assertTrue(filtersJson.contains("owners"));
    assertTrue(filtersJson.contains("serviceType"));
  }

  @Test
  void testIgnoresEmptyFilterValues() throws Exception {
    float[] vector = {0.1f};
    int size = 10;
    int k = 100;
    Map<String, List<String>> filters =
        Map.of(
            "entityType", List.of("table"),
            "tags", List.of() // Empty list should be ignored
            );

    String query = VectorSearchQueryBuilder.build(vector, size, k, filters);

    JsonNode root = MAPPER.readTree(query);
    JsonNode mustFilters =
        root.get("query").get("knn").get("embedding").get("filter").get("bool").get("must");

    // Should have 2 filters: deleted=false + entityType (tags ignored)
    assertEquals(2, mustFilters.size());
  }

  @Test
  void testEfficientKnnFilteringStructure() throws Exception {
    // This test verifies the efficient pre-filtering structure where filters
    // are inside the knn clause, not outside in a separate bool query
    float[] vector = {0.1f, 0.2f};
    int size = 10;
    int k = 100;
    Map<String, List<String>> filters = Map.of("entityType", List.of("table"));

    String query = VectorSearchQueryBuilder.build(vector, size, k, filters);

    JsonNode root = MAPPER.readTree(query);

    // Verify structure: query.knn.embedding.filter (not query.bool.must)
    assertTrue(root.has("query"));
    JsonNode queryNode = root.get("query");

    // Should have knn at top level of query, not bool
    assertTrue(queryNode.has("knn"));
    assertNotNull(queryNode.get("knn").get("embedding").get("filter"));

    // Filter should be inside knn.embedding, enabling efficient pre-filtering
    JsonNode filter = queryNode.get("knn").get("embedding").get("filter");
    assertTrue(filter.has("bool"));
    assertTrue(filter.get("bool").has("must"));
  }

  @Test
  void testBuildsQueryWithCustomPropertiesFilter() throws Exception {
    float[] vector = {0.1f, 0.2f};
    int size = 10;
    int k = 100;
    Map<String, List<String>> filters =
        Map.of("customProperties.department", List.of("engineering"));

    String query = VectorSearchQueryBuilder.build(vector, size, k, filters);

    JsonNode root = MAPPER.readTree(query);
    JsonNode mustFilters =
        root.get("query").get("knn").get("embedding").get("filter").get("bool").get("must");

    // Should have 2 filters: deleted=false + customProperties
    assertEquals(2, mustFilters.size());

    // Second filter should be match query with fuzziness
    JsonNode customPropsFilter = mustFilters.get(1);
    assertTrue(customPropsFilter.has("match"));

    JsonNode matchQuery = customPropsFilter.get("match");
    assertTrue(matchQuery.has("customProperties.department"));

    JsonNode departmentQuery = matchQuery.get("customProperties.department");
    assertEquals("engineering", departmentQuery.get("query").asText());
    assertEquals("AUTO", departmentQuery.get("fuzziness").asText());
  }

  @Test
  void testBuildsQueryWithMultipleCustomPropertiesFilters() throws Exception {
    float[] vector = {0.1f, 0.2f};
    int size = 10;
    int k = 100;
    Map<String, List<String>> filters =
        Map.of(
            "customProperties.department", List.of("engineering"),
            "customProperties.location", List.of("remote"));

    String query = VectorSearchQueryBuilder.build(vector, size, k, filters);

    JsonNode root = MAPPER.readTree(query);
    JsonNode mustFilters =
        root.get("query").get("knn").get("embedding").get("filter").get("bool").get("must");

    // Should have 3 filters: deleted=false + 2 customProperties
    assertEquals(3, mustFilters.size());

    // Verify all custom properties filters are present
    String filtersJson = mustFilters.toString();
    assertTrue(filtersJson.contains("customProperties.department"));
    assertTrue(filtersJson.contains("customProperties.location"));
    assertTrue(filtersJson.contains("engineering"));
    assertTrue(filtersJson.contains("remote"));
    assertTrue(filtersJson.contains("fuzziness"));
    assertTrue(filtersJson.contains("AUTO"));
  }

  @Test
  void testBuildsQueryWithCustomPropertiesNameFilter() throws Exception {
    float[] vector = {0.1f, 0.2f};
    int size = 10;
    int k = 100;
    Map<String, List<String>> filters =
        Map.of("customProperties.steward.name", List.of("John Doe"));

    String query = VectorSearchQueryBuilder.build(vector, size, k, filters);

    JsonNode root = MAPPER.readTree(query);
    JsonNode mustFilters =
        root.get("query").get("knn").get("embedding").get("filter").get("bool").get("must");

    // Should have 2 filters: deleted=false + customProperties
    assertEquals(2, mustFilters.size());

    // Second filter should be exact term query for .name fields
    JsonNode customPropsFilter = mustFilters.get(1);
    assertTrue(customPropsFilter.has("term"));

    JsonNode termQuery = customPropsFilter.get("term");
    assertTrue(termQuery.has("customProperties.steward.name"));

    // For .name fields, should use exact term matching, not fuzzy search
    String nameValue = termQuery.get("customProperties.steward.name").asText();
    assertEquals("John Doe", nameValue);
  }

  @Test
  void testBuildsQueryWithCustomPropertiesNameFilterSpecialCharacters() throws Exception {
    float[] vector = {0.1f, 0.2f};
    int size = 10;
    int k = 100;
    Map<String, List<String>> filters =
        Map.of("customProperties.owner.name", List.of("O'Brien, \"Data\" Smith"));

    String query = VectorSearchQueryBuilder.build(vector, size, k, filters);

    JsonNode root = MAPPER.readTree(query);
    JsonNode mustFilters =
        root.get("query").get("knn").get("embedding").get("filter").get("bool").get("must");

    // Should have 2 filters: deleted=false + customProperties
    assertEquals(2, mustFilters.size());

    // Second filter should be exact term query for .name fields
    JsonNode customPropsFilter = mustFilters.get(1);
    assertTrue(customPropsFilter.has("term"));

    JsonNode termQuery = customPropsFilter.get("term");
    assertTrue(termQuery.has("customProperties.owner.name"));

    // For .name fields with special characters, should still use exact term matching
    String nameValue = termQuery.get("customProperties.owner.name").asText();
    assertEquals("O'Brien, \"Data\" Smith", nameValue);
  }

  @Test
  void testCustomPropertiesNameVsFuzzySearch() throws Exception {
    float[] vector = {0.1f, 0.2f};
    int size = 10;
    int k = 100;
    Map<String, List<String>> filters =
        Map.of(
            "customProperties.steward.name", List.of("John Doe"), // Should use term query
            "customProperties.description", List.of("data warehouse") // Should use match query
            );

    String query = VectorSearchQueryBuilder.build(vector, size, k, filters);

    JsonNode root = MAPPER.readTree(query);
    JsonNode mustFilters =
        root.get("query").get("knn").get("embedding").get("filter").get("bool").get("must");

    // Should have 3 filters: deleted=false + 2 customProperties
    assertEquals(3, mustFilters.size());

    // Find the term query filter for .name field
    JsonNode termFilter = null;
    JsonNode matchFilter = null;

    for (int i = 0; i < mustFilters.size(); i++) {
      JsonNode filter = mustFilters.get(i);
      if (filter.has("term") && filter.get("term").has("customProperties.steward.name")) {
        termFilter = filter;
      }
      if (filter.has("match") && filter.get("match").has("customProperties.description")) {
        matchFilter = filter;
      }
    }

    // Verify .name field uses term query (exact match)
    assertNotNull(termFilter, "Should have a term filter for .name field");
    assertEquals("John Doe", termFilter.get("term").get("customProperties.steward.name").asText());

    // Verify non-name field uses match query (fuzzy search)
    assertNotNull(matchFilter, "Should have a match filter for non-name field");
    JsonNode matchQuery = matchFilter.get("match").get("customProperties.description");
    assertEquals("data warehouse", matchQuery.get("query").asText());
    assertEquals("AUTO", matchQuery.get("fuzziness").asText());
  }

  @Test
  void testIgnoresEmptyCustomPropertiesFilter() throws Exception {
    float[] vector = {0.1f, 0.2f};
    int size = 10;
    int k = 100;
    Map<String, List<String>> filters =
        Map.of(
            "customProperties.department", List.of(), // Empty list should be ignored
            "entityType", List.of("table"));

    String query = VectorSearchQueryBuilder.build(vector, size, k, filters);

    JsonNode root = MAPPER.readTree(query);
    JsonNode mustFilters =
        root.get("query").get("knn").get("embedding").get("filter").get("bool").get("must");

    // Should have 2 filters: deleted=false + entityType (customProperties ignored)
    assertEquals(2, mustFilters.size());

    String filtersJson = mustFilters.toString();
    assertTrue(filtersJson.contains("entityType"));
    assertTrue(filtersJson.contains("table"));
    // Should not contain any customProperties references
    assertNotNull(filtersJson);
  }

  @Test
  void testCustomPropertiesFilterWithSpecialCharacters() throws Exception {
    float[] vector = {0.1f, 0.2f};
    int size = 10;
    int k = 100;
    Map<String, List<String>> filters =
        Map.of("customProperties.notes", List.of("test \"quoted\" value"));

    String query = VectorSearchQueryBuilder.build(vector, size, k, filters);

    JsonNode root = MAPPER.readTree(query);
    JsonNode mustFilters =
        root.get("query").get("knn").get("embedding").get("filter").get("bool").get("must");

    // Should have 2 filters: deleted=false + customProperties
    assertEquals(2, mustFilters.size());

    JsonNode customPropsFilter = mustFilters.get(1);
    assertTrue(customPropsFilter.has("match"));

    JsonNode matchQuery = customPropsFilter.get("match");
    assertTrue(matchQuery.has("customProperties.notes"));

    JsonNode notesQuery = matchQuery.get("customProperties.notes");
    assertEquals("test \"quoted\" value", notesQuery.get("query").asText());
  }

  @Test
  void testMixedCustomPropertiesAndRegularFilters() throws Exception {
    float[] vector = {0.1f, 0.2f, 0.3f};
    int size = 15;
    int k = 150;
    Map<String, List<String>> filters =
        Map.of(
            "entityType", List.of("table"),
            "customProperties.department", List.of("engineering"),
            "tier", List.of("Tier.Tier1"),
            "customProperties.cost_center", List.of("12345"));

    String query = VectorSearchQueryBuilder.build(vector, size, k, filters);

    JsonNode root = MAPPER.readTree(query);
    JsonNode mustFilters =
        root.get("query").get("knn").get("embedding").get("filter").get("bool").get("must");

    // Should have 5 filters: deleted=false + 4 user filters
    assertEquals(5, mustFilters.size());

    String filtersJson = mustFilters.toString();

    // Verify regular filters
    assertTrue(filtersJson.contains("entityType"));
    assertTrue(filtersJson.contains("table"));
    assertTrue(filtersJson.contains("tier"));
    assertTrue(filtersJson.contains("Tier.Tier1"));

    // Verify custom properties filters with fuzzy matching
    assertTrue(filtersJson.contains("customProperties.department"));
    assertTrue(filtersJson.contains("engineering"));
    assertTrue(filtersJson.contains("customProperties.cost_center"));
    assertTrue(filtersJson.contains("12345"));
    assertTrue(filtersJson.contains("fuzziness"));
    assertTrue(filtersJson.contains("AUTO"));
  }

  @Test
  void testIgnoresUnrecognizedFilterKeys() throws Exception {
    float[] vector = {0.1f, 0.2f};
    int size = 10;
    int k = 100;
    Map<String, List<String>> filters =
        Map.of(
            "unknownKey", List.of("value"),
            "entityType", List.of("table"));

    String query = VectorSearchQueryBuilder.build(vector, size, k, filters);

    JsonNode root = MAPPER.readTree(query);
    JsonNode mustFilters =
        root.get("query").get("knn").get("embedding").get("filter").get("bool").get("must");

    // Should have 2 filters: deleted=false + entityType (unknownKey ignored)
    assertEquals(2, mustFilters.size());

    String filtersJson = mustFilters.toString();
    assertTrue(filtersJson.contains("entityType"));
    assertTrue(filtersJson.contains("table"));
  }

  @Test
  void testIgnoresOnlyUnrecognizedFilterKeys() throws Exception {
    float[] vector = {0.1f, 0.2f};
    int size = 10;
    int k = 100;
    Map<String, List<String>> filters = Map.of("unknownKey", List.of("value"));

    String query = VectorSearchQueryBuilder.build(vector, size, k, filters);

    JsonNode root = MAPPER.readTree(query);
    JsonNode mustFilters =
        root.get("query").get("knn").get("embedding").get("filter").get("bool").get("must");

    // Should have only 1 filter: deleted=false
    assertEquals(1, mustFilters.size());
    assertEquals(false, mustFilters.get(0).get("term").get("deleted").asBoolean());
  }
}
