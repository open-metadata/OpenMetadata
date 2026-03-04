package org.openmetadata.service.notifications.channels.slack;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.slack.api.model.block.LayoutBlock;
import java.util.List;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.openmetadata.service.apps.bundles.changeEvent.slack.SlackMessage;

/**
 * Slack Table Block attachment. Tables are sent as attachments in Slack messages. Only one table is
 * allowed per message.
 *
 * @see <a href="https://docs.slack.dev/reference/block-kit/blocks/table-block">Slack Table Block</a>
 */
@Getter
@Setter
@NoArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SlackTableAttachment extends SlackMessage.Attachment {

  public SlackTableAttachment(TableBlock table) {
    setBlocks(List.of(table));
  }

  @Getter
  @Setter
  @Builder
  @JsonInclude(JsonInclude.Include.NON_NULL)
  public static class TableBlock implements LayoutBlock {
    @Builder.Default private final String type = "table";

    @JsonProperty("block_id")
    private String blockId;

    private List<List<TableCell>> rows;

    @JsonProperty("column_settings")
    private List<ColumnSetting> columnSettings;
  }

  @Getter
  @Setter
  @Builder
  @JsonInclude(JsonInclude.Include.NON_NULL)
  public static class TableCell {
    private String type;
    private String text;

    public static TableCell rawText(String text) {
      return TableCell.builder().type("raw_text").text(text).build();
    }
  }

  @Getter
  @Setter
  @Builder
  @JsonInclude(JsonInclude.Include.NON_NULL)
  public static class ColumnSetting {
    private String align;

    @JsonProperty("is_wrapped")
    private Boolean isWrapped;
  }
}
