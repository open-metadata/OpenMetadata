package org.openmetadata.service.notifications.channels.slack;

import com.slack.api.model.block.LayoutBlock;
import java.util.ArrayList;
import java.util.List;
import org.commonmark.node.Node;
import org.openmetadata.service.apps.bundles.changeEvent.slack.SlackMessage;
import org.openmetadata.service.notifications.channels.BaseMarkdownChannelRenderer;
import org.openmetadata.service.notifications.channels.HtmlToMarkdownAdapter;
import org.openmetadata.service.notifications.channels.NotificationMessage;
import org.openmetadata.service.notifications.channels.TemplateFormatAdapter;

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
    return message;
  }
}
