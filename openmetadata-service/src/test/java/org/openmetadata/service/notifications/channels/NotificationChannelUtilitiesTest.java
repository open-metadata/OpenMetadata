package org.openmetadata.service.notifications.channels;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.commonmark.node.Node;
import org.junit.jupiter.api.Test;

class NotificationChannelUtilitiesTest {

  @Test
  void htmlSanitizerReturnsEmptyForNullOrEmptyInput() {
    assertEquals("", HtmlSanitizer.sanitize(null));
    assertEquals("", HtmlSanitizer.sanitize(""));
  }

  @Test
  void htmlSanitizerRemovesUnsafeMarkupAndProtocols() {
    String html =
        "<script>alert(1)</script><p>Hello <a href=\"javascript:alert(1)\">bad</a> "
            + "<a href=\"https://example.com\" title=\"safe\">safe</a></p>";

    String sanitized = HtmlSanitizer.sanitize(html);

    assertFalse(sanitized.contains("<script"));
    assertFalse(sanitized.contains("javascript:"));
    assertTrue(sanitized.contains("https://example.com"));
    assertTrue(sanitized.contains("rel=\"nofollow\""));
  }

  @Test
  void markdownParserHandlesEmptyInputAndRejectsOversizedInput() {
    Node parsed = MarkdownParser.parse(null);

    assertNotNull(parsed);
    assertNull(parsed.getFirstChild());

    IllegalArgumentException exception =
        assertThrows(
            IllegalArgumentException.class, () -> MarkdownParser.parse("a".repeat(50_001)));

    assertTrue(exception.getMessage().contains("50000"));
  }

  @Test
  void htmlToMarkdownAdapterConvertsInlineFormattingLinksAndCodeBlocks() {
    String html =
        "<p><strong>Bold</strong> <em>italic</em> <code>inline`code</code> "
            + "<a href=\"https://example.com\">link</a></p>"
            + "<pre><code class=\"language-sql\">select * from table;</code></pre>";

    String markdown = HtmlToMarkdownAdapter.getInstance().adapt(html);

    assertTrue(markdown.contains("**Bold**"));
    assertTrue(markdown.contains("*italic*"));
    assertTrue(markdown.contains("``inline`code``"));
    assertTrue(markdown.contains("[link](https://example.com)"));
    assertTrue(markdown.contains("```sql"));
    assertTrue(markdown.contains("select * from table;"));
  }

  @Test
  void htmlToMarkdownAdapterConvertsHtmlTablesToMarkdownTables() {
    String html =
        "<table><thead><tr><th>Name</th><th>Value</th></tr></thead>"
            + "<tbody><tr><td>foo</td><td>bar</td></tr></tbody></table>";

    String markdown = HtmlToMarkdownAdapter.getInstance().adapt(html);

    assertTrue(markdown.contains("Name"));
    assertTrue(markdown.contains("Value"));
    assertTrue(markdown.contains("foo"));
    assertTrue(markdown.contains("bar"));
    assertTrue(markdown.contains("|"));
  }

  @Test
  void baseMarkdownRendererAdaptsParsesAndExtractsPlainText() {
    TestRenderer renderer = new TestRenderer(content -> content);

    TestMessage message =
        (TestMessage)
            renderer.render(
                "See [docs](https://example.com) and ![](https://img \"Diagram\") using `sql`.",
                "Subject **bold**");

    assertEquals("See docs and Diagram using sql.", message.body());
    assertEquals("Subject bold", message.subject());
  }

  @Test
  void baseMarkdownRendererRejectsNullTemplateContent() {
    TestRenderer renderer = new TestRenderer(content -> content);

    IllegalArgumentException exception =
        assertThrows(IllegalArgumentException.class, () -> renderer.render(null, "subject"));

    assertEquals("Template content cannot be null", exception.getMessage());
  }

  private record TestMessage(String body, String subject) implements NotificationMessage {}

  private static final class TestRenderer extends BaseMarkdownChannelRenderer<TestMessage> {
    private TestRenderer(TemplateFormatAdapter adapter) {
      super(adapter);
    }

    @Override
    protected TestMessage doRender(Node document, Node subjectNode) {
      return new TestMessage(
          extractPlainText(document), subjectNode == null ? null : extractPlainText(subjectNode));
    }
  }
}
