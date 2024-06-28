package org.openmetadata.service.apps.bundles.slack.isteners.events;

import static com.slack.api.model.block.Blocks.actions;
import static com.slack.api.model.block.Blocks.asBlocks;
import static com.slack.api.model.block.Blocks.section;
import static com.slack.api.model.block.composition.BlockCompositions.markdownText;
import static com.slack.api.model.block.composition.BlockCompositions.plainText;
import static com.slack.api.model.block.element.BlockElements.asElements;
import static com.slack.api.model.block.element.BlockElements.button;
import static com.slack.api.model.view.Views.view;

import com.slack.api.app_backend.events.payload.EventsApiPayload;
import com.slack.api.bolt.App;
import com.slack.api.bolt.context.builtin.EventContext;
import com.slack.api.bolt.handler.BoltEventHandler;
import com.slack.api.bolt.response.Response;
import com.slack.api.methods.SlackApiException;
import com.slack.api.model.event.AppHomeOpenedEvent;
import java.io.IOException;

public class AppHomeOpenedListener implements BoltEventHandler<AppHomeOpenedEvent> {
  private final App app;
  public AppHomeOpenedListener(App app) {
    this.app = app;
  }

  @Override
  public Response apply(EventsApiPayload<AppHomeOpenedEvent> payload, EventContext ctx)
      throws IOException, SlackApiException {

    this.app
        .executorService()
        .submit(
            () -> {
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
                                                          mt.text(
                                                              "Hi there! \n The OpenMetadata-Slack integration is here to streamline your data management and enhance team collaboration. This app connects your OpenMetadata workspace with Slack, ensuring you stay in sync and informed.")))),
                                      section(
                                          section ->
                                              section.text(
                                                  markdownText(mt -> mt.text("Let's start:")))),
                                      actions(
                                          action ->
                                              action.elements(
                                                  asElements(
                                                      button(
                                                          b ->
                                                              b.text(
                                                                      plainText(
                                                                          pt ->
                                                                              pt.text(
                                                                                      "Onboarding guide")
                                                                                  .emoji(true)))
                                                                  .style("primary")
                                                                  .value("create_task")
                                                                  .url(
                                                                      "https://www.getcollate.io/"))))))));

              try {
                var viewsPublishResponse =
                    ctx.client()
                        .viewsPublish(
                            r -> r.userId(payload.getEvent().getUser()).view(appHomeView));
                if (!viewsPublishResponse.isOk()) {
                  ctx.logger.error(viewsPublishResponse.toString());
                }
              } catch (Exception e) {
                ctx.logger.error("Failed to call views.publish API (error: {})", e.getMessage(), e);
              }
            });
    return ctx.ack();
  }
}
