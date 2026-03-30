package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.InheritedFieldEntitySearch.InheritedFieldQuery;

class QueryFilterBuilderTest {

  @Test
  void buildDomainAssetsFilterAddsHierarchyCommonFiltersAndDataProductExclusion() {
    InheritedFieldQuery query =
        InheritedFieldQuery.builder()
            .fieldPath("domains.fullyQualifiedName")
            .fieldValue("Finance")
            .supportsHierarchy(true)
            .entityTypeFilter(Entity.TABLE)
            .build();

    JsonNode filter = parse(QueryFilterBuilder.buildDomainAssetsFilter(query));

    assertEquals(
        "Finance",
        filter.at("/query/bool/must/0/bool/should/0/term/domains.fullyQualifiedName").asText());
    assertEquals(
        "Finance.",
        filter.at("/query/bool/must/0/bool/should/1/prefix/domains.fullyQualifiedName").asText());
    assertFalse(filter.at("/query/bool/must/1/term/deleted").asBoolean());
    assertEquals(Entity.TABLE, filter.at("/query/bool/must/2/term/entityType").asText());
    assertEquals(Entity.DATA_PRODUCT, filter.at("/query/bool/must_not/0/term/entityType").asText());
  }

  @Test
  void buildDomainAssetsCountFilterRequiresFieldPresenceAndExcludesDataProducts() {
    JsonNode filter =
        parse(QueryFilterBuilder.buildDomainAssetsCountFilter("domains.fullyQualifiedName"));

    assertEquals(
        "domains.fullyQualifiedName", filter.at("/query/bool/must/0/exists/field").asText());
    assertEquals(Entity.DATA_PRODUCT, filter.at("/query/bool/must_not/0/term/entityType").asText());
  }

  @Test
  void buildTeamAssetsCountFilterTargetsTeamOwnersAndNonDeletedAssets() {
    JsonNode filter = parse(QueryFilterBuilder.buildTeamAssetsCountFilter());

    assertEquals("owners", filter.at("/query/bool/must/0/nested/path").asText());
    assertEquals("team", filter.at("/query/bool/must/0/nested/query/term/owners.type").asText());
    assertTrue(
        filter.at("/query/bool/must/0/nested/ignore_unmapped").asBoolean(),
        "Nested owners query must set ignore_unmapped to true");
    assertFalse(filter.at("/query/bool/must/1/term/deleted").asBoolean());
  }

  @Test
  void buildOwnerAssetsFilterUsesNestedMatchAndEntityTypeFilter() {
    InheritedFieldQuery query =
        InheritedFieldQuery.builder()
            .fieldPath("owners.id")
            .fieldValue("team-id")
            .entityTypeFilter(Entity.TABLE)
            .build();

    JsonNode filter = parse(QueryFilterBuilder.buildOwnerAssetsFilter(query));

    assertEquals("owners", filter.at("/query/bool/must/0/nested/path").asText());
    assertEquals("team-id", filter.at("/query/bool/must/0/nested/query/match/owners.id").asText());
    assertTrue(
        filter.at("/query/bool/must/0/nested/ignore_unmapped").asBoolean(),
        "Nested owners query must set ignore_unmapped to true");
    assertFalse(filter.at("/query/bool/must/1/term/deleted").asBoolean());
    assertEquals(Entity.TABLE, filter.at("/query/bool/must/2/term/entityType").asText());
  }

  @Test
  void buildTagAssetsFilterUsesExactMatchAndSkipsDeletedFilterWhenRequested() {
    InheritedFieldQuery query =
        InheritedFieldQuery.builder()
            .fieldPath("tags.tagFQN")
            .fieldValue("Tier.Tier1")
            .includeDeleted(true)
            .build();

    JsonNode filter = parse(QueryFilterBuilder.buildTagAssetsFilter(query));

    assertEquals("Tier.Tier1", filter.at("/query/bool/must/0/term/tags.tagFQN").asText());
    assertTrue(filter.at("/query/bool/must/1").isMissingNode());
  }

  @Test
  void buildGenericFilterUsesHierarchyWhenSupported() {
    InheritedFieldQuery query =
        InheritedFieldQuery.builder()
            .fieldPath("domains.fullyQualifiedName")
            .fieldValue("Finance")
            .supportsHierarchy(true)
            .build();

    JsonNode filter = parse(QueryFilterBuilder.buildGenericFilter(query));

    assertEquals(
        "Finance",
        filter.at("/query/bool/must/0/bool/should/0/term/domains.fullyQualifiedName").asText());
    assertFalse(filter.at("/query/bool/must/1/term/deleted").asBoolean());
  }

