package org.openmetadata.service.datacontract.odcs;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Map;
import javax.validation.constraints.NotBlank;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * ODCS SLA (Service Level Agreement) property model
 */
@Data
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ODCSSla {
  
  @JsonProperty("property")
  @NotBlank(message = "SLA property name is required")
  private String property;
  
  @JsonProperty("value")
  private String value;
  
  @JsonProperty("unit")
  private String unit;
  
  @JsonProperty("customProperties")
  private Map<String, Object> customProperties;
}