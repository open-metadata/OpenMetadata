package org.openmetadata.service.migration.utils.v202;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.search.AllowedSearchFields;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.utils.JsonUtils;

class SearchAllowedFieldsRepairTest {

  private static final String SEED =
      """
      {
        "allowedFields": [
          {"entityType": "database", "fields": [
            {"name": "name", "description": "d"},
            {"name": "name.keyword", "description": "d"},
            {"name": "name.compound", "description": "d"}
          ]},
          {"entityType": "table", "fields": [
            {"name": "name", "description": "d"},
            {"name": "columnNamesFuzzy", "description": "d"}
          ]}
        ]
      }
      """;

  private SearchSettings seed() {
    return JsonUtils.readValue(SEED, SearchSettings.class);
  }

  private SearchSettings storedWithDatabaseAllowed(List<String> names) {
    AllowedSearchFields database =
        new AllowedSearchFields()
            .withEntityType("database")
            .withFields(
                new java.util.ArrayList<>(
                    names.stream()
                        .map(n -> new org.openmetadata.schema.api.search.Field().withName(n))
                        .toList()));
    return new SearchSettings().withAllowedFields(new java.util.ArrayList<>(List.of(database)));
  }

  private Set<String> allowedNames(SearchSettings settings, String entityType) {
    return settings.getAllowedFields().stream()
        .filter(a -> entityType.equals(a.getEntityType()))
        .findFirst()
        .orElseThrow()
        .getFields()
        .stream()
        .map(org.openmetadata.schema.api.search.Field::getName)
        .collect(Collectors.toSet());
  }

  @Test
  void repairCompletesAllowedFieldsFromSeed() {
    // Upgraded cluster kept the sparse catalog (only "name" for database, no table entry).
    SearchSettings stored = storedWithDatabaseAllowed(List.of("name"));

    assertTrue(SearchAllowedFieldsRepair.repairAllowedFields(stored, seed()));

    assertEquals(Set.of("name", "name.keyword", "name.compound"), allowedNames(stored, "database"));
    assertEquals(Set.of("name", "columnNamesFuzzy"), allowedNames(stored, "table"));
  }

  @Test
  void repairIsIdempotentWhenAllowedFieldsAlreadyMatchSeed() {
    SearchSettings stored = seed();

    assertFalse(SearchAllowedFieldsRepair.repairAllowedFields(stored, seed()));
  }

  @Test
  void repairSkipsWhenSeedHasNoAllowedFields() {
    SearchSettings stored = storedWithDatabaseAllowed(List.of("name"));

    assertFalse(SearchAllowedFieldsRepair.repairAllowedFields(stored, new SearchSettings()));
  }
}
