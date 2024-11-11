package org.openmetadata.service.apps.bundles.changeEvent.msteams;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class TeamsMessage {
  @JsonProperty("type")
  private String type;

  @JsonProperty("attachments")
  private List<TeamsMessage.Attachment> attachments;

  @Getter
  @Setter
  @AllArgsConstructor
  @NoArgsConstructor
  @Builder
  public static class Attachment {
    @JsonProperty("contentType")
    private String contentType;

    @JsonProperty("content")
    private TeamsMessage.AdaptiveCardContent content;
  }

  @Getter
  @Setter
  @AllArgsConstructor
  @NoArgsConstructor
  @Builder
  public static class AdaptiveCardContent {
    @JsonProperty("type")
    private String type;

    @JsonProperty("version")
    private String version;

    @JsonProperty("body")
    private List<TeamsMessage.BodyItem> body;
  }

  @Getter
  @Setter
  @AllArgsConstructor
  @NoArgsConstructor
  @Builder
  public static class ColumnSet implements TeamsMessage.BodyItem {
    @JsonProperty("type")
    private String type;

    @JsonProperty("columns")
    private List<TeamsMessage.Column> columns;
  }

  @Getter
  @Setter
  @AllArgsConstructor
  @NoArgsConstructor
  @Builder
  public static class Column {
    @JsonProperty("type")
    private String type;

    @JsonProperty("items")
    private List<TeamsMessage.BodyItem> items;

    @JsonProperty("width")
    private String width;
  }

  @Getter
  @Setter
  @AllArgsConstructor
  @NoArgsConstructor
  @Builder
  public static class Image implements TeamsMessage.BodyItem {
    @JsonProperty("type")
    private String type;

    @JsonProperty("url")
    private String url;

    @JsonProperty("size")
    private String size;
  }

  @Getter
  @Setter
  @AllArgsConstructor
  @NoArgsConstructor
  @Builder
  public static class TextBlock implements TeamsMessage.BodyItem {
    @JsonProperty("type")
    private String type;

    @JsonProperty("text")
    private String text;

    @JsonProperty("size")
    private String size;

    @JsonProperty("weight")
    private String weight;

    @JsonProperty("wrap")
    private boolean wrap;

    @JsonProperty("horizontalAlignment")
    private String horizontalAlignment;

    @JsonProperty("spacing")
    private String spacing;

    @JsonProperty("separator")
    private boolean separator;
  }

  @Getter
  @Setter
  @AllArgsConstructor
  @NoArgsConstructor
  @Builder
  public static class FactSet implements TeamsMessage.BodyItem {
    @JsonProperty("type")
    private String type;

    @JsonProperty("facts")
    private List<TeamsMessage.Fact> facts;
  }

  @Getter
  @Setter
  @AllArgsConstructor
  @NoArgsConstructor
  @Builder
  public static class Fact {
    @JsonProperty("title")
    private String title;

    @JsonProperty("value")
    private String value;
  }

  // Interface for Body Items
  public interface BodyItem {}
}
