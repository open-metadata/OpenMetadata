package org.openmetadata.service.apps.bundles.insights.search;

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
}
