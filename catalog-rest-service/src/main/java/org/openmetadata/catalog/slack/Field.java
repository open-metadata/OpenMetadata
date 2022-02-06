package org.openmetadata.catalog.slack;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

@JsonIgnoreProperties(ignoreUnknown = true)
public class Field {
  @Getter @Setter private String title;
  @Getter @Setter private String value;

  @JsonProperty("short_enough")
  @Getter
  @Setter
  private boolean shortEnough;

  @JsonProperty("short")
  @Getter
  @Setter
  private boolean shortField;
}
