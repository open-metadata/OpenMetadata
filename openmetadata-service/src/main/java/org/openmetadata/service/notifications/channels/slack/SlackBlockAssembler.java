package org.openmetadata.service.notifications.channels.slack;

import com.slack.api.model.block.DividerBlock;
import com.slack.api.model.block.HeaderBlock;
import com.slack.api.model.block.ImageBlock;
import com.slack.api.model.block.LayoutBlock;
import com.slack.api.model.block.SectionBlock;
import com.slack.api.model.block.composition.MarkdownTextObject;
import com.slack.api.model.block.composition.PlainTextObject;
import java.util.ArrayList;
import java.util.List;
import org.commonmark.ext.gfm.strikethrough.Strikethrough;
import org.commonmark.node.AbstractVisitor;
import org.commonmark.node.BlockQuote;
import org.commonmark.node.BulletList;
import org.commonmark.node.Code;
import org.commonmark.node.CustomNode;
import org.commonmark.node.Document;
import org.commonmark.node.Emphasis;
import org.commonmark.node.FencedCodeBlock;
import org.commonmark.node.HardLineBreak;
import org.commonmark.node.Heading;
import org.commonmark.node.Image;
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

final class SlackBlockAssembler extends AbstractVisitor {
  private static final int SLACK_MAX_TEXT_LENGTH = 3000;

  List<LayoutBlock> blocks = new ArrayList<>();
  StringBuilder currentText = new StringBuilder();
  private final SlackMarkdownFormatter inline = new SlackMarkdownFormatter();

  @Override
  public void visit(CustomNode node) {
    if (node instanceof Strikethrough) {
      visit((Strikethrough) node);
    } else {
      super.visit(node);
    }
  }

  @Override
  public void visit(Document document) {
    visitChildren(document);
    flushCurrentText();
  }

  @Override
  public void visit(Heading heading) {
    flushCurrentText();
    String text = inline.renderInlineChildren(heading).trim();
    if (!text.isEmpty()) {
      if (heading.getLevel() == 1) {
        blocks.add(createHeaderBlock(text));
      } else {
        blocks.add(createSectionBlock("*" + escapeMrkdwn(text) + "*"));
      }
    }
  }

  @Override
  public void visit(Paragraph paragraph) {
    visitChildren(paragraph);
    flushCurrentText();
  }

  @Override
  public void visit(Text text) {
    currentText.append(escapeMrkdwn(text.getLiteral()));
  }

  @Override
  public void visit(Emphasis emphasis) {
    currentText.append("_");
    visitChildren(emphasis);
    currentText.append("_");
  }

  @Override
  public void visit(StrongEmphasis strong) {
    currentText.append("*");
    visitChildren(strong);
    currentText.append("*");
  }

  @Override
  public void visit(Code code) {
    currentText.append("`").append(escapeMrkdwn(code.getLiteral())).append("`");
  }

