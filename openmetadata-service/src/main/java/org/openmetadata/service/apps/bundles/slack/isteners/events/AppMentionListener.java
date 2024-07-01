package org.openmetadata.service.apps.bundles.slack.isteners.events;

import com.slack.api.app_backend.events.payload.EventsApiPayload;
import com.slack.api.bolt.App;
import com.slack.api.bolt.context.builtin.EventContext;
import com.slack.api.bolt.handler.BoltEventHandler;
import com.slack.api.bolt.response.Response;
import com.slack.api.methods.SlackApiException;
import com.slack.api.model.event.AppMentionEvent;
import java.io.IOException;
import org.openmetadata.service.apps.bundles.slack.isteners.events.AppMentionListeners.DefaultCommandHandler;
import org.openmetadata.service.apps.bundles.slack.isteners.events.AppMentionListeners.HelpCommandHandler;

public class AppMentionListener implements BoltEventHandler<AppMentionEvent> {
  private final App app;
  private static final String HELP_COMMAND = "help";
  private static final String INFO_COMMAND = "info";

  public AppMentionListener(App app) {
    this.app = app;
  }

  @Override
  public Response apply(EventsApiPayload<AppMentionEvent> payload, EventContext ctx)
      throws IOException, SlackApiException {

    String command = payload.getEvent().getText().replaceFirst("<@\\w+>", "").trim();

    return switch (command.toLowerCase()) {
      case HELP_COMMAND -> new HelpCommandHandler(app).handle(ctx);
      case "" -> new DefaultCommandHandler(app).handle(ctx);
      case INFO_COMMAND -> Response.ok(); // pending
      default -> Response.ok(); // doing nothing for unknown commands as of now.
    };
  }
}
