package org.openmetadata.service.apps.bundles.slack.isteners.events;

import static com.slack.api.model.block.Blocks.asBlocks;
import static com.slack.api.model.block.Blocks.section;
import static com.slack.api.model.block.composition.BlockCompositions.markdownText;
import static com.slack.api.model.view.Views.view;

import com.slack.api.app_backend.events.payload.EventsApiPayload;
import com.slack.api.bolt.App;
import com.slack.api.bolt.context.builtin.EventContext;
import com.slack.api.bolt.handler.BoltEventHandler;
import com.slack.api.bolt.response.Response;
import com.slack.api.methods.SlackApiException;
import com.slack.api.model.event.AppHomeOpenedEvent;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.apache.commons.io.IOUtils;

public class AppHomeOpenedListener implements BoltEventHandler<AppHomeOpenedEvent> {
  private final App app;
  public static final String HOME_VIEW_TEMPLATE = "slackViewTemplates/home_view.json";

  public AppHomeOpenedListener(App app) {
    this.app = app;
  }

  @Override
  public Response apply(EventsApiPayload<AppHomeOpenedEvent> payload, EventContext ctx)
      throws IOException, SlackApiException {
    String jsonView = readJsonFromFile(HOME_VIEW_TEMPLATE);

    this.app
        .executorService()
        .submit(
            () -> {
              // run the main logic asynchronously
              var appHomeView =
                  view(
                      view ->
                          view.type("home")
                              .blocks(
                                  asBlocks(
                                      section(
                                          section ->
                                              section.text(
                                                  markdownText(
                                                      mt ->
                                                          mt.text(":wave: Hello, Siddhant!)")))))));

              try {
                var viewsPublishResponse =
                    ctx.client()
                        .viewsPublish(
                            r -> r.userId(payload.getEvent().getUser()).viewAsString(jsonView));
                if (!viewsPublishResponse.isOk()) {
                  ctx.logger.error(viewsPublishResponse.toString());
                }
              } catch (Exception e) {
                ctx.logger.error("Failed to call views.publish API (error: {})", e.getMessage(), e);
              }
            });
    return ctx.ack();
  }

  private String readJsonFromFile(String filePath) throws IOException {
    try (InputStream inputStream = getClass().getClassLoader().getResourceAsStream(filePath)) {
      if (inputStream == null) {
        throw new IOException("File not found: " + filePath);
      }
      return IOUtils.toString(inputStream, StandardCharsets.UTF_8);
    } catch (IOException e) {
      throw e;
    }
  }
}
