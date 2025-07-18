package org.openmetadata.service.datacontract.odcs;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Map;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Pattern;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * ODCS Quality model for data quality rules and checks
 */
@Data
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ODCSQuality {

  @JsonProperty("type")
  @NotBlank(message = "Quality type is required")
  @Pattern(
      regexp = "text|sql|library|custom",
      message = "Quality type must be one of: text, sql, library, custom")
  private String type;

  @JsonProperty("description")
  private String description;

  @JsonProperty("rule")
  private String rule;

  @JsonProperty("dimension")
  private String dimension;

  @JsonProperty("severity")
  @Pattern(
      regexp = "info|warning|error|critical",
      message = "Severity must be one of: info, warning, error, critical")
  private String severity;

  @JsonProperty("schedule")
  private String schedule;

  @JsonProperty("library")
  private String library;

  @JsonProperty("dialect")
  private String dialect;

  @JsonProperty("customProperties")
  private Map<String, Object> customProperties;
}
