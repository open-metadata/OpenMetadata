package org.openmetadata.service.notifications.channels.gchat;

import java.util.ArrayList;
import java.util.List;
import org.apache.commons.text.StringEscapeUtils;
import org.commonmark.ext.gfm.tables.TableBlock;
import org.commonmark.ext.gfm.tables.TableBody;
import org.commonmark.ext.gfm.tables.TableCell;
import org.commonmark.ext.gfm.tables.TableHead;
import org.commonmark.ext.gfm.tables.TableRow;
import org.commonmark.node.AbstractVisitor;
import org.commonmark.node.BlockQuote;
import org.commonmark.node.BulletList;
import org.commonmark.node.CustomBlock;
import org.commonmark.node.CustomNode;
import org.commonmark.node.Document;
import org.commonmark.node.FencedCodeBlock;
import org.commonmark.node.Heading;
import org.commonmark.node.Image;
import org.commonmark.node.IndentedCodeBlock;
import org.commonmark.node.ListItem;
import org.commonmark.node.Node;
import org.commonmark.node.OrderedList;
import org.commonmark.node.Paragraph;
import org.commonmark.node.Text;
import org.commonmark.node.ThematicBreak;

final class GChatCardAssembler extends AbstractVisitor {
  List<GChatMessageV2.Section> sections = new ArrayList<>();
  List<GChatMessageV2.Widget> currentWidgets = new ArrayList<>();
  private final GChatMarkdownFormatter inline = new GChatMarkdownFormatter();

  @Override
  public void visit(CustomNode node) {
    super.visit(node);
  }

  @Override
  public void visit(CustomBlock block) {
    if (block instanceof TableBlock) {
      visitTable((TableBlock) block);
    } else {
      super.visit(block);
    }
  }

  @Override
  public void visit(Document document) {
    visitChildren(document);
    flushCurrentSection();
  }

  @Override
  public void visit(Heading heading) {
    flushCurrentSection();
    String text = inline.renderInlineChildren(heading).trim();
    if (!text.isEmpty()) {
      addParagraph("*" + safeText(text) + "*");
      flushCurrentSection();
    }
  }

  @Override
  public void visit(Paragraph paragraph) {
    Image lone = getSingleImageOrNull(paragraph);
    if (lone != null) {
      renderImageWidget(lone);
      return;
    }
    String text = inline.renderInlineChildren(paragraph).trim();
    // Split on newlines to create separate text widgets for line breaks
    String[] lines = text.split("\\n+");
    for (String line : lines) {
      String trimmed = line.trim();
      if (!trimmed.isEmpty()) {
        addParagraph(trimmed);
      }
    }
  }

  @Override
  public void visit(BlockQuote blockQuote) {
    StringBuilder quotedContent = new StringBuilder();

    // Process each child of the blockquote
    for (Node child = blockQuote.getFirstChild(); child != null; child = child.getNext()) {
      switch (child) {
        case Paragraph paragraph -> {
          String text = inline.renderInlineChildren(child).trim();
          if (!text.isEmpty()) {
            quotedContent.append("> ").append(text).append("\n\n");
          }
        }
        case BulletList bulletList -> {
          StringBuilder listText = new StringBuilder();
          appendList(listText, child, 0, null);
          // Prefix each line with "> " for blockquote
          String[] lines = listText.toString().split("\n");
          for (String line : lines) {
            if (!line.trim().isEmpty()) {
              quotedContent.append("> ").append(line).append("\n");
            }
          }
          quotedContent.append("\n");
        }
        case OrderedList orderedList -> {
          StringBuilder listText = new StringBuilder();
          appendList(listText, child, 0, orderedList.getMarkerStartNumber());
          // Prefix each line with "> " for blockquote
          String[] lines = listText.toString().split("\n");
          for (String line : lines) {
            if (!line.trim().isEmpty()) {
              quotedContent.append("> ").append(line).append("\n");
            }
          }
          quotedContent.append("\n");
        }
        default -> {}
      }
    }

    String quoted = quotedContent.toString().trim();
    if (!quoted.isEmpty()) {
      addParagraph(quoted);
    }
  }

  @Override
  public void visit(BulletList bulletList) {
    StringBuilder sb = new StringBuilder();
    appendList(sb, bulletList, 0, null);
    if (!sb.isEmpty()) addParagraph(sb.toString().trim());
  }

  @Override
  public void visit(OrderedList orderedList) {
    StringBuilder sb = new StringBuilder();
    appendList(sb, orderedList, 0, orderedList.getMarkerStartNumber());
    if (!sb.isEmpty()) addParagraph(sb.toString().trim());
  }

  @Override
  public void visit(ListItem listItem) {
    // children handled by parent list visitors
  }

  @Override
  public void visit(FencedCodeBlock codeBlock) {
    String code = codeBlock.getLiteral();
    if (code != null && !code.isEmpty()) {
      addParagraph(formatCodeBlock(code));
    }
  }

  @Override
  public void visit(IndentedCodeBlock codeBlock) {
    String code = codeBlock.getLiteral();
    if (code != null && !code.isEmpty()) {
      addParagraph(formatCodeBlock(code));
    }
  }

