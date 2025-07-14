package org.openmetadata.service.datacontract.odcs;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * ODCS Team member model
 */
@Data
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ODCSTeam {
  
  @JsonProperty("username")
  private String username;
  
  @JsonProperty("role")
  private String role;
  
  @JsonProperty("dateIn")
  private String dateIn;
  
  @JsonProperty("dateOut")
  private String dateOut;
}