  @Override
  public void visit(Link link) {
    String dest = link.getDestination();

    int before = currentText.length();
    visitChildren(link);
    String label = currentText.substring(before).trim();
    currentText.setLength(before);

    if (!isAllowedScheme(dest)) {
      if (!label.isEmpty()) currentText.append(escapeMrkdwn(label));
      return;
    }

    String url = dest == null ? "" : dest.trim();
    String linkLabel = label.isEmpty() ? url : label;
    currentText.append("<").append(url).append("|").append(linkLabel).append(">");
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
      blocks.add(createSectionBlock(quoted));
    }
  }

  @Override
  public void visit(BulletList bulletList) {
    flushCurrentText();
    StringBuilder listBuf = new StringBuilder();
    appendList(listBuf, bulletList, 0, null);
    String s = listBuf.toString().trim();
    if (!s.isEmpty()) blocks.add(createSectionBlock(s));
  }

  @Override
  public void visit(OrderedList orderedList) {
    flushCurrentText();
    StringBuilder listBuf = new StringBuilder();
    appendList(listBuf, orderedList, 0, orderedList.getMarkerStartNumber());
    String s = listBuf.toString().trim();
    if (!s.isEmpty()) blocks.add(createSectionBlock(s));
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
      blocks.add(createCodeBlock(code));
    }
  }

  @Override
  public void visit(IndentedCodeBlock codeBlock) {
    flushCurrentText();
    String code = codeBlock.getLiteral();
    if (code != null && !code.isEmpty()) {
      blocks.add(createCodeBlock(code));
    }
  }

  @Override
  public void visit(ThematicBreak thematicBreak) {
    flushCurrentText();
    blocks.add(createDividerBlock());
  }

  @Override
  public void visit(SoftLineBreak softLineBreak) {
    currentText.append("\n");
  }

  @Override
  public void visit(HardLineBreak hardLineBreak) {
    currentText.append("\n");
  }

  @Override
  public void visit(Image image) {
    flushCurrentText();
    String altFromChildren = inline.renderInlineChildren(image).trim();
    String title = image.getTitle();
    String alt = !altFromChildren.isEmpty() ? altFromChildren : (title == null ? "" : title);

    String url = image.getDestination();
    if (isAllowedScheme(url)) {
      blocks.add(
          ImageBlock.builder()
              .imageUrl(url.trim())
              .altText(alt.isEmpty() ? "image" : escapeMrkdwn(alt))
              .build());
    } else if (!alt.isEmpty()) {
      blocks.add(createSectionBlock(escapeMrkdwn(alt)));
    }
  }

  public void visit(Strikethrough strikethrough) {
    currentText.append("~");
    visitChildren(strikethrough);
    currentText.append("~");
  }

  void flushCurrentText() {
    if (!currentText.isEmpty()) {
      String text = currentText.toString().trim();
      if (!text.isEmpty()) {
        blocks.add(createSectionBlock(text));
      }
      currentText.setLength(0);
    }
  }

  LayoutBlock createHeaderBlock(String text) {
    String plain = truncateContent(escapeMrkdwn(text), 150);
    return HeaderBlock.builder().text(PlainTextObject.builder().text(plain).build()).build();
  }

  LayoutBlock createSectionBlock(String text) {
    String truncated = truncateContent(text, SLACK_MAX_TEXT_LENGTH);
    return SectionBlock.builder()
        .text(MarkdownTextObject.builder().text(truncated).build())
        .build();
  }

  private LayoutBlock createCodeBlock(String code) {
    String body = code == null ? "" : code;
    int fenceOverhead = 7;
    int budget = Math.max(0, SLACK_MAX_TEXT_LENGTH - fenceOverhead);
    String truncated =
        body.length() <= budget ? body : body.substring(0, Math.max(0, budget - 1)) + "…";
    String fenced = "```\n" + escapeMrkdwn(truncated) + "\n```";
    return SectionBlock.builder().text(MarkdownTextObject.builder().text(fenced).build()).build();
  }

  private LayoutBlock createDividerBlock() {
    return DividerBlock.builder().build();
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
        SlackBlockAssembler tempVisitor = new SlackBlockAssembler();
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
    int fenceOverhead = 7;
    int budget = Math.max(0, SLACK_MAX_TEXT_LENGTH - fenceOverhead);
    String truncated =
        body.length() <= budget ? body : body.substring(0, Math.max(0, budget - 1)) + "…";
    return "```\n" + escapeMrkdwn(truncated) + "\n```";
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

      if (start == null) {
        if (!row.isEmpty()) {
          // Use different bullets and visible indentation for nested lists
          String bullet = getBulletForLevel(indent);
          String prefix = getIndentPrefix(indent) + bullet + " ";
          out.append(prefix).append(row).append("\n");
        }
      } else {
        if (!row.isEmpty()) {
          String prefix = getIndentPrefix(indent) + index + ". ";
          out.append(prefix).append(row).append("\n");
        }
        index++;
      }

      for (Node c = li.getFirstChild(); c != null; c = c.getNext()) {
        if (c instanceof BulletList) appendList(out, c, indent + 1, null);
        if (c instanceof OrderedList)
          appendList(out, c, indent + 1, ((OrderedList) c).getMarkerStartNumber());
      }
    }
  }

  private String getBulletForLevel(int level) {
    // Use different bullet characters for different nesting levels
    // Slack doesn't support space indentation well, so visual differentiation helps
    return switch (level) {
      case 0 -> "•";
      case 1 -> "◦";
      default -> "▪";
    };
  }

  private String getIndentPrefix(int level) {
    // Use em-space (U+2003) which Slack doesn't collapse like regular spaces
    // Alternatively, use zero-width space + regular space combination
    if (level == 0) return "";
    // Use 2 em-spaces per indent level for visual separation
    return "\u2003\u2003".repeat(level);
  }

  private static String escapeMrkdwn(String s) {
    if (s == null || s.isEmpty()) return "";
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
  }

  private static boolean isAllowedScheme(String url) {
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

  private String truncateContent(String content, int maxLength) {
    if (content.length() <= maxLength) {
      return content;
    }
    return content.substring(0, maxLength - 3) + "…";
  }
}
