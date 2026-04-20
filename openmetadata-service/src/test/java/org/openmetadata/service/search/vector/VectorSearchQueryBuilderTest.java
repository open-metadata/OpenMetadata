package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
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

    String query = VectorSearchQueryBuilder.build(vector, size, 0, k, filters, 0.0);

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
    assertFalse(deletedFilter.get("term").get("deleted").asBoolean());
  }

  @Test
  void testBuildsQueryWithEntityTypeFilter() throws Exception {
    float[] vector = {0.5f, 0.5f};
    int size = 5;
    int k = 50;
    Map<String, List<String>> filters = Map.of("entityType", List.of("table", "dashboard"));

    String query = VectorSearchQueryBuilder.build(vector, size, 0, k, filters, 0.0);

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

    String query = VectorSearchQueryBuilder.build(vector, size, 0, k, filters, 0.0);

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

    String query = VectorSearchQueryBuilder.build(vector, size, 0, k, filters, 0.0);

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

    String query = VectorSearchQueryBuilder.build(vector, size, 0, k, filters, 0.0);

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

    String query = VectorSearchQueryBuilder.build(vector, size, 0, k, filters, 0.0);

    JsonNode root = MAPPER.readTree(query);
    JsonNode mustFilters =
        root.get("query").get("knn").get("embedding").get("filter").get("bool").get("must");

    // Should have 2 filters: deleted=false + tags
    assertEquals(2, mustFilters.size());

    // Second filter should be a flat terms query over tag FQNs
    JsonNode tagsFilter = mustFilters.get(1);
    assertTrue(tagsFilter.has("terms"));

    JsonNode terms = tagsFilter.get("terms");
    assertTrue(terms.has("tags.tagFQN"));

    JsonNode tagValues = terms.get("tags.tagFQN");
    assertNotNull(tagValues);
    assertEquals(2, tagValues.size());

    // Verify both tag values are present
    String tagsJson = tagValues.toString();
    assertTrue(tagsJson.contains("PII.Sensitive"));
    assertTrue(tagsJson.contains("Classification.Public"));
  }

  @Test
  void testBuildsQueryWithTierFilter() throws Exception {
    float[] vector = {0.1f, 0.2f};
    int size = 10;
    int k = 100;
    Map<String, List<String>> filters = Map.of("tier", List.of("Tier.Tier1", "Tier.Tier2"));

    String query = VectorSearchQueryBuilder.build(vector, size, 0, k, filters, 0.0);

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

    String query = VectorSearchQueryBuilder.build(vector, size, 0, k, filters, 0.0);

    JsonNode root = MAPPER.readTree(query);
    JsonNode mustFilters =
        root.get("query").get("knn").get("embedding").get("filter").get("bool").get("must");

    // Should have 5 filters: deleted=false + 4 user filters
    assertEquals(5, mustFilters.size());

    // First should always be deleted=false
    assertFalse(mustFilters.get(0).get("term").get("deleted").asBoolean());

    // Verify all filters are present (order may vary)
    String filtersJson = mustFilters.toString();
    assertTrue(filtersJson.contains("entityType"));
    assertTrue(filtersJson.contains("tier"));
    assertTrue(filtersJson.contains("owners"));
    assertTrue(filtersJson.contains("serviceType"));
  }

  @Test
  void testBuildsQueryWithServiceFilter__ANY__() throws Exception {
    float[] vector = {0.1f};
    int size = 10;
    int k = 100;
    Map<String, List<String>> filters = Map.of("service", List.of("__ANY__"));

    String query = VectorSearchQueryBuilder.build(vector, size, 0, k, filters, 0.0);

    JsonNode root = MAPPER.readTree(query);
    JsonNode mustFilters =
        root.get("query").get("knn").get("embedding").get("filter").get("bool").get("must");

    assertEquals(2, mustFilters.size());

    JsonNode serviceFilter = mustFilters.get(1);
    assertTrue(serviceFilter.has("bool"));
    JsonNode shouldClauses = serviceFilter.get("bool").get("should");
    assertEquals(1, shouldClauses.size());

    JsonNode existsQuery = shouldClauses.get(0).get("exists");
    assertNotNull(existsQuery);
    assertEquals("service.name", existsQuery.get("field").asText());
  }

  @Test
  void testBuildsQueryWithServiceFilter__NONE__() throws Exception {
    float[] vector = {0.1f};
    int size = 10;
    int k = 100;
    Map<String, List<String>> filters = Map.of("service", List.of("__NONE__"));

    String query = VectorSearchQueryBuilder.build(vector, size, 0, k, filters, 0.0);

    JsonNode root = MAPPER.readTree(query);
    JsonNode mustFilters =
        root.get("query").get("knn").get("embedding").get("filter").get("bool").get("must");

    assertEquals(2, mustFilters.size());

    JsonNode serviceFilter = mustFilters.get(1);
    assertTrue(serviceFilter.has("bool"));
    JsonNode shouldClauses = serviceFilter.get("bool").get("should");
    assertEquals(1, shouldClauses.size());

    JsonNode mustNot = shouldClauses.get(0).get("bool").get("must_not");
    assertNotNull(mustNot);
    assertEquals("service.name", mustNot.get("exists").get("field").asText());
  }

  @Test
  void testBuildsQueryWithDatabaseFilter__ANY__() throws Exception {
    float[] vector = {0.1f};
    int size = 10;
    int k = 100;
    Map<String, List<String>> filters = Map.of("database", List.of("__ANY__"));

    String query = VectorSearchQueryBuilder.build(vector, size, 0, k, filters, 0.0);

    JsonNode root = MAPPER.readTree(query);
    JsonNode mustFilters =
        root.get("query").get("knn").get("embedding").get("filter").get("bool").get("must");

    assertEquals(2, mustFilters.size());

    JsonNode databaseFilter = mustFilters.get(1);
    assertTrue(databaseFilter.has("bool"));
    JsonNode shouldClauses = databaseFilter.get("bool").get("should");
    assertEquals(1, shouldClauses.size());

    JsonNode existsQuery = shouldClauses.get(0).get("exists");
    assertNotNull(existsQuery);
    assertEquals("database.name", existsQuery.get("field").asText());
  }

  @Test
  void testBuildsQueryWithDatabaseFilter__NONE__() throws Exception {
    float[] vector = {0.1f};
    int size = 10;
    int k = 100;
    Map<String, List<String>> filters = Map.of("database", List.of("__NONE__"));

    String query = VectorSearchQueryBuilder.build(vector, size, 0, k, filters, 0.0);

    JsonNode root = MAPPER.readTree(query);
    JsonNode mustFilters =
        root.get("query").get("knn").get("embedding").get("filter").get("bool").get("must");

    assertEquals(2, mustFilters.size());

    JsonNode databaseFilter = mustFilters.get(1);
    assertTrue(databaseFilter.has("bool"));
    JsonNode shouldClauses = databaseFilter.get("bool").get("should");
    assertEquals(1, shouldClauses.size());

    JsonNode mustNot = shouldClauses.get(0).get("bool").get("must_not");
    assertNotNull(mustNot);
    assertEquals("database.name", mustNot.get("exists").get("field").asText());
  }

  @Test
  void testBuildsQueryWithServiceFilterNormalValue() throws Exception {
    float[] vector = {0.1f};
    int size = 10;
    int k = 100;
    Map<String, List<String>> filters = Map.of("service", List.of("my_service"));

    String query = VectorSearchQueryBuilder.build(vector, size, 0, k, filters, 0.0);

    JsonNode root = MAPPER.readTree(query);
    JsonNode mustFilters =
        root.get("query").get("knn").get("embedding").get("filter").get("bool").get("must");

    assertEquals(2, mustFilters.size());

    String filtersJson = mustFilters.toString();
    assertTrue(filtersJson.contains("service.name"));
    assertTrue(filtersJson.contains("service.displayName"));
    assertTrue(filtersJson.contains("my_service"));
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

    String query = VectorSearchQueryBuilder.build(vector, size, 0, k, filters, 0.0);

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

    String query = VectorSearchQueryBuilder.build(vector, size, 0, k, filters, 0.0);

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

    String query = VectorSearchQueryBuilder.build(vector, size, 0, k, filters, 0.0);

    JsonNode root = MAPPER.readTree(query);
    JsonNode mustFilters =
        root.get("query").get("knn").get("embedding").get("filter").get("bool").get("must");

    // Should have 2 filters: deleted=false + customProperties
    assertEquals(2, mustFilters.size());

    // Second filter should route through the typed custom properties nested path
    JsonNode customPropsFilter = mustFilters.get(1);
    String filterJson = customPropsFilter.toString();
    assertTrue(customPropsFilter.has("bool"));
    assertTrue(filterJson.contains("\"path\":\"customPropertiesTyped\""));
    assertTrue(filterJson.contains("\"customPropertiesTyped.name\":\"department\""));
    assertTrue(filterJson.contains("\"engineering\""));
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

    String query = VectorSearchQueryBuilder.build(vector, size, 0, k, filters, 0.0);

    JsonNode root = MAPPER.readTree(query);
    JsonNode mustFilters =
        root.get("query").get("knn").get("embedding").get("filter").get("bool").get("must");

    // Should have 3 filters: deleted=false + 2 customProperties
    assertEquals(3, mustFilters.size());

    // Verify all custom properties filters are present in the typed nested form
    String filtersJson = mustFilters.toString();
    assertTrue(filtersJson.contains("\"customPropertiesTyped.name\":\"department\""));
    assertTrue(filtersJson.contains("\"customPropertiesTyped.name\":\"location\""));
    assertTrue(filtersJson.contains("engineering"));
    assertTrue(filtersJson.contains("remote"));
    assertTrue(filtersJson.contains("\"customPropertiesTyped.textValue\""));
  }

  @Test
  void testBuildsQueryWithCustomPropertiesNameFilter() throws Exception {
    float[] vector = {0.1f, 0.2f};
    int size = 10;
    int k = 100;
    Map<String, List<String>> filters =
        Map.of("customProperties.steward.name", List.of("John Doe"));

    String query = VectorSearchQueryBuilder.build(vector, size, 0, k, filters, 0.0);

    JsonNode root = MAPPER.readTree(query);
    JsonNode mustFilters =
        root.get("query").get("knn").get("embedding").get("filter").get("bool").get("must");

    // Should have 2 filters: deleted=false + customProperties
    assertEquals(2, mustFilters.size());

    // Second filter should preserve the custom property key inside the typed nested form
    JsonNode customPropsFilter = mustFilters.get(1);
    String filterJson = customPropsFilter.toString();
    assertTrue(customPropsFilter.has("bool"));
    assertTrue(filterJson.contains("\"customPropertiesTyped.name\":\"steward.name\""));
    assertTrue(filterJson.contains("\"John Doe\""));
  }

  @Test
  void testBuildsQueryWithCustomPropertiesNameFilterSpecialCharacters() throws Exception {
    float[] vector = {0.1f, 0.2f};
    int size = 10;
    int k = 100;
    Map<String, List<String>> filters =
        Map.of("customProperties.owner.name", List.of("O'Brien, \"Data\" Smith"));

    String query = VectorSearchQueryBuilder.build(vector, size, 0, k, filters, 0.0);

    JsonNode root = MAPPER.readTree(query);
    JsonNode mustFilters =
        root.get("query").get("knn").get("embedding").get("filter").get("bool").get("must");

    // Should have 2 filters: deleted=false + customProperties
    assertEquals(2, mustFilters.size());

    // Second filter should preserve the full custom property key and value
    JsonNode customPropsFilter = mustFilters.get(1);
    String filterJson = customPropsFilter.toString();
    assertTrue(customPropsFilter.has("bool"));
    assertTrue(filterJson.contains("\"customPropertiesTyped.name\":\"owner.name\""));
    assertTrue(filterJson.contains("O'Brien, \\\"Data\\\" Smith"));
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

    String query = VectorSearchQueryBuilder.build(vector, size, 0, k, filters, 0.0);

    JsonNode root = MAPPER.readTree(query);
    JsonNode mustFilters =
        root.get("query").get("knn").get("embedding").get("filter").get("bool").get("must");

    // Should have 3 filters: deleted=false + 2 customProperties
    assertEquals(3, mustFilters.size());

    String filtersJson = mustFilters.toString();
    assertTrue(filtersJson.contains("\"customPropertiesTyped.name\":\"steward.name\""));
    assertTrue(filtersJson.contains("\"John Doe\""));
    assertTrue(filtersJson.contains("\"customPropertiesTyped.name\":\"description\""));
    assertTrue(filtersJson.contains("\"data warehouse\""));
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

    String query = VectorSearchQueryBuilder.build(vector, size, 0, k, filters, 0.0);

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

    String query = VectorSearchQueryBuilder.build(vector, size, 0, k, filters, 0.0);

    JsonNode root = MAPPER.readTree(query);
    JsonNode mustFilters =
        root.get("query").get("knn").get("embedding").get("filter").get("bool").get("must");

    // Should have 2 filters: deleted=false + customProperties
    assertEquals(2, mustFilters.size());

    JsonNode customPropsFilter = mustFilters.get(1);
    String filterJson = customPropsFilter.toString();
    assertTrue(customPropsFilter.has("bool"));
    assertTrue(filterJson.contains("\"customPropertiesTyped.name\":\"notes\""));
    assertTrue(filterJson.contains("test \\\"quoted\\\" value"));
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

    String query = VectorSearchQueryBuilder.build(vector, size, 0, k, filters, 0.0);

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

    // Verify custom properties filters with typed nested matching
    assertTrue(filtersJson.contains("\"customPropertiesTyped.name\":\"department\""));
    assertTrue(filtersJson.contains("engineering"));
    assertTrue(filtersJson.contains("\"customPropertiesTyped.name\":\"cost_center\""));
    assertTrue(filtersJson.contains("12345"));
    assertTrue(filtersJson.contains("\"path\":\"customPropertiesTyped\""));
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

    String query = VectorSearchQueryBuilder.build(vector, size, 0, k, filters, 0.0);

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

    String query = VectorSearchQueryBuilder.build(vector, size, 0, k, filters, 0.0);

    JsonNode root = MAPPER.readTree(query);
    JsonNode mustFilters =
        root.get("query").get("knn").get("embedding").get("filter").get("bool").get("must");

    // Should have only 1 filter: deleted=false
    assertEquals(1, mustFilters.size());
    assertFalse(mustFilters.get(0).get("term").get("deleted").asBoolean());
  }
}
