package org.openmetadata.service.search.lineage;

import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class LineageFilterClassifierTest {

  /**
   * Every field the lineage page's filter dropdown sends in {@code query_filter}: {@code
   * LINEAGE_DROPDOWN_ITEMS} plus the glossary-term item from {@code getLineageDropdownItems} in
   * openmetadata-ui {@code constants/AdvancedSearch.constants.ts}, with the values of {@code
   * EntityFields} in {@code enums/AdvancedSearch.enum.ts}. A field classed as structural is applied
   * inside the lineage walk, which stops at the first node that fails it, so a match behind a
   * non-matching node is lost (#38783). Add a field here when the dropdown gains one.
   */
  @ParameterizedTest
  @ValueSource(
      strings = {
        "domains.displayName.keyword",
        "dataProducts.displayName.keyword",
        "ownerDisplayName",
        "tags.tagFQN",
        "tier.tagFQN",
        "service.displayName.keyword",
        "serviceType",
        "database.displayName.keyword",
        "databaseSchema.displayName.keyword",
        "columns.name.keyword",
        "glossaryTags"
      })
  void everyLineageDropdownFieldIsNodeLevel(String field) {
    String queryFilter =
        String.format(
            "{\"query\":{\"bool\":{\"must\":[{\"bool\":{\"should\":[{\"term\":{\"%s\":\"x\"}}]}}]}}}",
            field);
    assertTrue(LineageFilterClassifier.classify(queryFilter).hasNodeLevelFilters(), field);
  }
}