  @Test
  void buildGenericFilterUsesExactMatchWhenHierarchyIsDisabled() {
    InheritedFieldQuery query =
        InheritedFieldQuery.builder()
            .fieldPath("dataProducts.fullyQualifiedName")
            .fieldValue("finance.product")
            .includeDeleted(true)
            .build();

    JsonNode filter = parse(QueryFilterBuilder.buildGenericFilter(query));

    assertEquals(
        "finance.product",
        filter.at("/query/bool/must/0/term/dataProducts.fullyQualifiedName").asText());
    assertTrue(filter.at("/query/bool/must/1").isMissingNode());
  }

  @Test
  void buildUserAssetsFilterAddsNestedOrConditionsForAllOwners() {
    InheritedFieldQuery query =
        InheritedFieldQuery.builder()
            .fieldPath("owners.id")
            .fieldValues(List.of("user-id", "team-id"))
            .build();

    JsonNode filter = parse(QueryFilterBuilder.buildUserAssetsFilter(query));

    assertEquals("owners", filter.at("/query/bool/must/0/nested/path").asText());
    assertTrue(
        filter.at("/query/bool/must/0/nested/ignore_unmapped").asBoolean(),
        "Nested owners query must set ignore_unmapped to true");
    assertEquals(
        "user-id",
        filter.at("/query/bool/must/0/nested/query/bool/should/0/term/owners.id").asText());
    assertEquals(
        "team-id",
        filter.at("/query/bool/must/0/nested/query/bool/should/1/term/owners.id").asText());
    assertFalse(filter.at("/query/bool/must/1/term/deleted").asBoolean());
  }

  @Test
  void nestedTermConditionWorksForMappedFields() {
    // Verifies nested term query produces correct structure for indexes with the nested field
    JsonNode filter = parse(QueryFilterBuilder.buildTeamAssetsCountFilter());

    JsonNode nested = filter.at("/query/bool/must/0/nested");
    assertEquals("owners", nested.at("/path").asText(), "must target correct nested path");
    assertFalse(nested.at("/query").isMissingNode(), "must contain inner query");
    assertEquals(
        "team", nested.at("/query/term/owners.type").asText(), "must filter on term value");
  }

  @Test
  void nestedTermConditionDoesNotFailForUnmappedFields() {
    // Verifies ignore_unmapped is set so indexes without the nested field don't throw errors
    JsonNode filter = parse(QueryFilterBuilder.buildTeamAssetsCountFilter());

    JsonNode nested = filter.at("/query/bool/must/0/nested");
    assertTrue(
        nested.at("/ignore_unmapped").asBoolean(),
        "must set ignore_unmapped so query works on indexes without this nested field");
  }

  @Test
  void nestedMatchConditionWorksForMappedFields() {
    InheritedFieldQuery query =
        InheritedFieldQuery.builder().fieldPath("owners.id").fieldValue("owner-123").build();

    JsonNode filter = parse(QueryFilterBuilder.buildOwnerAssetsFilter(query));

    JsonNode nested = filter.at("/query/bool/must/0/nested");
    assertEquals("owners", nested.at("/path").asText(), "must target correct nested path");
    assertEquals(
        "owner-123",
        nested.at("/query/match/owners.id").asText(),
        "must match on the provided value");
  }

  @Test
  void nestedMatchConditionDoesNotFailForUnmappedFields() {
    InheritedFieldQuery query =
        InheritedFieldQuery.builder().fieldPath("owners.id").fieldValue("owner-123").build();

    JsonNode filter = parse(QueryFilterBuilder.buildOwnerAssetsFilter(query));

    JsonNode nested = filter.at("/query/bool/must/0/nested");
    assertTrue(
        nested.at("/ignore_unmapped").asBoolean(),
        "must set ignore_unmapped so query works on indexes without this nested field");
  }

  @Test
  void nestedOrConditionWorksForMappedFields() {
    InheritedFieldQuery query =
        InheritedFieldQuery.builder()
            .fieldPath("owners.id")
            .fieldValues(List.of("id-1", "id-2", "id-3"))
            .build();

    JsonNode filter = parse(QueryFilterBuilder.buildUserAssetsFilter(query));

    JsonNode nested = filter.at("/query/bool/must/0/nested");
    assertEquals("owners", nested.at("/path").asText(), "must target correct nested path");
    assertEquals(
        3, nested.at("/query/bool/should").size(), "must contain all values in should clause");
  }

  @Test
  void nestedOrConditionDoesNotFailForUnmappedFields() {
    InheritedFieldQuery query =
        InheritedFieldQuery.builder()
            .fieldPath("owners.id")
            .fieldValues(List.of("id-1", "id-2"))
            .build();

    JsonNode filter = parse(QueryFilterBuilder.buildUserAssetsFilter(query));

    JsonNode nested = filter.at("/query/bool/must/0/nested");
    assertTrue(
        nested.at("/ignore_unmapped").asBoolean(),
        "must set ignore_unmapped so query works on indexes without this nested field");
  }

  private JsonNode parse(String json) {
    return JsonUtils.readTree(json);
  }
}
