package org.openmetadata.service.notifications.channels.slack;

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

final class SlackMarkdownFormatter extends AbstractVisitor {
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
    return out.toString();
  }

  @Override
  public void visit(Text text) {
    out.append(escapeMrkdwn(text.getLiteral()));
  }

  @Override
  public void visit(Emphasis emphasis) {
    out.append("_");
    visitChildren(emphasis);
    out.append("_");
  }

  @Override
  public void visit(StrongEmphasis strong) {
    out.append("*");
    visitChildren(strong);
    out.append("*");
  }

  @Override
  public void visit(Code code) {
    out.append("`").append(escapeMrkdwn(code.getLiteral())).append("`");
  }

  @Override
  public void visit(Link link) {
    String dest = link.getDestination();

    int before = out.length();
    visitChildren(link);
    String label = out.substring(before).trim();
    out.setLength(before);

    if (!isAllowedScheme(dest)) {
      if (!label.isEmpty()) out.append(escapeMrkdwn(label));
      return;
    }
    String url = dest == null ? "" : dest.trim();
    String linkLabel = label.isEmpty() ? url : label;
    out.append("<").append(url).append("|").append(linkLabel).append(">");
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
    String alt = renderInlineChildren(image).trim();
    if (alt.isEmpty()) {
      String title = image.getTitle();
      alt = title == null ? "" : title;
    }
    String url = image.getDestination();
    if (isAllowedScheme(url)) {
      String urlEsc = escapeMrkdwn(url.trim());
      String labelEsc = alt.isEmpty() ? urlEsc : escapeMrkdwn(alt);
      out.append("<").append(urlEsc).append("|").append(labelEsc).append(">");
    } else if (!alt.isEmpty()) {
      out.append(escapeMrkdwn(alt));
    }
  }

  @Override
  public void visit(Heading h) {
    visitChildren(h);
  }

  @Override
  public void visit(BlockQuote bq) {
    visitChildren(bq);
  }

  @Override
  public void visit(BulletList bl) {
    visitChildren(bl);
  }

  @Override
  public void visit(OrderedList ol) {
    visitChildren(ol);
  }

  @Override
  public void visit(ListItem li) {
    visitChildren(li);
  }

  @Override
  public void visit(FencedCodeBlock cb) {
    String lit = cb.getLiteral();
    if (lit != null && !lit.isEmpty()) {
      out.append("```\n").append(escapeMrkdwn(lit)).append("\n```");
    }
  }

  @Override
  public void visit(IndentedCodeBlock cb) {
    String lit = cb.getLiteral();
    if (lit != null && !lit.isEmpty()) {
      out.append("```\n").append(escapeMrkdwn(lit)).append("\n```");
    }
  }

  @Override
  public void visit(ThematicBreak tb) {}

  public void visit(Strikethrough strikethrough) {
    out.append("~");
    visitChildren(strikethrough);
    out.append("~");
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
}
