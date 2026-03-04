package org.openmetadata.service.notifications.channels.teams;

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

final class TeamsMarkdownFormatter extends AbstractVisitor {
  private final StringBuilder out = new StringBuilder();

  String renderInlineChildren(Node parent) {
    out.setLength(0);
    for (Node n = parent.getFirstChild(); n != null; n = n.getNext()) {
      n.accept(this);
    }
    return out.toString();
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
  public void visit(Text text) {
    out.append(text.getLiteral() == null ? "" : text.getLiteral());
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
    out.append("`").append(code.getLiteral() == null ? "" : code.getLiteral()).append("`");
  }

  @Override
  public void visit(Link link) {
    String dest = link.getDestination();

    int before = out.length();
    visitChildren(link);
    String label = out.substring(before).trim();
    out.setLength(before);

    if (!isAllowedLinkUrl(dest)) {
      if (!label.isEmpty()) out.append(escapeMdLabel(label));
      return;
    }

    String labelEsc = label.isEmpty() ? escapeMdUrl(dest) : escapeMdLabel(label);
    String urlEsc = escapeMdUrl(dest);
    out.append("[").append(labelEsc).append("](").append(urlEsc).append(")");
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
  public void visit(FencedCodeBlock fencedCodeBlock) {
    String lit = fencedCodeBlock.getLiteral();
    if (lit != null && !lit.isEmpty()) {
      out.append("```\n").append(lit).append("\n```");
    }
  }

  @Override
  public void visit(IndentedCodeBlock indentedCodeBlock) {
    String lit = indentedCodeBlock.getLiteral();
    if (lit != null && !lit.isEmpty()) {
      out.append("```\n").append(lit).append("\n```");
    }
  }

  @Override
  public void visit(Paragraph paragraph) {
    visitChildren(paragraph);
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
  public void visit(ThematicBreak thematicBreak) {}

  public void visit(Strikethrough strikethrough) {
    out.append("~~");
    visitChildren(strikethrough);
    out.append("~~");
  }

  @Override
  public void visit(Heading heading) {
    visitChildren(heading);
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
}
