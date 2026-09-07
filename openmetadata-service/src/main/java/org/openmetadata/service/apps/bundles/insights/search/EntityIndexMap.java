package org.openmetadata.service.apps.bundles.insights.search;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class EntityIndexMap {
  private Map<String, Object> settings;
  private Mappings mappings;

  @Getter
  @Setter
  public static class Mappings {
    private Map<String, Object> properties;

    @JsonProperty("dynamic_templates")
    private List<Map<String, Object>> dynamicTemplates;
  }
}
