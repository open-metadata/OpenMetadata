package org.openmetadata.playwright.scenarios.ui.topic;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.factories.TopicTestFactory;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.playwright.ui.UiSession;
import org.openmetadata.playwright.ui.UiSessionExtension;
import org.openmetadata.playwright.ui.pages.TopicPage;
import org.openmetadata.schema.entity.data.Topic;

/**
 * Java port of {@code Features/Topic.spec.ts}.
 *
 * <p>Each test creates a fresh topic via the SDK and navigates straight to its details
 * page; we never search-then-click as the TS suite does, since direct URL navigation is
 * faster and less flaky.
 */
@ExtendWith({UiSessionExtension.class, TestNamespaceExtension.class})
class TopicUIIT {

  @Test
  void topicDetailsPageShowsSchemaTabWithFieldCount(final UiSession ui, final TestNamespace ns) {
    final Topic topic = TopicTestFactory.createSimple(ns);

    final TopicPage topicPage = TopicPage.open(ui, topic.getFullyQualifiedName());

    // Default factory creates two top-level Record fields.
    assertThat(topicPage.schemaTab()).containsText("2");
  }
}
