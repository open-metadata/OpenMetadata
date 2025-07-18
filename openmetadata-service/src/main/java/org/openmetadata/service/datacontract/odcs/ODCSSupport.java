package org.openmetadata.service.datacontract.odcs;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * ODCS Support channel model
 */
@Data
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ODCSSupport {

  @JsonProperty("name")
  private String name;

  @JsonProperty("channel")
  private String channel;

  @JsonProperty("url")
  private String url;
}
