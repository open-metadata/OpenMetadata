package org.openmetadata.service.search.lineage;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.service.search.QueryFilterParser;

/**
 * Classifies lineage query filters into structural-only filters and node-level filters.
 * Structural filters can stay on the native ES/OS execution path; node-level filters require
 * unfiltered traversal plus post-filtering to preserve deeper matches behind non-matching nodes.
 */
public final class LineageFilterClassifier {

  private static final Set<String> NODE_LEVEL_FIELDS =
      Set.of(
          "owner",
          "ownerName",
          "owners",
          "owners.name",
          "tag",
          "tags",
          "domain",
          "domain.name",
          "service",
          "tier",
          "name",
          "displayName",
          "domains",
          "domains.name",
          "domains.displayName",
          "owners.displayName",
          "tags.tagFQN",
          "tier.tagFQN",
          "service.name",
          "domain.displayName",
          "serviceType",
          "serviceType.keyword");

  private LineageFilterClassifier() {}

  public static FilterClassification classify(String queryFilter) {
    if (nullOrEmpty(queryFilter)) {
      return new FilterClassification(false, null);
    }

    Map<String, List<String>> parsedFields = QueryFilterParser.parseFilter(queryFilter);
    if (parsedFields.isEmpty()) {
      // Be conservative when parsing fails: keep the safe post-filter path.
      return new FilterClassification(true, null);
    }

    for (String fieldName : parsedFields.keySet()) {
      String normalizedFieldName = fieldName.startsWith("!") ? fieldName.substring(1) : fieldName;
      String baseField =
          normalizedFieldName.contains(".")
              ? normalizedFieldName.substring(0, normalizedFieldName.indexOf('.'))
              : normalizedFieldName;
      if (NODE_LEVEL_FIELDS.contains(normalizedFieldName)
          || NODE_LEVEL_FIELDS.contains(baseField)) {
        return new FilterClassification(true, null);
      }
    }

    return new FilterClassification(false, queryFilter);
  }

  public static final class FilterClassification {
    private final boolean hasNodeLevelFilters;
    private final String structuralFilterOnly;

    private FilterClassification(boolean hasNodeLevelFilters, String structuralFilterOnly) {
      this.hasNodeLevelFilters = hasNodeLevelFilters;
      this.structuralFilterOnly = structuralFilterOnly;
    }

    public boolean hasNodeLevelFilters() {
      return hasNodeLevelFilters;
    }

    public String getStructuralFilterOnly() {
      return structuralFilterOnly;
    }
  }
}
