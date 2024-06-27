package org.openmetadata.service.apps.bundles.slack.isteners.events;

import com.slack.api.bolt.App;
import com.slack.api.model.event.AppHomeOpenedEvent;
import org.openmetadata.service.apps.bundles.slack.isteners.ListenerProvider;

public class EventListeners implements ListenerProvider {
  @Override
  public void register(App app) {
    app.event(AppHomeOpenedEvent.class, new AppHomeOpenedListener(app));
  }
}
