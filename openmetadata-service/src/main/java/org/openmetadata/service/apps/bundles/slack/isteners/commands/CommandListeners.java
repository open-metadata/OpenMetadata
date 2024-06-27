package org.openmetadata.service.apps.bundles.slack.isteners.commands;

import com.slack.api.bolt.App;
import org.openmetadata.service.apps.bundles.slack.isteners.ListenerProvider;
import org.openmetadata.service.formatter.decorators.SlackMessageDecorator;

public class CommandListeners implements ListenerProvider {
  SlackMessageDecorator decorator = new SlackMessageDecorator();

  @Override
  public void register(App app) {
    app.command("/search-glossary", new GlossarySearchCommand(decorator));
  }
}