  @Override
  public void visit(ThematicBreak thematicBreak) {
    currentWidgets.add(GChatMessageV2.Widget.divider());
  }

  @Override
  public void visit(Image image) {
    renderImageWidget(image);
  }

  private void visitTable(TableBlock table) {
    flushCurrentSection();

    List<String> headers = new ArrayList<>();
    List<List<String>> bodyRows = new ArrayList<>();

    for (Node child = table.getFirstChild(); child != null; child = child.getNext()) {
      if (child instanceof TableHead) {
        for (Node row = child.getFirstChild(); row != null; row = row.getNext()) {
          if (row instanceof TableRow) {
            headers = extractTableRowCells((TableRow) row);
            break;
          }
        }
      } else if (child instanceof TableBody) {
        for (Node row = child.getFirstChild(); row != null; row = row.getNext()) {
          if (row instanceof TableRow) {
            bodyRows.add(extractTableRowCells((TableRow) row));
          }
        }
      }
    }

    if (headers.isEmpty() && bodyRows.isEmpty()) return;

    int colCount = headers.size();
    for (List<String> row : bodyRows) colCount = Math.max(colCount, row.size());

    if (colCount == 0) return;

    if (headers.isEmpty()) {
      headers = new ArrayList<>();
      for (int i = 0; i < colCount; i++) {
        headers.add("Column " + (i + 1));
      }
    }

    String tableHtml = formatTableAsHtml(headers, bodyRows, colCount, 0);
    if (!tableHtml.isEmpty()) {
      currentWidgets.add(GChatMessageV2.Widget.text(tableHtml));
    }

    flushCurrentSection();
  }

  private String formatTableAsHtml(
      List<String> headers, List<List<String>> rows, int colCount, int indentLevel) {
    StringBuilder html = new StringBuilder();

    if (indentLevel > 0) {
      html.append("<br>");
    }

    // Create a table-like structure for better readability
    for (int rowIdx = 0; rowIdx < rows.size(); rowIdx++) {
      List<String> row = rows.get(rowIdx);

      // Record header with visual separator
      html.append("<b>📋 Record ").append(rowIdx + 1).append("</b><br>");
      html.append("─".repeat(40)).append("<br>");

      // Calculate max key length for alignment
      int maxKeyLength = headers.stream().mapToInt(String::length).max().orElse(0);

      // Key-value pairs with fixed-width columns for alignment
      for (int i = 0; i < colCount; i++) {
        String key = i < headers.size() ? headers.get(i) : "Column " + (i + 1);
        String value = i < row.size() && row.get(i) != null ? row.get(i) : "";

        // Format with monospace for alignment
        html.append("<code>")
            .append(
                String.format("%-" + maxKeyLength + "s : %s", escapeHtml(key), escapeHtml(value)))
            .append("</code><br>");
      }

      // Separator between records
      if (rowIdx < rows.size() - 1) {
        html.append("<br>");
      }
    }

    return html.toString();
  }

  private List<String> extractTableRowCells(TableRow row) {
    List<String> cells = new ArrayList<>();
    for (Node cell = row.getFirstChild(); cell != null; cell = cell.getNext()) {
      if (cell instanceof TableCell) {
        String text = inline.renderInlineChildren(cell).trim();
        cells.add(text.replace("\n", " "));
      }
    }
    return cells;
  }

  void addParagraph(String raw) {
    String text = safeText(raw == null ? "" : raw.trim());
    if (!text.isEmpty()) {
      currentWidgets.add(GChatMessageV2.Widget.text(text));
    }
  }

  void flushCurrentSection() {
    if (!currentWidgets.isEmpty()) {
      sections.add(new GChatMessageV2.Section(new ArrayList<>(currentWidgets)));
      currentWidgets.clear();
    }
  }

  void renderImageWidget(Image image) {
    String altInline = inline.renderInlineChildren(image).trim();
    String alt = !altInline.isEmpty() ? altInline : extractPlainText(image);
    if (alt.isEmpty()) alt = "Image";

    String url = sanitizeUrl(image.getDestination());
    if (!url.isEmpty()) {
      currentWidgets.add(GChatMessageV2.Widget.image(url, escapeHtml(alt)));
    } else {
      addParagraph(escapeHtml(alt));
    }
  }

  private String renderListItemInlineOnly(ListItem li) {
    StringBuilder sb = new StringBuilder();
    boolean first = true;
    for (Node c = li.getFirstChild(); c != null; c = c.getNext()) {
      if (c instanceof BulletList || c instanceof OrderedList) continue;

      String part;
      if (c instanceof FencedCodeBlock) {
        String code = ((FencedCodeBlock) c).getLiteral();
        part = formatCodeBlock(code);
      } else if (c instanceof IndentedCodeBlock) {
        String code = ((IndentedCodeBlock) c).getLiteral();
        part = formatCodeBlock(code);
      } else if (c instanceof BlockQuote) {
        part = formatBlockQuoteForList((BlockQuote) c);
      } else if (c instanceof TableBlock) {
        part = formatTableForList((TableBlock) c);
      } else {
        GChatCardAssembler tempVisitor = new GChatCardAssembler();
        part = tempVisitor.inline.renderInlineChildren(c).trim();
      }

      if (part.isEmpty()) continue;

      if (!first) {
        if (c instanceof Paragraph
            || c instanceof FencedCodeBlock
            || c instanceof IndentedCodeBlock
            || c instanceof BlockQuote
            || c instanceof TableBlock) {
          sb.append("\n");
        } else {
          sb.append(" ");
        }
      }
      sb.append(part);
      first = false;
    }
    return sb.toString();
  }

