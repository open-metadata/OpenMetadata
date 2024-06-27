package org.openmetadata.service.apps.bundles.slack.isteners;

import com.slack.api.bolt.App;

public interface ListenerProvider {
  void register(App app);
}
