package org.openmetadata.service.notifications.channels;

import com.vladsch.flexmark.html2md.converter.FlexmarkHtmlConverter;
import com.vladsch.flexmark.html2md.converter.HtmlMarkdownWriter;
import com.vladsch.flexmark.html2md.converter.HtmlNodeConverterContext;
import com.vladsch.flexmark.html2md.converter.HtmlNodeRenderer;
import com.vladsch.flexmark.html2md.converter.HtmlNodeRendererFactory;
import com.vladsch.flexmark.html2md.converter.HtmlNodeRendererHandler;
import com.vladsch.flexmark.util.data.DataHolder;
import com.vladsch.flexmark.util.data.MutableDataSet;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.jetbrains.annotations.NotNull;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;

@Slf4j
public class HtmlToMarkdownAdapter implements TemplateFormatAdapter {

  private static final FlexmarkHtmlConverter CONVERTER =
      FlexmarkHtmlConverter.builder(new MutableDataSet())
          .htmlNodeRendererFactory(new CodeAndPreRenderer.Factory())
          .htmlNodeRendererFactory(new InlineElementRenderer.Factory())
          .htmlNodeRendererFactory(new TableRenderer.Factory())
          .build();
  private static final HtmlToMarkdownAdapter INSTANCE = new HtmlToMarkdownAdapter();

  private HtmlToMarkdownAdapter() {}

  public static HtmlToMarkdownAdapter getInstance() {
    return INSTANCE;
  }

  @Override
  public String adapt(String templateContent) {
    if (templateContent == null || templateContent.isEmpty()) return "";
    try {
      return CONVERTER.convert(templateContent);
    } catch (Exception e) {
      LOG.error("Failed to convert HTML to Markdown", e);
      return "";
    }
  }

  /** Handles both <pre> and <code> so we can decide inline vs fenced. */
  static class CodeAndPreRenderer implements HtmlNodeRenderer {
    CodeAndPreRenderer(DataHolder options) {}

    @Override
    public @NotNull Set<HtmlNodeRendererHandler<?>> getHtmlNodeRendererHandlers() {
      return new HashSet<>(
          Arrays.asList(
              new HtmlNodeRendererHandler<>("pre", Element.class, this::renderPre),
              new HtmlNodeRendererHandler<>("code", Element.class, this::renderCode)));
    }

    /** Let children render; we don't output anything for <pre> itself. */
    private void renderPre(Element pre, HtmlNodeConverterContext ctx, HtmlMarkdownWriter out) {
      // Delegate to children so the <code> handler gets invoked.
      ctx.renderChildren(pre, false, null);
    }

    /** Render <code> as fenced block if parent is <pre>; otherwise inline code. */
    private void renderCode(Element code, HtmlNodeConverterContext ctx, HtmlMarkdownWriter out) {
      boolean isBlock = code.parent() != null && "pre".equalsIgnoreCase(code.parent().tagName());

      if (isBlock) {
        writeFenced(code, out);
      } else {
        writeInline(code, out);
      }
    }

    /** Fenced block renderer for <pre><code>…</code></pre>. */
    private void writeFenced(Element code, HtmlMarkdownWriter out) {
      // Preserve whitespace/newlines exactly as in HTML <pre>
      String codeText = code.wholeText();

      // Optional language from class="language-xyz" or "lang-xyz"
      String lang = "";
      String klass = code.className();
      if (!klass.isEmpty()) {
        for (String c : klass.split("\\s+")) {
          if (c.startsWith("language-")) {
            lang = c.substring("language-".length());
            break;
          }
          if (c.startsWith("lang-")) {
            lang = c.substring("lang-".length());
            break;
          }
        }
      }

      // Choose a fence that won't collide with content
      String fence = codeText.contains("```") ? "~~~~" : "```";

      out.blankLine();
      out.append(fence);
      if (!lang.isEmpty()) out.append(lang);
      out.line();

      out.append(codeText);
      if (!codeText.endsWith("\n")) out.line();

      out.append(fence);
      out.blankLine();
    }

    /** Inline code renderer for bare <code>…</code>. */
    private void writeInline(Element code, HtmlMarkdownWriter out) {
      // For inline, collapse newlines to spaces and trim outer whitespace
      String text = code.text().replace('\n', ' ').replace('\r', ' ').trim();

      // If the inline text contains backticks, use double backticks as the fence
      boolean hasBacktick = text.indexOf('`') >= 0;
      String tick = hasBacktick ? "``" : "`";

      out.append(tick).append(text).append(tick);
    }

