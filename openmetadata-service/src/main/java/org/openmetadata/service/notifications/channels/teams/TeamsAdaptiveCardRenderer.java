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
    // 1. Create the container for the final card body
    List<TeamsMessage.BodyItem> cardBody = new ArrayList<>();

    // 2. Render and add the Subject (if present) manually
    if (subjectNode != null) {
      String subject = extractPlainText(subjectNode);
      if (!subject.isEmpty()) {
        cardBody.add(
            TeamsMessage.TextBlock.builder()
                .type("TextBlock")
                .text(subject)
                .size("Large")
                .weight("Bolder")
                .wrap(true)
                .build());
      }
    }

    // 3. Run the Visitor to generate the Markdown body
    TeamsCardAssembler visitor = new TeamsCardAssembler();
    document.accept(visitor);

    // 4. Combine the results (using the new getter from the Assembler)
    cardBody.addAll(visitor.getBodyItems());

    // 5. Build the final Adaptive Card
    TeamsMessage.AdaptiveCardContent adaptiveCard =
        TeamsMessage.AdaptiveCardContent.builder()
            .type("AdaptiveCard")
            .version("1.4")
            .body(cardBody)
            .build();

    TeamsMessage.Attachment attachment =
        TeamsMessage.Attachment.builder()
            .contentType("application/vnd.microsoft.card.adaptive")
            .content(adaptiveCard)
            .build();

    return TeamsMessage.builder().type("message").attachments(List.of(attachment)).build();
  }
}
