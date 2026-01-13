package org.openmetadata.service.notifications.channels.teams;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.IntStream;
import org.commonmark.ext.gfm.strikethrough.Strikethrough;
import org.commonmark.ext.gfm.tables.TableBlock;
import org.commonmark.ext.gfm.tables.TableBody;
import org.commonmark.ext.gfm.tables.TableCell;
import org.commonmark.ext.gfm.tables.TableHead;
import org.commonmark.ext.gfm.tables.TableRow;
import org.commonmark.node.AbstractVisitor;
import org.commonmark.node.BlockQuote;
import org.commonmark.node.BulletList;
import org.commonmark.node.Code;
import org.commonmark.node.CustomBlock;
import org.commonmark.node.CustomNode;
import org.commonmark.node.Document;
import org.commonmark.node.Emphasis;
import org.commonmark.node.FencedCodeBlock;
import org.commonmark.node.HardLineBreak;
import org.commonmark.node.Heading;
import org.commonmark.node.IndentedCodeBlock;
import org.commonmark.node.Link;
import org.commonmark.node.ListItem;
import org.commonmark.node.Node;
import org.commonmark.node.OrderedList;
import org.commonmark.node.Paragraph;
import org.commonmark.node.SoftLineBreak;
import org.commonmark.node.StrongEmphasis;
import org.commonmark.node.Text;
import org.commonmark.node.ThematicBreak;
import org.openmetadata.service.apps.bundles.changeEvent.msteams.TeamsMessage;

final class TeamsCardAssembler extends AbstractVisitor {
  private static final TeamsMarkdownFormatter INLINE_FORMATTER = new TeamsMarkdownFormatter();

  private final List<TeamsMessage.BodyItem> body = new ArrayList<>();
  private final StringBuilder currentText = new StringBuilder();

  // State tracking
  private boolean inList = false;

  List<TeamsMessage.BodyItem> getBodyItems() {
    return new ArrayList<>(body);
  }

  @Override
  public void visit(Document document) {
    visitChildren(document);
    flushCurrentText();
  }

  // --- Block Visitors ---

  @Override
  public void visit(Heading heading) {
    flushCurrentText();
    String text = INLINE_FORMATTER.renderInlineChildren(heading).trim();
    if (!text.isEmpty()) {
      int size = Math.max(1, Math.min(4, heading.getLevel()));
      body.add(createTextBlock(text, "heading", size));
    }
  }

  @Override
  public void visit(Paragraph paragraph) {
    if (!inList) flushCurrentText();
    String text = INLINE_FORMATTER.renderInlineChildren(paragraph);
    if (!text.isBlank()) currentText.append(text);
    if (!inList) flushCurrentText();
  }

  @Override
  public void visit(BlockQuote blockQuote) {
    flushCurrentText();
    StringBuilder content = new StringBuilder();

    for (Node child = blockQuote.getFirstChild(); child != null; child = child.getNext()) {
      String childText = renderNodeToText(child);
      if (!childText.isBlank()) {
        childText.lines().forEach(line -> content.append("> ").append(line).append("\n"));
        content.append("\n");
      }
    }

    String quoted = content.toString().trim();
    if (!quoted.isEmpty()) {
      body.add(
          TeamsMessage.Container.builder()
              .type("Container")
              .style("emphasis")
              .items(List.of(createTextBlock(quoted, null, 0)))
              .build());
    }
  }

  @Override
  public void visit(FencedCodeBlock block) {
    addCodeBlock(block.getLiteral());
  }

  @Override
  public void visit(IndentedCodeBlock block) {
    addCodeBlock(block.getLiteral());
  }

  @Override
  public void visit(ThematicBreak breakNode) {
    flushCurrentText();
    body.add(TeamsMessage.TextBlock.builder().type("TextBlock").separator(true).build());
  }

  @Override
  public void visit(CustomBlock block) {
    if (block instanceof TableBlock table) processTable(table);
    else super.visit(block);
  }

  // --- List Visitors ---

  @Override
  public void visit(BulletList list) {
    processList(list, 0, null);
  }

