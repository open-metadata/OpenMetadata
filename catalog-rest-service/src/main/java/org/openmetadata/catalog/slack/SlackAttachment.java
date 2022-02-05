package org.openmetadata.catalog.slack;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import lombok.Getter;
import lombok.Setter;

@JsonIgnoreProperties(ignoreUnknown = true)
public class SlackAttachment {
  @Getter @Setter private String fallback;
  @Getter @Setter private String color;
  @Getter @Setter private String pretext;

  @JsonProperty("author_name")
  @Getter
  @Setter
  private String authorName;

  @JsonProperty("author_link")
  @Getter
  @Setter
  private String authorLink;

  @JsonProperty("author_icon")
  @Getter
  @Setter
  private String authorIcon;

  @Getter @Setter private String title;

  @JsonProperty("title_link")
  @Getter
  @Setter
  private String titleLink;

  @Getter @Setter private String text;
  @Getter @Setter private Field[] fields;

  @JsonProperty("image_url")
  @Getter
  @Setter
  private String imageUrl;

  @JsonProperty("thumb_url")
  @Getter
  @Setter
  private String thumbUrl;

  @Getter @Setter private String footer;

  @JsonProperty("footer_icon")
  @Getter
  @Setter
  private String footerIcon;

  @Getter @Setter private String ts;

  @JsonProperty("mrkdwn_in")
  @Getter
  @Setter
  private List<String> markdownIn;
}
