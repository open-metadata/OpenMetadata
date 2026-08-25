package org.openmetadata.service.apps.bundles.changeEvent.slack;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.slack.api.model.block.LayoutBlock;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.openmetadata.service.notifications.channels.NotificationMessage;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SlackMessage implements NotificationMessage {
  private List<LayoutBlock> blocks;
  private List<Attachment> attachments;

  @Getter
  @Setter
  @NoArgsConstructor
  @AllArgsConstructor
  @Builder
  @JsonInclude(JsonInclude.Include.NON_NULL)
  public static class Attachment {
    private String color;
    private List<LayoutBlock> blocks;
  }
}
