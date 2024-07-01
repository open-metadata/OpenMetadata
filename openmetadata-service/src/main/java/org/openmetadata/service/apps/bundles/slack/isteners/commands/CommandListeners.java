package org.openmetadata.service.apps.bundles.slack.isteners.commands;

import com.slack.api.bolt.App;
import org.openmetadata.service.apps.bundles.slack.isteners.ListenerProvider;
import org.openmetadata.service.formatter.decorators.SlackMessageDecorator;

public class CommandListeners implements ListenerProvider {
  SlackMessageDecorator decorator = new SlackMessageDecorator();

  @Override
  public void register(App app) {
    // Command to search OpenMetadata for assets
    app.command("/search-omd", new GlobalSearchCommand(decorator));

    // Command to fetch details of a specific asset using its fully qualified name (FQN) or ID
    app.command("/asset", new FetchAssetCommand(decorator));
  }
}
