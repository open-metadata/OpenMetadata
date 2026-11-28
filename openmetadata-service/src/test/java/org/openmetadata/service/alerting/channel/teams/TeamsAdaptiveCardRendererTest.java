package org.openmetadata.service.alerting.channel.teams;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

class TeamsAdaptiveCardRendererTest {

  private static final String URL = "https://demo.getcollate.io/test-suites/redshift.orders";

  @Test
  void codeSpanHoldingOnlyAUrlBecomesAClickableLink() {
    String card = renderBody("<p>Details: <code>" + URL + "</code></p>");

    assertTrue(card.contains("[" + URL + "](" + URL + ")"));
    assertFalse(card.contains("`"));
  }

  @Test
  void adaptiveCardDeclaresVersionThatSupportsTableElements() {
    // Table/TableRow/TableCell were introduced in Adaptive Cards schema 1.5; a card declaring a
    // lower target version has those elements silently dropped by the Teams renderer.
    TeamsMessage.AdaptiveCardContent card = renderCard("<p>no table here</p>");

    assertVersionAtLeast("1.5", card.getVersion());
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

  private static TeamsMessage.AdaptiveCardContent renderCard(String templateHtml) {
    TeamsMessage message =
        assertInstanceOf(
            TeamsMessage.class, TeamsAdaptiveCardRenderer.create().render(templateHtml, null));
    return message.getAttachments().getFirst().getContent();
  }

  private static void assertVersionAtLeast(String minimum, String actual) {
    assertNotNull(actual, "Adaptive Card version must not be null");
    int[] min = parseVersion(minimum);
    int[] act = parseVersion(actual);
    assertTrue(
        act[0] > min[0] || (act[0] == min[0] && act[1] >= min[1]),
        "Adaptive Card version "
            + actual
            + " must be >= "
            + minimum
            + " so Table/TableRow/TableCell (schema 1.5) are not dropped by Teams");
  }

  private static int[] parseVersion(String version) {
    String[] parts = version.split("\\.");
    int major = parts.length > 0 ? Integer.parseInt(parts[0]) : 0;
    int minor = parts.length > 1 ? Integer.parseInt(parts[1]) : 0;
    return new int[] {major, minor};
  }
}
