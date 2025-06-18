package org.openmetadata.service.entity.services.connections.metadata.looker;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class LookerSDKResponse {
  @JsonProperty("explore")
  private Explore explore;

  @JsonProperty("view")
  private View view;

  @Getter
  @Setter
  public static class Explore {
    @JsonProperty("name")
    private String name;

    @JsonProperty("fields")
    private List<Field> fields;

    @JsonProperty("joins")
    private List<Join> joins;
  }

  @Getter
  @Setter
  public static class View {
    @JsonProperty("name")
    private String name;

    @JsonProperty("sql_table_name")
    private String sqlTableName;

    @JsonProperty("fields")
    private List<Field> fields;
  }

  @Getter
  @Setter
  public static class Field {
    @JsonProperty("name")
    private String name;

    @JsonProperty("type")
    private String type;

    @JsonProperty("sql")
    private String sql;

    @JsonProperty("description")
    private String description;
  }

  @Getter
  @Setter
  public static class Join {
    @JsonProperty("name")
    private String name;

    @JsonProperty("type")
    private String type;

    @JsonProperty("sql_on")
    private String sqlOn;

    @JsonProperty("relationship")
    private String relationship;
  }
} 