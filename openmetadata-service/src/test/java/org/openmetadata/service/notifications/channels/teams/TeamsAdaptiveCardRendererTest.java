package org.openmetadata.service.notifications.channels.teams;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.apps.bundles.changeEvent.msteams.TeamsMessage;

class TeamsAdaptiveCardRendererTest {

  private static final String URL = "https://demo.getcollate.io/test-suites/redshift.orders";

  @Test
  void codeSpanHoldingOnlyAUrlBecomesAClickableLink() {
    String card = renderBody("<p>Details: <code>" + URL + "</code></p>");

    assertTrue(card.contains("[" + URL + "](" + URL + ")"));
    assertFalse(card.contains("`"));
  }

  @Test
  void bareUrlBecomesAClickableLink() {
    String card = renderBody("<p>Details: " + URL + "</p>");

    assertTrue(card.contains("[" + URL + "](" + URL + ")"));
  }

  @Test
  void anchorKeepsItsLabel() {
    String card = renderBody("<p>Details: <a href=\"" + URL + "\">View Test Suite</a></p>");

    assertTrue(card.contains("[View Test Suite](" + URL + ")"));
  }

  @Test
  void codeSpanHoldingNonUrlContentStaysInlineCode() {
    String card = renderBody("<p>Run <code>select * from orders</code> to check</p>");

    assertTrue(card.contains("`select * from orders`"));
  }

  @Test
  void codeSpanMixingAUrlWithOtherContentStaysInlineCode() {
    String card = renderBody("<p><code>curl " + URL + "</code></p>");

    assertTrue(card.contains("`curl " + URL + "`"));
  }

  private static String renderBody(String templateHtml) {
    TeamsMessage message =
        assertInstanceOf(
            TeamsMessage.class, TeamsAdaptiveCardRenderer.create().render(templateHtml, null));

    List<TeamsMessage.BodyItem> body = message.getAttachments().getFirst().getContent().getBody();

    return body.stream()
        .filter(TeamsMessage.TextBlock.class::isInstance)
        .map(TeamsMessage.TextBlock.class::cast)
        .map(TeamsMessage.TextBlock::getText)
        .collect(Collectors.joining("\n"));
  }
}