  private String formatTableForList(TableBlock table) {
    List<String> headers = new ArrayList<>();
    List<List<String>> bodyRows = new ArrayList<>();

    for (Node child = table.getFirstChild(); child != null; child = child.getNext()) {
      if (child instanceof TableHead) {
        for (Node row = child.getFirstChild(); row != null; row = row.getNext()) {
          if (row instanceof TableRow) {
            headers = extractTableRowCells((TableRow) row);
            break;
          }
        }
      } else if (child instanceof TableBody) {
        for (Node row = child.getFirstChild(); row != null; row = row.getNext()) {
          if (row instanceof TableRow) {
            bodyRows.add(extractTableRowCells((TableRow) row));
          }
        }
      }
    }

    if (headers.isEmpty() && bodyRows.isEmpty()) return "";

    int colCount = headers.size();
    for (List<String> row : bodyRows) colCount = Math.max(colCount, row.size());

    if (colCount == 0) return "";

    if (headers.isEmpty()) {
      headers = new ArrayList<>();
      for (int i = 0; i < colCount; i++) {
        headers.add("Column " + (i + 1));
      }
    }

    // Use nested format with extra indentation when inside a list
    return formatTableAsHtml(headers, bodyRows, colCount, 1);
  }

  private void appendList(StringBuilder sb, Node list, int indent, Integer start) {
    int index = (start == null) ? 1 : Math.max(1, start);
    for (Node liNode = list.getFirstChild(); liNode != null; liNode = liNode.getNext()) {
      if (!(liNode instanceof ListItem li)) continue;

      String itemText = renderListItemInlineOnly(li);
      if (!itemText.isEmpty()) {
        String prefix = (start == null) ? "- " : (index++) + ". ";
        sb.append("  ".repeat(indent)).append(prefix).append(itemText).append("\n");
      } else if (start != null) {
        index++;
      }

      for (Node c = li.getFirstChild(); c != null; c = c.getNext()) {
        if (c instanceof BulletList) appendList(sb, c, indent + 1, null);
        if (c instanceof OrderedList)
          appendList(sb, c, indent + 1, ((OrderedList) c).getMarkerStartNumber());
      }
    }
  }

  private static String escapeHtml(String text) {
    if (text == null) return "";
    return StringEscapeUtils.escapeHtml4(text);
  }

  private String sanitizeUrl(String url) {
    if (url == null) return "";
    try {
      java.net.URI uri = java.net.URI.create(url.trim());
      String scheme = uri.getScheme();
      if (scheme == null) return "";
      if (!java.util.Set.of("http", "https", "mailto").contains(scheme.toLowerCase())) return "";
      return url.trim();
    } catch (IllegalArgumentException ex) {
      return "";
    }
  }

  private String formatCodeBlock(String code) {
    String body = code == null ? "" : code;
    return "```\n" + escapeHtml(body) + "\n```";
  }

  private String formatBlockQuoteForList(BlockQuote blockQuote) {
    StringBuilder quotedContent = new StringBuilder();

    // Process each child of the blockquote
    // GChat doesn't support blockquote formatting, so just render as plain text
    for (Node child = blockQuote.getFirstChild(); child != null; child = child.getNext()) {
      switch (child) {
        case Paragraph paragraph -> {
          String text = inline.renderInlineChildren(child).trim();
          if (!text.isEmpty()) {
            quotedContent.append(text).append("\n");
          }
        }
        case BulletList bulletList -> {
          StringBuilder listText = new StringBuilder();
          appendList(listText, child, 0, null);
          quotedContent.append(listText);
        }
        case OrderedList orderedList -> {
          StringBuilder listText = new StringBuilder();
          appendList(listText, child, 0, orderedList.getMarkerStartNumber());
          quotedContent.append(listText);
        }
        default -> {}
      }
    }

    return quotedContent.toString().trim();
  }

  private String safeText(String s) {
    if (s == null) return "";
    return s;
  }

  private static Image getSingleImageOrNull(Paragraph p) {
    Node first = p.getFirstChild();
    if (first != null && first == p.getLastChild() && first instanceof Image) {
      return (Image) first;
    }
    return null;
  }

  private static String extractPlainText(Node node) {
    StringBuilder sb = new StringBuilder();
    extractPlainTextRecursive(node, sb);
    return sb.toString().trim();
  }

  private static void extractPlainTextRecursive(Node node, StringBuilder sb) {
    if (node instanceof Text) {
      sb.append(((Text) node).getLiteral());
    }
    for (Node child = node.getFirstChild(); child != null; child = child.getNext()) {
      extractPlainTextRecursive(child, sb);
    }
  }
}
