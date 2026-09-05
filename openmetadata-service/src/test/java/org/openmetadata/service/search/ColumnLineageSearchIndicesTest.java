package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.search.IndexMappingLoader;
import org.openmetadata.service.Entity;
import org.openmetadata.service.lineage.ColumnLineageChildren;

/**
 * The column-lineage reconciliation on column rename/delete targets a narrowed set of indices
 * instead of the global alias. Nothing at runtime fails when that selector names an index that does
 * not exist — {@code ignoreUnavailable} is set so one missing index cannot abort cleanup of the
 * rest — so a stale selector silently skips cleanup instead of erroring. These tests pin the
 * selector to the resolver registry it is derived from.
 */
class ColumnLineageSearchIndicesTest {

  private static IndexMappingLoader mappingLoader;

  @BeforeAll
  static void loadMappings() throws IOException {
    IndexMappingLoader.init();
    mappingLoader = IndexMappingLoader.getInstance();
  }

  @Test
  void columnLineageEntityTypesCoverTheDocumentedTypes() {
    assertTrue(
        ColumnLineageChildren.COLUMN_LINEAGE_ENTITY_TYPES.contains(Entity.TABLE),
        "table must be able to carry column lineage");
    assertEquals(
        Set.of(
            Entity.TABLE,
            Entity.TOPIC,
            Entity.CONTAINER,
            Entity.DASHBOARD_DATA_MODEL,
            Entity.SEARCH_INDEX,
            Entity.API_ENDPOINT,
            Entity.MLMODEL,
            Entity.DASHBOARD),
        Set.copyOf(ColumnLineageChildren.COLUMN_LINEAGE_ENTITY_TYPES),
        "the column-lineage resolver registry changed; the search selector follows it "
            + "automatically, but confirm the new type's index mapping exists and update this list");
  }

  @Test
  void everyColumnLineageTypeResolvesToAnIndex() {
    for (String entityType : ColumnLineageChildren.COLUMN_LINEAGE_ENTITY_TYPES) {
      IndexMapping mapping = mappingLoader.getIndexMapping().get(entityType);
      assertNotNull(mapping, "no index mapping for column-lineage entity type " + entityType);
      assertNotNull(
          mapping.getIndexName(null), "no index name for column-lineage entity type " + entityType);
      // Index names are resolved through SearchRepository.getIndexOrAliasName, which prefixes each
      // token with the cluster alias. Passing entity types rather than raw index names is what
      // keeps the selector correct on a prefixed cluster.
      assertEquals(
          "clusterx_" + mapping.getIndexName(null),
          mapping.getIndexName("clusterx"),
          "cluster alias is not applied to " + entityType);
    }
  }

  @Test
  void searchSelectorListsEveryColumnLineageTypeExactlyOnce() {
    List<String> tokens =
        Arrays.asList(ColumnLineageChildren.COLUMN_LINEAGE_SEARCH_INDICES.split(","));
    assertEquals(
        ColumnLineageChildren.COLUMN_LINEAGE_ENTITY_TYPES.size(),
        tokens.size(),
        "selector token count drifted from the resolver registry");
    assertEquals(
        tokens.size(),
        new LinkedHashSet<>(tokens).size(),
        "selector repeats a token: " + ColumnLineageChildren.COLUMN_LINEAGE_SEARCH_INDICES);
    for (String token : tokens) {
      assertFalse(token.isBlank(), "selector has a blank token");
      assertTrue(
          ColumnLineageChildren.COLUMN_LINEAGE_ENTITY_TYPES.contains(token),
          "selector token is not a column-lineage entity type: " + token);
    }
  }

  @Test
  void searchSelectorStaysNarrowerThanTheGlobalAlias() {
    assertTrue(
        ColumnLineageChildren.COLUMN_LINEAGE_ENTITY_TYPES.size()
            < mappingLoader.getIndexMapping().size(),
        "the selector no longer narrows anything; it may as well use the global alias");
    assertFalse(
        SearchClient.GLOBAL_SEARCH_ALIAS.equals(
            ColumnLineageChildren.COLUMN_LINEAGE_SEARCH_INDICES),
        "the selector fell back to the global alias");
  }
}
