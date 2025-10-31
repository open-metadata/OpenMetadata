package org.openmetadata.service.notifications.channels.teams;

import java.util.ArrayList;
import java.util.List;
import org.commonmark.node.Node;
import org.openmetadata.service.apps.bundles.changeEvent.msteams.TeamsMessage;
import org.openmetadata.service.notifications.channels.BaseMarkdownChannelRenderer;
import org.openmetadata.service.notifications.channels.HtmlToMarkdownAdapter;
import org.openmetadata.service.notifications.channels.NotificationMessage;
import org.openmetadata.service.notifications.channels.TemplateFormatAdapter;

public class TeamsAdaptiveCardRenderer extends BaseMarkdownChannelRenderer<TeamsMessage> {

  private TeamsAdaptiveCardRenderer(TemplateFormatAdapter adapter) {
    super(adapter);
  }

  public static TeamsAdaptiveCardRenderer create() {
    return new TeamsAdaptiveCardRenderer(HtmlToMarkdownAdapter.getInstance());
  }

  @Override
  protected NotificationMessage doRender(Node document, Node subjectNode) {
    TeamsCardAssembler visitor = new TeamsCardAssembler();

    if (subjectNode != null) {
      String subject = extractPlainText(subjectNode);
      if (!subject.isEmpty()) {
        visitor.body.add(visitor.createTextBlock(subject, "heading", 2, true));
      }
    }

    document.accept(visitor);
    visitor.flushCurrentText();

    TeamsMessage.AdaptiveCardContent adaptiveCard =
        TeamsMessage.AdaptiveCardContent.builder()
            .type("AdaptiveCard")
            .version("1.4")
            .body(visitor.body)
            .build();

    TeamsMessage.Attachment attachment =
        TeamsMessage.Attachment.builder()
            .contentType("application/vnd.microsoft.card.adaptive")
            .content(adaptiveCard)
            .build();

    List<TeamsMessage.Attachment> attachments = new ArrayList<>();
    attachments.add(attachment);

    return TeamsMessage.builder().type("message").attachments(attachments).build();
  }
}
