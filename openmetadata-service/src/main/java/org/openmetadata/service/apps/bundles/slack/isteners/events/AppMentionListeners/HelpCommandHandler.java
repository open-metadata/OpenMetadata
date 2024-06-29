package org.openmetadata.service.apps.bundles.slack.isteners.events.AppMentionListeners;

import com.slack.api.bolt.App;
import com.slack.api.bolt.context.builtin.EventContext;
import com.slack.api.bolt.response.Response;
import com.slack.api.methods.SlackApiException;
import com.slack.api.model.block.Blocks;
import com.slack.api.model.block.SectionBlock;
import com.slack.api.model.block.composition.BlockCompositions;
import java.io.IOException;

public class HelpCommandHandler {
  private final App app;

  public HelpCommandHandler(App app) {
    this.app = app;
  }

  public Response handle(EventContext ctx) throws SlackApiException, IOException {
    this.app
        .executorService()
        .submit(
            () -> {
              var blocks =
                  Blocks.asBlocks(
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
                String channelId = ctx.getChannelId();
                var postMessageResponse =
                    ctx.say(sayReq -> sayReq.channel(channelId).blocks(blocks));
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