    static class Factory implements HtmlNodeRendererFactory {
      @Override
      public HtmlNodeRenderer apply(DataHolder options) {
        return new CodeAndPreRenderer(options);
      }
    }
  }

  /** Handles inline formatting elements to prevent unwanted spacing. */
  static class InlineElementRenderer implements HtmlNodeRenderer {
    InlineElementRenderer(DataHolder options) {}

    @Override
    public @NotNull Set<HtmlNodeRendererHandler<?>> getHtmlNodeRendererHandlers() {
      return new HashSet<>(
          Arrays.asList(
              new HtmlNodeRendererHandler<>("strong", Element.class, this::renderStrong),
              new HtmlNodeRendererHandler<>("b", Element.class, this::renderStrong),
              new HtmlNodeRendererHandler<>("em", Element.class, this::renderEmphasis),
              new HtmlNodeRendererHandler<>("i", Element.class, this::renderEmphasis),
              new HtmlNodeRendererHandler<>("s", Element.class, this::renderStrikethrough),
              new HtmlNodeRendererHandler<>("del", Element.class, this::renderStrikethrough),
              new HtmlNodeRendererHandler<>("strike", Element.class, this::renderStrikethrough),
              new HtmlNodeRendererHandler<>("a", Element.class, this::renderLink)));
    }

    private void renderStrong(Element elem, HtmlNodeConverterContext ctx, HtmlMarkdownWriter out) {
      out.append("**");
      ctx.renderChildren(elem, false, null);
      out.append("**");
    }

    private void renderEmphasis(
        Element elem, HtmlNodeConverterContext ctx, HtmlMarkdownWriter out) {
      out.append("*");
      ctx.renderChildren(elem, false, null);
      out.append("*");
    }

    private void renderStrikethrough(
        Element elem, HtmlNodeConverterContext ctx, HtmlMarkdownWriter out) {
      out.append("~~");
      ctx.renderChildren(elem, false, null);
      out.append("~~");
    }

    private void renderLink(Element elem, HtmlNodeConverterContext ctx, HtmlMarkdownWriter out) {
      String href = elem.attr("href");
      if (href.isEmpty()) {
        ctx.renderChildren(elem, false, null);
        return;
      }

      // Collect link text
      out.append("[");
      ctx.renderChildren(elem, false, null);
      out.append("](").append(href).append(")");
    }

    static class Factory implements HtmlNodeRendererFactory {
      @Override
      public HtmlNodeRenderer apply(DataHolder options) {
        return new InlineElementRenderer(options);
      }
    }
  }

  /** Handles HTML tables and converts them to GFM-style Markdown tables. */
  static class TableRenderer implements HtmlNodeRenderer {
    private static final int MAX_COL_WIDTH = 50;

    TableRenderer(DataHolder options) {}

    @Override
    public @NotNull Set<HtmlNodeRendererHandler<?>> getHtmlNodeRendererHandlers() {
      return new HashSet<>(
          Arrays.asList(
              new HtmlNodeRendererHandler<>("div", Element.class, this::renderDiv),
              new HtmlNodeRendererHandler<>("table", Element.class, this::renderTable),
              new HtmlNodeRendererHandler<>("thead", Element.class, this::skipElement),
              new HtmlNodeRendererHandler<>("tbody", Element.class, this::skipElement),
              new HtmlNodeRendererHandler<>("tr", Element.class, this::skipElement),
              new HtmlNodeRendererHandler<>("th", Element.class, this::skipElement),
              new HtmlNodeRendererHandler<>("td", Element.class, this::skipElement)));
    }

    private void skipElement(Element elem, HtmlNodeConverterContext ctx, HtmlMarkdownWriter out) {
      // Skip - handled by table renderer
    }

    /** Handles div elements, extracting and rendering any nested tables as GFM markdown. */
    private void renderDiv(Element div, HtmlNodeConverterContext ctx, HtmlMarkdownWriter out) {
      Element nestedTable = div.selectFirst("table");
      if (nestedTable != null) {
        renderTable(nestedTable, ctx, out);
      } else {
        ctx.renderChildren(div, false, null);
      }
    }

