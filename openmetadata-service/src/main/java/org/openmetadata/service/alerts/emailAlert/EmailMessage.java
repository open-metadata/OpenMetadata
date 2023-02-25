package org.openmetadata.service.alerts.emailAlert;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import lombok.Getter;
import lombok.Setter;

public class EmailMessage {
  @Getter
  @Setter
  @JsonProperty("userName")
  private String userName;

  @JsonProperty("updatedBy")
  @Getter
  @Setter
  private String updatedBy;

  @JsonProperty("entityUrl")
  @Getter
  @Setter
  private String entityUrl;

  @JsonProperty("changeMessage")
  @Getter
  @Setter
  private List<String> changeMessage;
}
