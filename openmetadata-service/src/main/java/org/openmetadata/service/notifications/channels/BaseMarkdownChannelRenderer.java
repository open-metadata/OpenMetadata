package org.openmetadata.service.notifications.channels;

import org.commonmark.ext.gfm.strikethrough.Strikethrough;
import org.commonmark.node.AbstractVisitor;
import org.commonmark.node.BlockQuote;
import org.commonmark.node.Code;
import org.commonmark.node.Emphasis;
import org.commonmark.node.HardLineBreak;
import org.commonmark.node.Heading;
import org.commonmark.node.Image;
import org.commonmark.node.Link;
import org.commonmark.node.Node;
import org.commonmark.node.Paragraph;
import org.commonmark.node.SoftLineBreak;
import org.commonmark.node.StrongEmphasis;
import org.commonmark.node.Text;

public abstract class BaseMarkdownChannelRenderer<T extends NotificationMessage>
    implements ChannelRenderer {

  private final TemplateFormatAdapter adapter;

  protected BaseMarkdownChannelRenderer(TemplateFormatAdapter adapter) {
    this.adapter = adapter;
  }

  @Override
  public final NotificationMessage render(String templateContent, String templateSubject) {
    if (templateContent == null) {
      throw new IllegalArgumentException("Template content cannot be null");
    }

    // Adapt template format (HTML→MD)
    String markdownContent = adapter.adapt(templateContent);
    String markdownSubject = null;
    if (templateSubject != null) {
      markdownSubject = adapter.adapt(templateSubject);
    }

    // Parse markdown to AST using CommonMark
    Node document = MarkdownParser.parse(markdownContent);
    Node subjectNode = null;
    if (markdownSubject != null) {
      subjectNode = MarkdownParser.parse(markdownSubject);
    }

    // Delegate to the implementation-specific rendering
    return doRender(document, subjectNode);
  }

  protected abstract NotificationMessage doRender(Node document, Node subjectNode);

  protected String extractPlainText(Node node) {
    PlainTextExtractor extractor = new PlainTextExtractor();
    node.accept(extractor);
    return extractor.getText();
  }

  private static class PlainTextExtractor extends AbstractVisitor {
    private final StringBuilder text = new StringBuilder();

    @Override
    public void visit(Text textNode) {
      text.append(textNode.getLiteral());
    }

    @Override
    public void visit(SoftLineBreak softLineBreak) {
      text.append(" ");
    }

    @Override
    public void visit(HardLineBreak hardLineBreak) {
      text.append("\n");
    }

    @Override
    public void visit(Code code) {
      text.append(code.getLiteral());
    }

    @Override
    public void visit(Link link) {
      visitChildren(link);
    }

    @Override
    public void visit(Image image) {
      int before = text.length();
      visitChildren(image);
      if (text.length() == before) {
        String title = image.getTitle();
        if (title != null && !title.isEmpty()) {
          text.append(title);
        }
      }
    }

    @Override
    public void visit(Emphasis emphasis) {
      visitChildren(emphasis);
    }

    @Override
    public void visit(StrongEmphasis strongEmphasis) {
      visitChildren(strongEmphasis);
    }

    public void visit(Strikethrough strikethrough) {
      visitChildren(strikethrough);
    }

    @Override
    public void visit(Paragraph paragraph) {
      visitChildren(paragraph);
      if (paragraph.getNext() != null) {
        text.append("\n\n");
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

    public String getText() {
      return text.toString().trim();
    }
  }
}
