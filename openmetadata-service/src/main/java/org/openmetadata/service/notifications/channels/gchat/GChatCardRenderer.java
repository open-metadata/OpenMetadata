package org.openmetadata.service.notifications.channels.gchat;

import org.commonmark.node.Node;
import org.openmetadata.service.notifications.channels.BaseMarkdownChannelRenderer;
import org.openmetadata.service.notifications.channels.HtmlToMarkdownAdapter;
import org.openmetadata.service.notifications.channels.NotificationMessage;
import org.openmetadata.service.notifications.channels.TemplateFormatAdapter;

public class GChatCardRenderer extends BaseMarkdownChannelRenderer<GChatMessageV2> {

  private GChatCardRenderer(TemplateFormatAdapter adapter) {
    super(adapter);
  }

  public static GChatCardRenderer create() {
    return new GChatCardRenderer(HtmlToMarkdownAdapter.getInstance());
  }

  @Override
  protected NotificationMessage doRender(Node document, Node subjectNode) {
    GChatCardAssembler visitor = new GChatCardAssembler();

    GChatMessageV2.Header header = null;
    if (subjectNode != null) {
      String subject = extractPlainText(subjectNode);
      if (!subject.isEmpty()) {
        header = new GChatMessageV2.Header(subject, null, null);
      }
    }

    document.accept(visitor);
    visitor.flushCurrentSection();

    GChatMessageV2.Card card = new GChatMessageV2.Card(header, visitor.sections);
    return GChatMessageV2.ofSingleCard(card);
  }
}
