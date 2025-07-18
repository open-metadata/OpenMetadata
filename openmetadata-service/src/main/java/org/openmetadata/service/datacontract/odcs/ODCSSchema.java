package org.openmetadata.service.datacontract.odcs;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * ODCS Schema model representing data objects and their properties
 */
@Data
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ODCSSchema {

  @JsonProperty("name")
  @NotBlank(message = "Schema name is required")
  private String name;

  @JsonProperty("physicalName")
  private String physicalName;

  @JsonProperty("physicalType")
  private String physicalType;

  @JsonProperty("businessName")
  private String businessName;

  @JsonProperty("description")
  private String description;

  @JsonProperty("properties")
  @Valid
  private List<ODCSProperty> properties;

  @JsonProperty("tags")
  private List<String> tags;
}
