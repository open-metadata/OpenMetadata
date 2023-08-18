package org.openmetadata.service.events.subscription.msteams;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import lombok.Getter;
import lombok.Setter;

@JsonIgnoreProperties(ignoreUnknown = true)
@Getter
@Setter
public class TeamsMessage {
  @Getter
  @Setter
  public static class Section {
    @JsonProperty("activityTitle")
    public String activityTitle;

    @JsonProperty("activityText")
    public String activityText;
  }

  @JsonProperty("@type")
  public String type = "MessageCard";

  @JsonProperty("@context")
  public String context = "http://schema.org/extensions";

  @JsonProperty("summary")
  public String summary;

  @JsonProperty("sections")
  public List<Section> sections;
}