  @Override
  public void visit(OrderedList list) {
    processList(list, 0, list.getMarkerStartNumber());
  }

  @Override
  public void visit(ListItem item) {
    visitChildren(item);
  }

  // --- Inline Visitors (Accumulate to currentText) ---

  @Override
  public void visit(Text text) {
    currentText.append(text.getLiteral());
  }

  @Override
  public void visit(SoftLineBreak breakNode) {
    currentText.append("\n");
  }

  @Override
  public void visit(HardLineBreak breakNode) {
    currentText.append("\n");
  }

  @Override
  public void visit(Emphasis em) {
    wrapText("*", em);
  }

  @Override
  public void visit(StrongEmphasis em) {
    wrapText("**", em);
  }

  @Override
  public void visit(Code code) {
    currentText.append("`").append(code.getLiteral()).append("`");
  }

  @Override
  public void visit(CustomNode node) {
    if (node instanceof Strikethrough s) wrapText("~~", s);
    else super.visit(node);
  }

  @Override
  public void visit(Link link) {
    int before = currentText.length();
    visitChildren(link);
    String label = currentText.substring(before).trim();
    currentText.setLength(before);

    String url = link.getDestination();
    if (!isAllowedLinkUrl(url)) {
      if (!label.isEmpty()) currentText.append(escapeMdLabel(label));
    } else {
      String safeLabel = label.isEmpty() ? escapeMdUrl(url) : escapeMdLabel(label);
      currentText.append("[").append(safeLabel).append("](").append(escapeMdUrl(url)).append(")");
    }
  }

  // --- Core Processing Logic ---

  private void processList(Node list, int indent, Integer startNum) {
    flushCurrentText();
    inList = true;

    int index = (startNum == null) ? 1 : Math.max(1, startNum);
    String padding = "  ".repeat(indent);

    for (Node node = list.getFirstChild(); node != null; node = node.getNext()) {
      if (!(node instanceof ListItem li)) continue;

      String bullet = (startNum == null) ? "- " : index++ + ". ";
      ListItemBuffer itemBuffer = new ListItemBuffer(padding, bullet);

      for (Node child = li.getFirstChild(); child != null; child = child.getNext()) {
        switch (child) {
          case FencedCodeBlock c -> {
            itemBuffer.flush();
            addCodeBlock(c.getLiteral());
          }
          case IndentedCodeBlock c -> {
            itemBuffer.flush();
            addCodeBlock(c.getLiteral());
          }
          case TableBlock c -> {
            itemBuffer.flush();
            processTable(c);
          }
          case BlockQuote c -> {
            itemBuffer.flush();
            visit(c);
          }
          case BulletList c -> {
            itemBuffer.flush();
            processList(c, indent + 1, null);
          }
          case OrderedList c -> {
            itemBuffer.flush();
            processList(c, indent + 1, c.getMarkerStartNumber());
          }
          default -> itemBuffer.append(renderNodeToText(child));
        }
      }
      itemBuffer.flush(); // Flush remaining text for this list item
    }

    flushCurrentText();
    inList = false;
  }

  private void processTable(TableBlock tableBlock) {
    flushCurrentText();
    TableData data = extractTableData(tableBlock);
    if (data.isEmpty()) return;

    List<TeamsMessage.BodyItem> containerItems = new ArrayList<>();
    int totalRecords = data.rows.size();

    for (int i = 0; i < totalRecords; i++) {
      boolean showHeader = totalRecords > 1;
      boolean addSpacing = i > 0;
      containerItems.add(
          buildTransposedRecord(data.headers, data.rows.get(i), i + 1, showHeader, addSpacing));
    }

    body.add(
        TeamsMessage.Container.builder()
            .type("Container")
            .style("emphasis")
            .bleed(true)
            .spacing("Medium")
            .items(containerItems)
            .build());
  }

