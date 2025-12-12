package org.openmetadata.service.notifications.channels.teams;

import java.util.ArrayList;
import java.util.List;
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
  private static final int TEAMS_MAX_TEXT_LENGTH = 5000;

  List<TeamsMessage.BodyItem> body = new ArrayList<>();
  StringBuilder currentText = new StringBuilder();
  boolean inParagraph = false;
  boolean inList = false;
  private final TeamsMarkdownFormatter inline = new TeamsMarkdownFormatter();

  @Override
  public void visit(Document document) {
    visitChildren(document);
    flushCurrentText();
  }

  @Override
  public void visit(CustomNode node) {
    if (node instanceof Strikethrough) {
      visit((Strikethrough) node);
    } else {
      super.visit(node);
    }
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
  public void visit(Heading heading) {
    flushCurrentText();
    String text = inline.renderInlineChildren(heading).trim();
    int size = Math.max(1, Math.min(4, heading.getLevel()));
    if (!text.isEmpty()) {
      body.add(createTextBlock(text, "heading", size, true));
    }
  }

  @Override
  public void visit(Paragraph paragraph) {
    if (!inList) {
      flushCurrentText();
    }
    inParagraph = true;
    String text = inline.renderInlineChildren(paragraph);
    if (!text.trim().isEmpty()) {
      currentText.append(text);
    }
    inParagraph = false;
    if (!inList) {
      flushCurrentText();
    }
  }

  @Override
  public void visit(Text text) {
    String literal = text.getLiteral();
    currentText.append(literal == null ? "" : literal);
  }

  @Override
  public void visit(Emphasis emphasis) {
    currentText.append("*");
    visitChildren(emphasis);
    currentText.append("*");
  }

  @Override
  public void visit(StrongEmphasis strong) {
    currentText.append("**");
    visitChildren(strong);
    currentText.append("**");
  }

  @Override
  public void visit(Code code) {
    String lit = code.getLiteral();
    currentText.append("`").append(lit == null ? "" : lit).append("`");
  }

  @Override
  public void visit(Link link) {
    String dest = link.getDestination();

    int before = currentText.length();
    visitChildren(link);
    String label = currentText.substring(before).trim();
    currentText.setLength(before);

    if (!isAllowedLinkUrl(dest)) {
      if (!label.isEmpty()) currentText.append(escapeMdLabel(label));
      return;
    }

    String labelEsc = label.isEmpty() ? escapeMdUrl(dest) : escapeMdLabel(label);
    String urlEsc = escapeMdUrl(dest);
    currentText.append("[").append(labelEsc).append("](").append(urlEsc).append(")");
  }

  @Override
  public void visit(BlockQuote blockQuote) {
    flushCurrentText();

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
      TeamsMessage.TextBlock textBlock = createTextBlock(quoted, null, 0, false);
      TeamsMessage.Container quoteContainer =
          TeamsMessage.Container.builder()
              .type("Container")
              .style("emphasis")
              .items(List.of(textBlock))
              .build();
      body.add(quoteContainer);
    }
  }

  @Override
  public void visit(BulletList bulletList) {
    flushCurrentText();
    inList = true;
    StringBuilder listText = new StringBuilder();
    appendList(listText, bulletList, 0, null);
    String out = listText.toString().trim();
    if (!out.isEmpty()) {
      body.add(createTextBlock(out, null, 0, false));
    }
    inList = false;
  }

  @Override
  public void visit(OrderedList orderedList) {
    flushCurrentText();
    inList = true;
    StringBuilder listText = new StringBuilder();
    appendList(listText, orderedList, 0, orderedList.getMarkerStartNumber());
    String out = listText.toString().trim();
    if (!out.isEmpty()) {
      body.add(createTextBlock(out, null, 0, false));
    }
    inList = false;
  }

  @Override
  public void visit(ListItem listItem) {
    visitChildren(listItem);
  }

  @Override
  public void visit(FencedCodeBlock codeBlock) {
    flushCurrentText();
    String code = codeBlock.getLiteral();
    if (code != null && !code.isEmpty()) {
      TeamsMessage.TextBlock textBlock =
          TeamsMessage.TextBlock.builder()
              .type("TextBlock")
              .text(truncateContent(code))
              .wrap(true)
              .fontType("Monospace")
              .separator(true)
              .build();
      body.add(textBlock);
    }
  }

  @Override
  public void visit(IndentedCodeBlock codeBlock) {
    flushCurrentText();
    String code = codeBlock.getLiteral();
    if (code != null && !code.isEmpty()) {
      TeamsMessage.TextBlock textBlock =
          TeamsMessage.TextBlock.builder()
              .type("TextBlock")
              .text(truncateContent(code))
              .wrap(true)
              .fontType("Monospace")
              .separator(true)
              .build();
      body.add(textBlock);
    }
  }

  @Override
  public void visit(ThematicBreak thematicBreak) {
    flushCurrentText();
    TeamsMessage.TextBlock separator =
        TeamsMessage.TextBlock.builder()
            .type("TextBlock")
            .text("")
            .wrap(false)
            .separator(true)
            .build();
    body.add(separator);
  }

  @Override
  public void visit(SoftLineBreak softLineBreak) {
    currentText.append("\n");
  }

  @Override
  public void visit(HardLineBreak hardLineBreak) {
    currentText.append("\n");
  }

  public void visit(Strikethrough strikethrough) {
    currentText.append("~~");
    visitChildren(strikethrough);
    currentText.append("~~");
  }

  private void visitTable(TableBlock table) {
    flushCurrentText();

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

    int rowNum = 0;
    for (List<String> row : bodyRows) {
      if (rowNum > 0) {
        body.add(
            TeamsMessage.TextBlock.builder()
                .type("TextBlock")
                .text("")
                .wrap(false)
                .separator(true)
                .build());
      }

      body.add(
          TeamsMessage.TextBlock.builder()
              .type("TextBlock")
              .text("**Row " + (rowNum + 1) + "**")
              .wrap(true)
              .weight("Bolder")
              .build());

      List<TeamsMessage.Fact> facts = new ArrayList<>();
      for (int i = 0; i < colCount; i++) {
        String header = i < headers.size() ? headers.get(i) : "Column " + (i + 1);
        String value = i < row.size() ? row.get(i) : "";
        facts.add(TeamsMessage.Fact.builder().title(header).value(value).build());
      }

      body.add(TeamsMessage.FactSet.builder().type("FactSet").facts(facts).build());
      rowNum++;
    }
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

  void flushCurrentText() {
    if (!currentText.isEmpty()) {
      String text = currentText.toString().trim();
      if (!text.isEmpty()) {
        // Split on newlines to create separate TextBlocks for line breaks
        String[] lines = text.split("\\n+");
        for (String line : lines) {
          String trimmed = line.trim();
          if (!trimmed.isEmpty()) {
            body.add(createTextBlock(trimmed, null, 0, false));
          }
        }
      }
      currentText.setLength(0);
    }
  }

  TeamsMessage.TextBlock createTextBlock(String text, String style, int size, boolean isSubtle) {
    TeamsMessage.TextBlock.TextBlockBuilder builder =
        TeamsMessage.TextBlock.builder()
            .type("TextBlock")
            .text(truncateContent(text == null ? "" : text))
            .wrap(true);

    if ("heading".equals(style)) {
      switch (size) {
        case 1:
          builder.size("ExtraLarge").weight("Bolder");
          break;
        case 2:
          builder.size("Large").weight("Bolder");
          break;
        case 3:
          builder.size("Medium").weight("Bolder");
          break;
        default:
          builder.size("Default").weight("Bolder");
      }
    }

    return builder.build();
  }

  private String renderListItemInlineOnly(ListItem li) {
    StringBuilder sb = new StringBuilder();
    boolean first = true;
    for (Node c = li.getFirstChild(); c != null; c = c.getNext()) {
      if (c instanceof BulletList || c instanceof OrderedList) continue;

      String part;
      if (c instanceof FencedCodeBlock) {
        String code = ((FencedCodeBlock) c).getLiteral();
        part = formatCodeForList(code);
      } else if (c instanceof IndentedCodeBlock) {
        String code = ((IndentedCodeBlock) c).getLiteral();
        part = formatCodeForList(code);
      } else if (c instanceof BlockQuote) {
        part = formatBlockQuoteForList((BlockQuote) c);
      } else {
        TeamsCardAssembler tempVisitor = new TeamsCardAssembler();
        part = tempVisitor.inline.renderInlineChildren(c).trim();
      }

      if (part.isEmpty()) continue;

      if (!first) {
        if (c instanceof Paragraph
            || c instanceof FencedCodeBlock
            || c instanceof IndentedCodeBlock
            || c instanceof BlockQuote) {
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

  private String formatCodeForList(String code) {
    String body = code == null ? "" : code;
    return truncateContent(body);
  }

  private String formatBlockQuoteForList(BlockQuote blockQuote) {
    StringBuilder quotedContent = new StringBuilder();

    // Process each child of the blockquote
    for (Node child = blockQuote.getFirstChild(); child != null; child = child.getNext()) {
      switch (child) {
        case Paragraph paragraph -> {
          String text = inline.renderInlineChildren(child).trim();
          if (!text.isEmpty()) {
            quotedContent.append("> ").append(text).append("\n");
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
        }
        default -> {}
      }
    }

    return quotedContent.toString().trim();
  }

  private void appendList(StringBuilder out, Node list, int indent, Integer start) {
    int index = (start == null) ? 1 : Math.max(1, start);
    for (Node liNode = list.getFirstChild(); liNode != null; liNode = liNode.getNext()) {
      if (!(liNode instanceof ListItem li)) continue;

      String row = renderListItemInlineOnly(li);
      String pad = "  ".repeat(indent);

      if (start == null) {
        if (!row.isEmpty()) out.append(pad).append("- ").append(row).append("\n");
      } else {
        if (!row.isEmpty()) out.append(pad).append(index).append(". ").append(row).append("\n");
        index++;
      }

      for (Node c = li.getFirstChild(); c != null; c = c.getNext()) {
        if (c instanceof BulletList) appendList(out, c, indent + 1, null);
        if (c instanceof OrderedList)
          appendList(out, c, indent + 1, ((OrderedList) c).getMarkerStartNumber());
      }
    }
  }

  private static boolean isAllowedLinkUrl(String url) {
    try {
      if (url == null) return false;
      java.net.URI u = java.net.URI.create(url.trim());
      String s = u.getScheme();
      return s != null
          && (s.equalsIgnoreCase("http")
              || s.equalsIgnoreCase("https")
              || s.equalsIgnoreCase("mailto"));
    } catch (IllegalArgumentException ex) {
      return false;
    }
  }

  private static String escapeMdLabel(String s) {
    if (s == null || s.isEmpty()) return "";
    return s.replace("[", "\\[").replace("]", "\\]").replace("(", "\\(").replace(")", "\\)");
  }

  private static String escapeMdUrl(String s) {
    if (s == null || s.isEmpty()) return "";
    return s.trim().replace(" ", "%20").replace(")", "%29").replace("(", "%28");
  }

  private String truncateContent(String content) {
    if (content.length() <= TeamsCardAssembler.TEAMS_MAX_TEXT_LENGTH) {
      return content;
    }
    return content.substring(0, TeamsCardAssembler.TEAMS_MAX_TEXT_LENGTH - 3) + "…";
  }
}
