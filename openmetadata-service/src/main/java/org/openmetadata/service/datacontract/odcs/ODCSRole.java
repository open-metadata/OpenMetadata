package org.openmetadata.service.datacontract.odcs;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * ODCS Role model for access control definitions
 */
@Data
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ODCSRole {

  @JsonProperty("name")
  private String name;

  @JsonProperty("access")
  private List<String> access;

  @JsonProperty("approvers")
  private List<String> approvers;
}