  private void addCodeBlock(String literal) {
    flushCurrentText();
    if (literal == null || literal.isEmpty()) return;

    TeamsMessage.TextBlock codeText =
        TeamsMessage.TextBlock.builder()
            .type("TextBlock")
            .text(literal)
            .wrap(true)
            .fontType("Monospace")
            .size("Small")
            .build();

    TeamsMessage.Container container =
        TeamsMessage.Container.builder()
            .type("Container")
            .style("emphasis")
            .items(List.of(codeText))
            .build();

    body.add(container);
  }

  // --- Helpers: Table Construction ---

  private TeamsMessage.Table buildTransposedRecord(
      List<String> headers, List<String> row, int recordNum, boolean showHeader, boolean spacing) {
    List<TeamsMessage.TableRow> tableRows = new ArrayList<>();

    if (showHeader) {
      tableRows.add(createHeaderRow("Record " + recordNum));
    }

    for (int i = 0; i < headers.size(); i++) {
      String val = (i < row.size() && row.get(i) != null) ? row.get(i) : "—";
      tableRows.add(createDataRow(headers.get(i), val));
    }

    TeamsMessage.Table.TableBuilder builder =
        TeamsMessage.Table.builder()
            .type("Table")
            .gridStyle("accent")
            .showGridLines(false)
            .firstRowAsHeader(showHeader)
            .horizontalCellContentAlignment("Left")
            .columns(
                List.of(
                    TeamsMessage.TableColumnDefinition.builder().width(1).build(),
                    TeamsMessage.TableColumnDefinition.builder().width(2).build()))
            .rows(tableRows);

    if (spacing) builder.spacing("Medium").separator(true);
    return builder.build();
  }

  private TeamsMessage.TableRow createHeaderRow(String title) {
    TeamsMessage.TextBlock headerText =
        TeamsMessage.TextBlock.builder()
            .type("TextBlock")
            .text(title)
            .weight("Bolder")
            .size("Medium")
            .wrap(true)
            .build();

    return TeamsMessage.TableRow.builder()
        .type("TableRow")
        .style("accent")
        .cells(
            List.of(
                TeamsMessage.TableCell.builder()
                    .type("TableCell")
                    .items(List.of(headerText))
                    .build(),
                TeamsMessage.TableCell.builder().type("TableCell").items(List.of()).build()))
        .build();
  }

  private TeamsMessage.TableRow createDataRow(String label, String value) {
    TeamsMessage.TextBlock labelBlock =
        TeamsMessage.TextBlock.builder()
            .type("TextBlock")
            .text(label)
            .weight("Bolder")
            .size("Small")
            .wrap(true)
            .isSubtle(true)
            .build();

    TeamsMessage.TextBlock valueBlock =
        TeamsMessage.TextBlock.builder()
            .type("TextBlock")
            .text(value)
            .size("Small")
            .wrap(true)
            .build();

    return TeamsMessage.TableRow.builder()
        .type("TableRow")
        .cells(
            List.of(
                TeamsMessage.TableCell.builder()
                    .type("TableCell")
                    .items(List.of(labelBlock))
                    .build(),
                TeamsMessage.TableCell.builder()
                    .type("TableCell")
                    .items(List.of(valueBlock))
                    .build()))
        .build();
  }

  private TableData extractTableData(TableBlock table) {
    List<String> headers = new ArrayList<>();
    List<List<String>> rows = new ArrayList<>();

    for (Node child = table.getFirstChild(); child != null; child = child.getNext()) {
      if (child instanceof TableHead head) {
        findChild(head, TableRow.class).ifPresent(r -> headers.addAll(extractCells(r)));
      } else if (child instanceof TableBody body) {
        for (Node row = body.getFirstChild(); row != null; row = row.getNext()) {
          if (row instanceof TableRow r) rows.add(extractCells(r));
        }
      }
    }

    if (headers.isEmpty() && rows.isEmpty()) return new TableData(List.of(), List.of());

    int maxCols = rows.stream().mapToInt(List::size).max().orElse(headers.size());

    if (headers.isEmpty()) {
      IntStream.range(0, maxCols).mapToObj(i -> "Column " + (i + 1)).forEach(headers::add);
    }

    return new TableData(headers, rows);
  }

