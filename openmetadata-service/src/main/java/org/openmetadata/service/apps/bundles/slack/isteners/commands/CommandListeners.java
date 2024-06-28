package org.openmetadata.service.apps.bundles.slack.isteners.commands;

import com.slack.api.bolt.App;
import org.openmetadata.service.apps.bundles.slack.isteners.ListenerProvider;
import org.openmetadata.service.formatter.decorators.SlackMessageDecorator;

public class CommandListeners implements ListenerProvider {
  SlackMessageDecorator decorator = new SlackMessageDecorator();

  @Override
  public void register(App app) {
    app.command("/search-glossary", new GlossarySearchCommand(decorator));
    app.command("/search-term", new GlossaryTermSearchCommand(decorator));
    app.command("/search-tag", new TagSearchCommand(decorator));
    app.command("/search-table", new TableSearchCommand(decorator));
  }
}
