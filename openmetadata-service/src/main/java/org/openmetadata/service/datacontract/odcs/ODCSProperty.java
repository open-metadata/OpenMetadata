package org.openmetadata.service.datacontract.odcs;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.Map;
import javax.validation.constraints.NotBlank;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * ODCS Property model representing a field/column in a schema
 */
@Data
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ODCSProperty {

  @JsonProperty("name")
  @NotBlank(message = "Property name is required")
  private String name;

  @JsonProperty("physicalName")
  private String physicalName;

  @JsonProperty("logicalType")
  private String logicalType;

  @JsonProperty("physicalType")
  private String physicalType;

  @JsonProperty("businessName")
  private String businessName;

  @JsonProperty("description")
  private String description;

  @JsonProperty("required")
  private Boolean required;

  @JsonProperty("unique")
  private Boolean unique;

  @JsonProperty("primaryKey")
  private Boolean primaryKey;

  @JsonProperty("foreignKey")
  private Map<String, String> foreignKey;

  @JsonProperty("partitioned")
  private Boolean partitioned;

  @JsonProperty("clustered")
  private Boolean clustered;

  @JsonProperty("classification")
  private String classification;

  @JsonProperty("quality")
  private List<ODCSQuality> quality;

  @JsonProperty("format")
  private String format;

  @JsonProperty("precision")
  private Integer precision;

  @JsonProperty("scale")
  private Integer scale;

  @JsonProperty("minLength")
  private Integer minLength;

  @JsonProperty("maxLength")
  private Integer maxLength;

  @JsonProperty("enum")
  private List<String> enumValues;

  @JsonProperty("pattern")
  private String pattern;

  @JsonProperty("tags")
  private List<String> tags;

  @JsonProperty("customProperties")
  private Map<String, Object> customProperties;
}
