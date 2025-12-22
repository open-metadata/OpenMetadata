package org.openmetadata.service.notifications.channels.gchat;

import org.apache.commons.text.StringEscapeUtils;
import org.commonmark.ext.gfm.strikethrough.Strikethrough;
import org.commonmark.node.AbstractVisitor;
import org.commonmark.node.BlockQuote;
import org.commonmark.node.BulletList;
import org.commonmark.node.Code;
import org.commonmark.node.CustomNode;
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
import org.commonmark.node.SoftLineBreak;
import org.commonmark.node.StrongEmphasis;
import org.commonmark.node.Text;
import org.commonmark.node.ThematicBreak;

final class GChatMarkdownFormatter extends AbstractVisitor {
  private final StringBuilder out = new StringBuilder();

  @Override
  public void visit(CustomNode node) {
    if (node instanceof Strikethrough) {
      visit((Strikethrough) node);
    } else {
      super.visit(node);
    }
  }

  String renderInlineChildren(Node parent) {
    out.setLength(0);
    for (Node n = parent.getFirstChild(); n != null; n = n.getNext()) {
      n.accept(this);
    }
    return safeText(out.toString());
  }

  @Override
  public void visit(Text text) {
    out.append(escapeHtml(text.getLiteral()));
  }

  @Override
  public void visit(Emphasis emphasis) {
    out.append("*");
    visitChildren(emphasis);
    out.append("*");
  }

  @Override
  public void visit(StrongEmphasis strong) {
    out.append("**");
    visitChildren(strong);
    out.append("**");
  }

  @Override
  public void visit(Code code) {
    out.append("`").append(escapeHtml(code.getLiteral())).append("`");
  }

  @Override
  public void visit(Link link) {
    String dest = sanitizeUrl(link.getDestination());

    int before = out.length();
    visitChildren(link);
    String label = out.substring(before).trim();
    out.setLength(before);

    if (dest.isEmpty()) {
      out.append(label);
      return;
    }
    if (label.isEmpty()) {
      label = escapeHtml(dest);
    }
    out.append("[").append(label).append("](").append(escapeHtml(dest)).append(")");
  }

  @Override
  public void visit(SoftLineBreak softLineBreak) {
    out.append("\n");
  }

  @Override
  public void visit(HardLineBreak hardLineBreak) {
    out.append("\n");
  }

  @Override
  public void visit(Image image) {
    GChatMarkdownFormatter tmp = new GChatMarkdownFormatter();
    String alt = tmp.renderInlineChildren(image).trim();
    if (alt.isEmpty()) alt = extractPlainText(image);
    if (alt.isEmpty()) alt = "Image";
    String url = sanitizeUrl(image.getDestination());
    if (!url.isEmpty()) {
      out.append("[").append(escapeHtml(alt)).append("](").append(escapeHtml(url)).append(")");
    } else {
      out.append(escapeHtml(alt));
    }
  }

  @Override
  public void visit(Heading heading) {
    visitChildren(heading);
  }

  @Override
  public void visit(BlockQuote blockQuote) {
    visitChildren(blockQuote);
  }

  @Override
  public void visit(BulletList bulletList) {
    visitChildren(bulletList);
  }

  @Override
  public void visit(OrderedList orderedList) {
    visitChildren(orderedList);
  }

  @Override
  public void visit(ListItem listItem) {
    visitChildren(listItem);
  }

  @Override
  public void visit(FencedCodeBlock fencedCodeBlock) {
    out.append("```\n").append(escapeHtml(fencedCodeBlock.getLiteral())).append("\n```");
  }

  @Override
  public void visit(IndentedCodeBlock indentedCodeBlock) {
    out.append("```\n").append(escapeHtml(indentedCodeBlock.getLiteral())).append("\n```");
  }

  @Override
  public void visit(ThematicBreak thematicBreak) {}

  public void visit(Strikethrough strikethrough) {
    out.append("~~");
    visitChildren(strikethrough);
    out.append("~~\u200B"); // Add zero-width space to prevent GChat from collapsing spaces
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

  private String safeText(String s) {
    if (s == null) return "";
    return s;
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
