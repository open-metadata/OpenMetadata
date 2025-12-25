package org.openmetadata.service.apps.bundles.changeEvent.msteams;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.openmetadata.service.notifications.channels.NotificationMessage;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class TeamsMessage implements NotificationMessage {
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

    @JsonProperty("fontType")
    private String fontType;

    @JsonProperty("isSubtle")
    private Boolean isSubtle;
  }

  @Getter
  @Setter
  @AllArgsConstructor
  @NoArgsConstructor
  @Builder
  public static class Container implements TeamsMessage.BodyItem {
    @JsonProperty("type")
    private String type;

    @JsonProperty("style")
    private String style;

    @JsonProperty("items")
    private List<TeamsMessage.BodyItem> items;

    @JsonProperty("bleed")
    private Boolean bleed;

    @JsonProperty("spacing")
    private String spacing;
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

  @Getter
  @Setter
  @AllArgsConstructor
  @NoArgsConstructor
  @Builder
  public static class Table implements TeamsMessage.BodyItem {
    @JsonProperty("type")
    private String type;

    @JsonProperty("gridStyle")
    private String gridStyle;

    @JsonProperty("firstRowAsHeader")
    private Boolean firstRowAsHeader;

    @JsonProperty("columns")
    private List<TeamsMessage.TableColumnDefinition> columns;

    @JsonProperty("rows")
    private List<TeamsMessage.TableRow> rows;

    @JsonProperty("spacing")
    private String spacing;

    @JsonProperty("showGridLines")
    private Boolean showGridLines;

    @JsonProperty("separator")
    private Boolean separator;

    @JsonProperty("horizontalCellContentAlignment")
    private String horizontalCellContentAlignment;
  }

  @Getter
  @Setter
  @AllArgsConstructor
  @NoArgsConstructor
  @Builder
  public static class TableColumnDefinition {
    @JsonProperty("width")
    private Integer width;
  }

  @Getter
  @Setter
  @AllArgsConstructor
  @NoArgsConstructor
  @Builder
  public static class TableRow {
    @JsonProperty("type")
    private String type;

    @JsonProperty("cells")
    private List<TeamsMessage.TableCell> cells;

    @JsonProperty("style")
    private String style;
  }

  @Getter
  @Setter
  @AllArgsConstructor
  @NoArgsConstructor
  @Builder
  public static class TableCell {
    @JsonProperty("type")
    private String type;

    @JsonProperty("items")
    private List<TeamsMessage.BodyItem> items;
  }

  // Interface for Body Items
  public interface BodyItem {}
}
