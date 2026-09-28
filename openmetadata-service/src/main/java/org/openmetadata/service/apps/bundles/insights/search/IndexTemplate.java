package org.openmetadata.service.apps.bundles.insights.search;

import static org.openmetadata.service.apps.bundles.insights.search.DataInsightsSearchInterface.getStringWithClusterAlias;

import java.util.List;
import java.util.Map;
import org.openmetadata.schema.utils.JsonUtils;

public class IndexTemplate {
  /** Each entity type keeps its own rollover mapping; the last type prepared must not replace it. */
  public static String forDataStream(String name, String templateJson) {
    Map<String, Object> template = JsonUtils.readOrConvertValue(templateJson, Map.class);
    template.put(INDEX_PATTERNS, List.of(name));
    template.put(COMPOSED_OF, List.of(name + "-mapping"));
    template.put("priority", 501);
    return JsonUtils.pojoToJson(template);
  }

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
