package org.openmetadata.service.apps.bundles.insights.search;

import java.util.List;
import java.util.Map;
import lombok.Getter;
import org.openmetadata.service.util.JsonUtils;

@Getter
public class IndexLifecyclePolicyConfig {
  private final int retentionDays;

  public enum SearchType {
    OPENSEARCH("opensearch"),
    ELASTICSEARCH("elasticsearch");

    private final String value;

    SearchType(String value) {
      this.value = value;
    }

    public String toString() {
      return value;
    }

    public static SearchType fromString(String value) {
      for (SearchType type : SearchType.values()) {
        if (type.value.equalsIgnoreCase(value)) {
          return type;
        }
      }
      throw new IllegalArgumentException("Unknown SearchType: " + value);
    }
  }

  public IndexLifecyclePolicyConfig(String policyName, String policyStr, SearchType searchType) {
    this.retentionDays = parseRetentionDays(policyName, policyStr, searchType);
  }

  public IndexLifecyclePolicyConfig(int retentionDays) {
    this.retentionDays = retentionDays;
  }

  private Integer parseRetentionDays(String policyName, String policyStr, SearchType searchType) {
    if (searchType.equals(SearchType.ELASTICSEARCH)) {
      return parseElasticSearchRetentionDays(policyName, policyStr);
    } else {
      return parseOpenSearchRetentionDays(policyName, policyStr);
    }
  }

  private Integer parseOpenSearchRetentionDays(String policyName, String policyStr) {
    Map<String, Map<String, Object>> policyMap = JsonUtils.readOrConvertValue(policyStr, Map.class);
    List<Map<String, Object>> states =
        JsonUtils.readOrConvertValue(policyMap.get("policy").get("states"), List.class);
    for (Map<String, Object> state : states) {
      if (state.get("name").equals("warm")) {
        List<Map<String, Object>> transitions =
            JsonUtils.readOrConvertValue(state.get("transitions"), List.class);
        Map<String, String> conditions =
            JsonUtils.readOrConvertValue(transitions.get(0).get("conditions"), Map.class);
        return parseRetentionStr(conditions.get("min_index_age"));
      }
    }
    return null;
  }

  private int parseElasticSearchRetentionDays(String policyName, String policyStr) {
    Map<String, Map<String, Map<String, Object>>> policyMap =
        JsonUtils.readOrConvertValue(policyStr, Map.class);
    Map<String, Object> phasesMap =
        JsonUtils.readOrConvertValue(
            policyMap.get(policyName).get("policy").get("phases"), Map.class);
    Map<String, Object> deletePhase =
        JsonUtils.readOrConvertValue(phasesMap.get("delete"), Map.class);

    String retentionStr = (String) deletePhase.get("min_age");
    return parseRetentionStr(retentionStr);
  }

  private int parseRetentionStr(String retentionStr) {
    return Integer.parseInt(retentionStr.replaceAll("\\D", ""));
  }
}
