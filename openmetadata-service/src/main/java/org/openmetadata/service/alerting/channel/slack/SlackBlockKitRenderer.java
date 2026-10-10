package org.openmetadata.service.alerting.channel.slack;

import com.slack.api.model.block.LayoutBlock;
import java.util.ArrayList;
import java.util.List;
import org.commonmark.node.Node;
import org.openmetadata.service.alerting.content.render.BaseMarkdownChannelRenderer;
import org.openmetadata.service.alerting.content.render.HtmlToMarkdownAdapter;
import org.openmetadata.service.alerting.content.render.NotificationMessage;
import org.openmetadata.service.alerting.content.render.TemplateFormatAdapter;

public class SlackBlockKitRenderer extends BaseMarkdownChannelRenderer<SlackMessage> {
  private static final int SLACK_MAX_BLOCKS = 50;

  private SlackBlockKitRenderer(TemplateFormatAdapter adapter) {
    super(adapter);
  }

  public static SlackBlockKitRenderer create() {
    return new SlackBlockKitRenderer(HtmlToMarkdownAdapter.getInstance());
  }

  @Override
  protected NotificationMessage doRender(Node document, Node subjectNode) {
    SlackBlockAssembler visitor = new SlackBlockAssembler();

    if (subjectNode != null) {
      String subject = extractPlainText(subjectNode);
      if (!subject.isEmpty()) {
        visitor.blocks.add(visitor.createHeaderBlock(subject));
      }
    }

    document.accept(visitor);
    visitor.flushCurrentText();

    List<LayoutBlock> blocks = visitor.blocks;
    if (blocks.size() > SLACK_MAX_BLOCKS) {
      blocks = new ArrayList<>(blocks.subList(0, SLACK_MAX_BLOCKS));
    }

    SlackMessage message = new SlackMessage();
    message.setBlocks(blocks);

    // Add table attachment if one was created (only one table per message allowed)
    SlackTableAttachment tableAttachment = visitor.getTableAttachment();
    if (tableAttachment != null) {
      message.setAttachments(List.of(tableAttachment));
    }

    return message;
  }
}
