package org.openmetadata.service.apps.bundles.slack.isteners.events.AppMentionListeners;

import com.slack.api.bolt.App;
import com.slack.api.bolt.context.builtin.EventContext;
import com.slack.api.bolt.response.Response;
import com.slack.api.methods.SlackApiException;
import com.slack.api.model.block.Blocks;
import com.slack.api.model.block.SectionBlock;
import com.slack.api.model.block.composition.BlockCompositions;
import java.io.IOException;

public class DefaultCommandHandler {
  private final App app;

  public DefaultCommandHandler(App app) {
    this.app = app;
  }

  public Response handle(EventContext ctx) throws SlackApiException, IOException {
    ctx.logger.info("Handling default command");

    this.app
        .executorService()
        .submit(
            () -> {
              var blocks =
                  Blocks.asBlocks(
                      SectionBlock.builder()
                          .text(
                              BlockCompositions.markdownText(
                                  ":wave: *Welcome to OpenMetadata-Slack Integration!*"))
                          .build(),
                      SectionBlock.builder()
                          .text(
                              BlockCompositions.markdownText(
                                  "OpenMetadata enhances your data management and collaboration. "
                                      + "Receive notifications, send messages, search entity data, and share links directly within Slack."))
                          .build(),
                      SectionBlock.builder()
                          .text(BlockCompositions.markdownText("*Key Features:*"))
                          .build(),
                      SectionBlock.builder()
                          .text(
                              BlockCompositions.markdownText(
                                  "• *Search entities*: Search glossary, terms, tags, and tables directly from Slack."))
                          .build(),
                      SectionBlock.builder()
                          .text(
                              BlockCompositions.markdownText(
                                  "• *Notifications*: Stay updated with alerts and mentions."))
                          .build(),
                      SectionBlock.builder()
                          .text(
                              BlockCompositions.markdownText(
                                  "• *Link Sharing*: Share OpenMetadata links easily."))
                          .build(),
                      SectionBlock.builder()
                          .text(BlockCompositions.markdownText("*Quick Commands:*"))
                          .build(),
                      SectionBlock.builder()
                          .text(
                              BlockCompositions.markdownText(
                                  "`/search-glossary glossaryFqn`\nSearch the glossary by fully qualified name."))
                          .build(),
                      SectionBlock.builder()
                          .text(
                              BlockCompositions.markdownText(
                                  "`/search-term glossaryTermFqn`\nSearch the glossary term by fully qualified name."))
                          .build(),
                      SectionBlock.builder()
                          .text(
                              BlockCompositions.markdownText(
                                  "`/search-tag tagfqn`\nSearch tag by fully qualified name."))
                          .build(),
                      SectionBlock.builder()
                          .text(
                              BlockCompositions.markdownText(
                                  "`/search-table tableFqn`\nSearch the table by fully qualified name."))
                          .build());

              try {
                var postMessageResponse =
                    ctx.say(sayReq -> sayReq.channel(ctx.getChannelId()).blocks(blocks));
                if (!postMessageResponse.isOk()) {
                  ctx.logger.error(postMessageResponse.toString());
                }
              } catch (Exception e) {
                ctx.logger.error(
                    "Failed to call chat.postMessage API (error: {})", e.getMessage(), e);
              }
            });

    return Response.ok();
  }
}
