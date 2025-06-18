package org.openmetadata.service.entity.services.connections.metadata.looker;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class LookerColumnLineage {
  @JsonProperty("explore_name")
  private String exploreName;

  @JsonProperty("view_name")
  private String viewName;

  @JsonProperty("column_mappings")
  private List<ColumnMapping> columnMappings;

  @Getter
  @Setter
  public static class ColumnMapping {
    @JsonProperty("explore_column")
    private String exploreColumn;

    @JsonProperty("view_column")
    private String viewColumn;

    @JsonProperty("transformation")
    private String transformation;

    @JsonProperty("metadata")
    private Map<String, Object> metadata;
  }
} 