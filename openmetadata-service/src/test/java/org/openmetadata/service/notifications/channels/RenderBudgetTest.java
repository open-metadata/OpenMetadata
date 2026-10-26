package org.openmetadata.service.notifications.channels;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.commonmark.ext.gfm.tables.TableBlock;
import org.commonmark.node.Node;
import org.junit.jupiter.api.Test;

class RenderBudgetTest {

  private static final HtmlToMarkdownAdapter ADAPTER = HtmlToMarkdownAdapter.getInstance();

  @Test
  void aTableThatWouldPadPastTheBudgetIsRefusedBeforeItIsWritten() {
    String html =
        "<table><tr>"
            + "<td>x</td>".repeat(2_000)
            + "</tr>"
            + "<tr><td>y</td></tr>".repeat(2_000)
            + "</table>";

    assertThrows(RenderBudgetExceededException.class, () -> ADAPTER.adapt(html));
  }

  @Test
  void manyTablesTogetherCannotPassTheBudget() {
    String table =
        "<table><tr>" + "<td>cell</td>".repeat(20) + "</tr>" + "<tr><td>v</td></tr>".repeat(60);
    String html = (table + "</table>").repeat(40);

    assertThrows(RenderBudgetExceededException.class, () -> ADAPTER.adapt(html));
  }

  @Test
  void anOrdinaryTableStillBecomesOneMarkdownTable() {
    StringBuilder html = new StringBuilder("<table><thead><tr>");
    html.append("<th>col</th>".repeat(10)).append("</tr></thead><tbody>");
    html.append(("<tr>" + "<td>value</td>".repeat(10) + "</tr>").repeat(20));
    html.append("</tbody></table>");

    String markdown = ADAPTER.adapt(html.toString());

    assertEquals(22, markdown.strip().lines().count(), "a header, a separator and 20 rows");
    assertEquals(1, tablesIn(MarkdownParser.parse(markdown)));
  }

  @Test
  void codeCannotCloseItsOwnFence() {
    String code = "```\n~~~~\n| a | b |\n|---|---|\n| 1 | 2 |\n````";
    String html = "<pre><code>" + code + "</code></pre>";

    String markdown = ADAPTER.adapt(html);

    assertEquals(0, tablesIn(MarkdownParser.parse(markdown)), markdown);
    assertTrue(markdown.contains(code), "the code is kept as it was written");
  }

  @Test
  void aFenceLanguageCannotCarryMarkdown() {
    String html = "<pre><code class=\"language-sql`|x\">select 1;</code></pre>";

    String markdown = ADAPTER.adapt(html);

    assertFalse(markdown.contains("sql`|x"), markdown);
    assertTrue(markdown.contains("select 1;"));
  }

  @Test
  void aLinkTargetCannotStartANewLine() {
    String html = "<a href=\"https://example.com/a b(c)\n| a | b |\n|---|---|\">text</a>";

    String markdown = ADAPTER.adapt(html).strip();

    assertFalse(markdown.contains("\n"), markdown);
    assertTrue(markdown.startsWith("[text](https://example.com/a%20b%28c%29%0A"), markdown);
  }

  @Test
  void aLinkTargetKeepsItsNonAsciiCharacters() {
    String html = "<a href=\"https://example.com/café x\">text</a>";

    String markdown = ADAPTER.adapt(html).strip();

    assertEquals("[text](https://example.com/café x)", markdown);
  }

  @Test
  void deepNestingDoesNotMultiplyTheOutput() {
    String html =
        "<blockquote>".repeat(500) + "<p>a</p>".repeat(4_000) + "</blockquote>".repeat(500);

    String markdown = ADAPTER.adapt(html);

    assertTrue(markdown.length() < 1_000_000, "rendered " + markdown.length() + " characters");
  }

  @Test
  void htmlLongerThanTheBudgetIsRefused() {
    String html = "<p>" + "a".repeat(RenderLimits.MAX_HTML_CHARS) + "</p>";

    assertThrows(RenderBudgetExceededException.class, () -> ADAPTER.adapt(html));
  }

  @Test
  void markdownThatWouldParseIntoTooManyCellsIsRefused() {
    String header = "| h ".repeat(300) + "|\n";
    String separator = "|---".repeat(300) + "|\n";
    String markdown = header + separator + "x\n".repeat(200);

    assertTrue(markdown.length() < RenderLimits.MAX_MARKDOWN_CHARS);
    assertThrows(RenderBudgetExceededException.class, () -> MarkdownParser.parse(markdown));
  }

  @Test
  void markdownWithFewPipesIsParsed() {
    String markdown = "| a | b |\n|---|---|\n| 1 | 2 |\n\n" + "plain text\n".repeat(2_000);

    assertDoesNotThrow(() -> MarkdownParser.parse(markdown));
  }

  @Test
  void oversizedMarkdownIsABudgetBreach() {
    String markdown = "a".repeat(RenderLimits.MAX_MARKDOWN_CHARS + 1);

    assertThrows(RenderBudgetExceededException.class, () -> MarkdownParser.parse(markdown));
  }

  private static int tablesIn(Node node) {
    int tables = node instanceof TableBlock ? 1 : 0;
    for (Node child = node.getFirstChild(); child != null; child = child.getNext()) {
      tables += tablesIn(child);
    }
    return tables;
  }
}