    private void renderTable(Element table, HtmlNodeConverterContext ctx, HtmlMarkdownWriter out) {
      List<List<String>> headerRows = new ArrayList<>();
      List<List<String>> bodyRows = new ArrayList<>();

      // Extract header rows from thead
      Element thead = table.selectFirst("thead");
      if (thead != null) {
        for (Element tr : thead.select("> tr")) {
          List<String> row = extractRowCells(tr, "th", "td");
          if (!row.isEmpty()) headerRows.add(row);
        }
      }

      // Extract body rows from tbody or directly from table
      Element tbody = table.selectFirst("tbody");
      Elements bodyTrs = tbody != null ? tbody.select("> tr") : table.select("> tr");
      for (Element tr : bodyTrs) {
        // Skip rows that are inside thead
        if (tr.parent() != null && "thead".equalsIgnoreCase(tr.parent().tagName())) continue;
        List<String> row = extractRowCells(tr, "td", "th");
        if (!row.isEmpty()) bodyRows.add(row);
      }

      // If no explicit header, use first body row as header
      if (headerRows.isEmpty() && !bodyRows.isEmpty()) {
        // Check if first row might be headers (all th cells)
        Element firstTr =
            tbody != null ? tbody.selectFirst("> tr") : table.selectFirst("> tr:not(thead > tr)");
        if (firstTr != null && !firstTr.select("> th").isEmpty()) {
          headerRows.add(bodyRows.removeFirst());
        }
      }

      // Determine column count
      int colCount = 0;
      for (List<String> row : headerRows) colCount = Math.max(colCount, row.size());
      for (List<String> row : bodyRows) colCount = Math.max(colCount, row.size());

      if (colCount == 0) return;

      // Calculate column widths
      int[] colWidths = new int[colCount];
      for (int i = 0; i < colCount; i++) colWidths[i] = 3; // minimum width

      for (List<String> row : headerRows) {
        for (int i = 0; i < row.size(); i++) {
          colWidths[i] = Math.max(colWidths[i], Math.min(row.get(i).length(), MAX_COL_WIDTH));
        }
      }
      for (List<String> row : bodyRows) {
        for (int i = 0; i < row.size(); i++) {
          colWidths[i] = Math.max(colWidths[i], Math.min(row.get(i).length(), MAX_COL_WIDTH));
        }
      }

      out.blankLine();

      // Render header
      if (!headerRows.isEmpty()) {
        for (List<String> headerRow : headerRows) {
          renderRow(out, headerRow, colWidths, colCount);
        }
      } else {
        // Create generic headers
        List<String> genericHeaders = new ArrayList<>();
        for (int i = 0; i < colCount; i++) genericHeaders.add("Column " + (i + 1));
        renderRow(out, genericHeaders, colWidths, colCount);
      }

      // Render separator
      out.append("|");
      for (int i = 0; i < colCount; i++) {
        out.append("-".repeat(colWidths[i] + 2)).append("|");
      }
      out.line();

      // Render body
      for (List<String> row : bodyRows) {
        renderRow(out, row, colWidths, colCount);
      }

      out.blankLine();
    }

    private List<String> extractRowCells(Element tr, String primary, String secondary) {
      List<String> cells = new ArrayList<>();
      Elements primaryCells = tr.select("> " + primary);
      Elements secondaryCells = tr.select("> " + secondary);
      Elements allCells = primaryCells.isEmpty() ? secondaryCells : primaryCells;

      for (Element cell : allCells) {
        String text = cell.text().replace("|", "\\|").replace("\n", " ").trim();
        cells.add(text);
      }
      return cells;
    }

    private void renderRow(HtmlMarkdownWriter out, List<String> cells, int[] colWidths, int colCt) {
      out.append("|");
      for (int i = 0; i < colCt; i++) {
        String cell = i < cells.size() ? cells.get(i) : "";
        if (cell.length() > colWidths[i]) {
          cell = cell.substring(0, colWidths[i] - 3) + "...";
        }
        out.append(" ").append(padRight(cell, colWidths[i])).append(" |");
      }
      out.line();
    }

    private String padRight(String s, int width) {
      if (s.length() >= width) return s;
      return s + " ".repeat(width - s.length());
    }

    static class Factory implements HtmlNodeRendererFactory {
      @Override
      public HtmlNodeRenderer apply(DataHolder options) {
        return new TableRenderer(options);
      }
    }
  }
}
