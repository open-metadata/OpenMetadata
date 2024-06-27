package org.openmetadata.service.apps.bundles.slack.isteners;

import com.slack.api.bolt.App;
import org.openmetadata.service.apps.bundles.slack.isteners.commands.CommandListeners;
import org.openmetadata.service.apps.bundles.slack.isteners.events.EventListeners;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class Listeners {
  public static Logger logger = LoggerFactory.getLogger(Listeners.class);

  public static void register(App app) {
    for (ListenerProvider provider : getAllListeners()) {
      provider.register(app);
      logger.info("{} Registered", provider.getClass().getSimpleName());
    }
  }

  private static ListenerProvider[] getAllListeners() {
    return new ListenerProvider[] {
      new CommandListeners(), new EventListeners(),
    };
  }
}
