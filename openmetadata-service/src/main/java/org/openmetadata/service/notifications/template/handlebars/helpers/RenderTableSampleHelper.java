package org.openmetadata.service.notifications.template.handlebars.helpers;

import com.github.jknack.handlebars.Handlebars;
import com.github.jknack.handlebars.Options;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelper;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperMetadata;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperUsage;

/**
 * Handlebars helper that renders a table sample for test case notifications.
 *
 * <p>This helper handles:
 * - Limiting columns to a maximum (default 10)
 * - Ensuring the target column is always visible (if test case targets a specific column)
 * - Highlighting the target column in bold with accent color
 * - Limiting rows to a maximum (default 3)
 * - Truncating long cell values
 * - Adding "... and X more" indicators for hidden columns/rows
 *
 * <p>Usage: {{{renderTableSample tableSample targetColumn maxColumns maxRows}}}
 *
 * <p>Parameters:
 * - tableSample: Object with 'columns' (array) and 'rows' (array of arrays)
 * - targetColumn: String name of the column being tested (can be null for table-level tests)
 * - maxColumns: Maximum columns to display (optional, default 10)
 * - maxRows: Maximum rows to display (optional, default 3)
 *
 * <p>Example:
 * {{{renderTableSample entity.failedRowsSample targetColumn 10 3}}}
 */
@Slf4j
public class RenderTableSampleHelper implements HandlebarsHelper {

  private static final int DEFAULT_MAX_COLUMNS = 10;
  private static final int DEFAULT_MAX_ROWS = 3;
  private static final int CELL_TRUNCATE_LENGTH = 70;

  private record Column(String name, int index, boolean isTarget) {}

  private record Selection(List<Column> columns, int hiddenCount) {
    boolean hasOverflow() {
      return hiddenCount > 0;
    }
  }

  @Override
  public String getName() {
    return "renderTableSample";
  }

  @Override
  public void register(Handlebars handlebars) {
    handlebars.registerHelper(getName(), this::render);
  }

  private CharSequence render(Object context, Options options) {
    if (!(context instanceof Map<?, ?> sample)) return "";

    List<?> columns = asList(sample.get("columns"));
    List<?> rows = asList(sample.get("rows"));
    if (columns.isEmpty() || rows.isEmpty()) return "";

    String targetColumn = options.param(0, null);
    int maxColumns = options.param(1, DEFAULT_MAX_COLUMNS);
    int maxRows = options.param(2, DEFAULT_MAX_ROWS);

    int targetIdx = findTargetIndex(columns, targetColumn);
    Selection selection = selectColumns(columns, targetIdx, maxColumns);

    return buildTable(rows, selection, maxRows);
  }

  private List<?> asList(Object value) {
    return value instanceof List<?> list ? list : List.of();
  }

  private int findTargetIndex(List<?> columns, String target) {
    if (target == null || target.isBlank()) return -1;
    String trimmed = target.trim();
    return IntStream.range(0, columns.size())
        .filter(i -> columns.get(i).toString().equals(trimmed))
        .findFirst()
        .orElse(-1);
  }

  private Selection selectColumns(List<?> columns, int targetIdx, int max) {
    int total = columns.size();

    if (total <= max) {
      List<Column> all =
          IntStream.range(0, total)
              .mapToObj(i -> new Column(columns.get(i).toString(), i, i == targetIdx))
              .toList();
      return new Selection(all, 0);
    }

    List<Column> selected = new ArrayList<>();
    boolean targetBeyondView = targetIdx >= max - 1;
    int normalCount = targetBeyondView ? max - 1 : max;

    for (int i = 0; i < normalCount; i++) {
      selected.add(new Column(columns.get(i).toString(), i, i == targetIdx));
    }
    if (targetBeyondView && targetIdx != -1) {
      selected.add(new Column(columns.get(targetIdx).toString(), targetIdx, true));
    }

    return new Selection(selected, total - max);
  }

  private String buildTable(List<?> rows, Selection sel, int maxRows) {
    StringBuilder html =
        new StringBuilder(tableOpen())
            .append("<thead><tr>")
            .append(headerCells(sel))
            .append("</tr></thead>")
            .append("<tbody>")
            .append(bodyCells(rows, sel, maxRows))
            .append("</tbody>")
            .append("</table></div>");

    if (rows.size() > maxRows) {
      html.append(footerMessage(rows.size() - maxRows, "record"));
    }
    return html.toString();
  }

