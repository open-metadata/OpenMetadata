package org.openmetadata.service.alerting.content.render;

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.commonmark.Extension;
import org.commonmark.ext.autolink.AutolinkExtension;
import org.commonmark.ext.gfm.strikethrough.StrikethroughExtension;
import org.commonmark.ext.gfm.tables.TablesExtension;
import org.commonmark.node.Node;
import org.commonmark.parser.Parser;

@Slf4j
public final class MarkdownParser {

  private MarkdownParser() {}

  private static final Parser PARSER;

  static {
    List<Extension> extensions =
        List.of(
            AutolinkExtension.create(), StrikethroughExtension.create(), TablesExtension.create());
    PARSER = Parser.builder().extensions(extensions).build();
  }

  public static Node parse(String markdown) {
    if (markdown == null || markdown.isEmpty()) {
      return PARSER.parse("");
    }

    if (markdown.length() > RenderLimits.MAX_MARKDOWN_CHARS) {
      LOG.warn("Markdown input too large: {} characters", markdown.length());
      throw new RenderBudgetExceededException(
          "Markdown content exceeds maximum length of " + RenderLimits.MAX_MARKDOWN_CHARS);
    }
    requireTableCellsWithinBudget(markdown);

    return PARSER.parse(markdown);
  }

  // A table pads every row to its header's column count, so a wide header over many short rows
  // parses into far more cells than the text holds. A table never crosses a blank line, so each
  // run of non-blank lines can hold at most its line count times its widest line's cell count.
  private static void requireTableCellsWithinBudget(String markdown) {
    long cells = 0;
    long linesInRun = 0;
    long widestRow = 0;
    for (String line : markdown.lines().toList()) {
      boolean blank = line.isBlank();
      cells += blank ? linesInRun * widestRow : 0;
      linesInRun = blank ? 0 : linesInRun + 1;
      widestRow = blank ? 0 : Math.max(widestRow, pipesIn(line) + 1L);
    }
    cells += linesInRun * widestRow;
    if (cells > RenderLimits.MAX_TABLE_CELLS) {
      throw new RenderBudgetExceededException(
          String.format(
              "Markdown tables of up to %d cells exceed the render budget of %d cells",
              cells, RenderLimits.MAX_TABLE_CELLS));
    }
  }

  private static long pipesIn(String line) {
    return line.chars().filter(c -> c == '|').count();
  }
}
