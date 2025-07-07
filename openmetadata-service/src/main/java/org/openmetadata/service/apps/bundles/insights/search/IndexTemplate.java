package org.openmetadata.service.apps.bundles.insights.search;

import static org.openmetadata.service.apps.bundles.insights.search.DataInsightsSearchInterface.getStringWithClusterAlias;

import java.util.List;
import java.util.Map;
import org.openmetadata.schema.utils.JsonUtils;

public class IndexTemplate {
  public static final String COMPOSED_OF = "composed_of";
  public static final String INDEX_PATTERNS = "index_patterns";

  public static String getIndexTemplateWithClusterAlias(
      String clusterAlias, String indexTemplateJson) {

    Map<String, Object> indexTemplateMap =
        JsonUtils.readOrConvertValue(indexTemplateJson, Map.class);
    List<String> composedOf =
        JsonUtils.readOrConvertValue(indexTemplateMap.get(COMPOSED_OF), List.class);

    composedOf =
        composedOf.stream().map(part -> getStringWithClusterAlias(clusterAlias, part)).toList();
    indexTemplateMap.put(COMPOSED_OF, composedOf);

    List<String> indexPatterns =
        JsonUtils.readOrConvertValue(indexTemplateMap.get(INDEX_PATTERNS), List.class);

    indexPatterns =
        indexPatterns.stream()
            .map(pattern -> getStringWithClusterAlias(clusterAlias, pattern))
            .toList();
    indexTemplateMap.put(INDEX_PATTERNS, indexPatterns);

    return JsonUtils.pojoToJson(indexTemplateMap);
  }
}