  private List<String> extractCells(TableRow row) {
    List<String> cells = new ArrayList<>();
    for (Node c = row.getFirstChild(); c != null; c = c.getNext()) {
      if (c instanceof TableCell) {
        cells.add(INLINE_FORMATTER.renderInlineChildren(c).trim().replace("\n", " "));
      }
    }
    return cells;
  }

  // --- Helpers: Text & Structure ---

  private void flushCurrentText() {
    if (currentText.isEmpty()) return;
    String text = currentText.toString().trim();
    if (!text.isEmpty()) {
      text.lines()
          .map(String::trim)
          .filter(s -> !s.isEmpty())
          .forEach(line -> body.add(createTextBlock(line, null, 0)));
    }
    currentText.setLength(0);
  }

  private TeamsMessage.TextBlock createTextBlock(String text, String style, int size) {
    TeamsMessage.TextBlock.TextBlockBuilder builder =
        TeamsMessage.TextBlock.builder().type("TextBlock").text(text).wrap(true);
    if ("heading".equals(style)) {
      builder.weight("Bolder");
      builder.size(
          switch (size) {
            case 1 -> "ExtraLarge";
            case 2 -> "Large";
            case 3 -> "Medium";
            default -> "Default";
          });
    }
    return builder.build();
  }

  private void wrapText(String wrapper, Node node) {
    currentText.append(wrapper);
    visitChildren(node);
    currentText.append(wrapper);
  }

  private String renderNodeToText(Node node) {
    if (node instanceof FencedCodeBlock f) return f.getLiteral();
    if (node instanceof IndentedCodeBlock i) return i.getLiteral();
    return INLINE_FORMATTER.renderInlineChildren(node).trim();
  }

  private <T> Optional<T> findChild(Node parent, Class<T> clazz) {
    for (Node c = parent.getFirstChild(); c != null; c = c.getNext()) {
      if (clazz.isInstance(c)) return Optional.of(clazz.cast(c));
    }
    return Optional.empty();
  }

  // --- Helpers: Formatting ---

  private static boolean isAllowedLinkUrl(String url) {
    if (url == null) return false;
    try {
      String s = URI.create(url.trim()).getScheme();
      return s != null
          && (s.equalsIgnoreCase("http")
              || s.equalsIgnoreCase("https")
              || s.equalsIgnoreCase("mailto"));
    } catch (Exception e) {
      return false;
    }
  }

  private static String escapeMdLabel(String s) {
    return s == null
        ? ""
        : s.replace("[", "\\[").replace("]", "\\]").replace("(", "\\(").replace(")", "\\)");
  }

  private static String escapeMdUrl(String s) {
    return s == null ? "" : s.trim().replace(" ", "%20").replace(")", "%29").replace("(", "%28");
  }

  private record TableData(List<String> headers, List<List<String>> rows) {
    boolean isEmpty() {
      return headers.isEmpty() && rows.isEmpty();
    }
  }

  /** Helper to manage list item text buffer and bullet rendering state. */
  private class ListItemBuffer {
    private final StringBuilder buffer = new StringBuilder();
    private final String firstPrefix;
    private final String subPrefix;
    private boolean isFirstLine = true;

    ListItemBuffer(String indentStr, String bullet) {
      this.firstPrefix = indentStr + bullet;
      this.subPrefix = indentStr + "  ";
    }

    void append(String text) {
      if (!text.isBlank()) {
        if (!buffer.isEmpty()) buffer.append('\n');
        buffer.append(text);
      }
    }

    void flush() {
      if (!buffer.isEmpty()) {
        String prefix = isFirstLine ? firstPrefix : subPrefix;
        body.add(createTextBlock(prefix + buffer, null, 0));
        buffer.setLength(0);
        isFirstLine = false;
      } else if (isFirstLine) {
        // Edge case: List item starts immediately with a block (no text).
        // Render the bullet as a standalone line so it isn't lost.
        body.add(createTextBlock(firstPrefix.trim(), null, 0));
        isFirstLine = false;
      }
    }
  }
}