  private String headerCells(Selection sel) {
    StringBuilder sb = new StringBuilder();
    for (Column col : sel.columns()) {
      sb.append(cell("th", col.name(), col.isTarget(), HEADER_BASE));
    }
    if (sel.hasOverflow()) {
      sb.append("<th style=\"")
          .append(HEADER_OVERFLOW_STYLE)
          .append("\">")
          .append("... and ")
          .append(sel.hiddenCount())
          .append(" more column(s)</th>");
    }
    return sb.toString();
  }

  private String bodyCells(List<?> rows, Selection sel, int maxRows) {
    StringBuilder sb = new StringBuilder();
    rows.stream()
        .limit(maxRows)
        .filter(List.class::isInstance)
        .map(List.class::cast)
        .forEach(row -> sb.append(rowHtml(row, sel)));
    return sb.toString();
  }

  private String rowHtml(List<?> row, Selection sel) {
    StringBuilder sb = new StringBuilder("<tr>");
    for (Column col : sel.columns()) {
      String value = truncate(extractCell(row, col.index()));
      sb.append(cell("td", value, col.isTarget(), DATA_BASE));
    }
    if (sel.hasOverflow()) {
      sb.append("<td style=\"").append(ELLIPSIS_STYLE).append("\">...</td>");
    }
    return sb.append("</tr>").toString();
  }

  private String cell(String tag, String content, boolean isTarget, String style) {
    String escaped = escape(content);
    String wrapped = isTarget ? "<strong>%s</strong>".formatted(escaped) : escaped;
    return "<%s style=\"%s\">%s</%s>".formatted(tag, style, wrapped, tag);
  }

  private String extractCell(List<?> row, int idx) {
    Object val = (idx >= 0 && idx < row.size()) ? row.get(idx) : null;
    return val != null ? val.toString() : "";
  }

  private String truncate(String text) {
    return text.length() <= CELL_TRUNCATE_LENGTH
        ? text
        : text.substring(0, CELL_TRUNCATE_LENGTH) + "...";
  }

  private String escape(String text) {
    return text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\"", "&quot;")
        .replace("'", "&#x27;");
  }

  private String footerMessage(int count, String type) {
    return "<p style=\"%s\">... and %d more %s(s)</p>".formatted(FOOTER_STYLE, count, type);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Styles
  // ─────────────────────────────────────────────────────────────────────────────

  private static final String BASE_CELL = "padding:12px 14px;white-space:nowrap;min-width:80px;";
  private static final String HEADER_BASE =
      BASE_CELL
          + "text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;background-color:#f8fafc;border-bottom:2px solid #e2e8f0;";
  private static final String DATA_BASE =
      BASE_CELL + "vertical-align:middle;border-bottom:1px solid #f1f5f9;";

  private static final String HEADER_OVERFLOW_STYLE = HEADER_BASE + "text-align:center;";
  private static final String ELLIPSIS_STYLE = DATA_BASE + "text-align:center;font-style:italic;";
  private static final String FOOTER_STYLE =
      "text-align:center;font-style:italic;font-size:12px;margin:8px 0 0 0;";

  private String tableOpen() {
    return """
        <div class="om-data-table-container" style="display:block;width:100%;max-width:100%;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;">\
        <table class="om-data-table" style="border-collapse:separate;border-spacing:0;margin:0;width:max-content;min-width:100%;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:18px;background-color:#fff;border:1px solid #e2e8f0;border-radius:8px;">""";
  }

  @Override
  public HandlebarsHelperMetadata getMetadata() {
    return new HandlebarsHelperMetadata()
        .withName("renderTableSample")
        .withDescription(
            "Render a table sample with column limiting, target column highlighting, and row limiting")
        .withCursorOffset(21)
        .withUsages(
            List.of(
                new HandlebarsHelperUsage()
                    .withSyntax("{{renderTableSample }}")
                    .withExample(
                        "{{{renderTableSample entity.failedRowsSample targetColumn 10 3}}}")));
  }
}
