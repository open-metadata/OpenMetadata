package org.openmetadata.service.apps.bundles.slack.isteners;

import com.slack.api.bolt.App;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.apps.bundles.slack.isteners.commands.CommandListeners;
import org.openmetadata.service.apps.bundles.slack.isteners.events.EventListeners;
import org.openmetadata.service.apps.bundles.slack.isteners.message.MessageListeners;

@Slf4j
public class Listeners {
  public static void register(App app) {
    for (ListenerProvider provider : getAllListeners()) {
      provider.register(app);
      LOG.info("{} Registered", provider.getClass().getSimpleName());
    }
  }

  private static ListenerProvider[] getAllListeners() {
    return new ListenerProvider[] {
      new CommandListeners(), new EventListeners(), new MessageListeners(),
    };
  }
}
