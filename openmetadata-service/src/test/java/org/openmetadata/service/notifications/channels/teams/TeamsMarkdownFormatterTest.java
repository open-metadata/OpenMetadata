package org.openmetadata.service.notifications.channels.teams;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.commonmark.ext.gfm.strikethrough.Strikethrough;
import org.commonmark.node.BlockQuote;
import org.commonmark.node.BulletList;
import org.commonmark.node.Code;
import org.commonmark.node.CustomNode;
import org.commonmark.node.Document;
import org.commonmark.node.Emphasis;
import org.commonmark.node.FencedCodeBlock;
import org.commonmark.node.HardLineBreak;
import org.commonmark.node.IndentedCodeBlock;
import org.commonmark.node.Link;
import org.commonmark.node.ListItem;
import org.commonmark.node.OrderedList;
import org.commonmark.node.Paragraph;
import org.commonmark.node.SoftLineBreak;
import org.commonmark.node.StrongEmphasis;
import org.commonmark.node.Text;
import org.commonmark.node.ThematicBreak;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.notifications.channels.MarkdownParser;

class TeamsMarkdownFormatterTest {

  @Test
  void renderInlineChildrenFormatsMarkdownAndEscapesUnsupportedLinks() {
    TeamsMarkdownFormatter formatter = new TeamsMarkdownFormatter();
    Document document = buildDocument();

    String rendered = formatter.renderInlineChildren(document);

    assertTrue(rendered.contains("plain"));
    assertTrue(rendered.contains("*em*"));
    assertTrue(rendered.contains("**strong**"));
    assertTrue(rendered.contains("`code`"));
    assertTrue(rendered.contains("[ok](https://example.com/a%20b)"));
    assertTrue(rendered.contains("x\\(y\\)"));
    assertTrue(rendered.contains("~~gone~~"));
    assertTrue(rendered.contains("quoted"));
    assertTrue(rendered.contains("bullet"));
    assertTrue(rendered.contains("ordered"));
    assertTrue(rendered.contains("```\ncode\n```"));
    assertTrue(rendered.contains("indented"));
  }

  @Test
  void renderInlineChildrenResetsAccumulatorAcrossCalls() {
    TeamsMarkdownFormatter formatter = new TeamsMarkdownFormatter();

    formatter.renderInlineChildren(MarkdownParser.parse("first"));
    assertEquals("second", formatter.renderInlineChildren(MarkdownParser.parse("second")).trim());
  }

  @Test
  void renderInlineChildrenHandlesBreaksHeadingsAndMalformedUrls() {
    TeamsMarkdownFormatter formatter = new TeamsMarkdownFormatter();
    Document document = new Document();

    Paragraph paragraph = new Paragraph();
    CustomNode customNode = new CustomNode() {};
    customNode.appendChild(new Text("wrapped"));
    paragraph.appendChild(customNode);
    paragraph.appendChild(new SoftLineBreak());
    paragraph.appendChild(new Text("soft"));
    paragraph.appendChild(new HardLineBreak());
    paragraph.appendChild(new Text("hard "));

    Link malformedLink = new Link();
    malformedLink.setDestination("https://example.com/%zz");
    malformedLink.appendChild(new Text("x(y)"));
    paragraph.appendChild(malformedLink);
    document.appendChild(paragraph);

    org.commonmark.node.Heading heading = new org.commonmark.node.Heading();
    heading.setLevel(3);
    heading.appendChild(new Text("heading"));
    document.appendChild(heading);

    String rendered = formatter.renderInlineChildren(document);

    assertTrue(rendered.contains("wrapped\nsoft\nhard x\\(y\\)"));
    assertTrue(rendered.contains("heading"));
  }

  private static Document buildDocument() {
    Document document = new Document();
    Paragraph paragraph = new Paragraph();
    paragraph.appendChild(new Text("plain "));

    Emphasis emphasis = new Emphasis();
    emphasis.appendChild(new Text("em"));
    paragraph.appendChild(emphasis);
    paragraph.appendChild(new Text(" "));

    StrongEmphasis strongEmphasis = new StrongEmphasis();
    strongEmphasis.appendChild(new Text("strong"));
    paragraph.appendChild(strongEmphasis);
    paragraph.appendChild(new Text(" "));

    Code code = new Code();
    code.setLiteral("code");
    paragraph.appendChild(code);
    paragraph.appendChild(new Text(" "));

    Link validLink = new Link();
    validLink.setDestination("https://example.com/a b");
    validLink.appendChild(new Text("ok"));
    paragraph.appendChild(validLink);
    paragraph.appendChild(new Text(" "));

    Link invalidLink = new Link();
    invalidLink.setDestination("javascript:alert(1)");
    invalidLink.appendChild(new Text("x(y)"));
    paragraph.appendChild(invalidLink);
    paragraph.appendChild(new Text(" "));

    Strikethrough strikethrough = new Strikethrough("~~");
    strikethrough.appendChild(new Text("gone"));
    paragraph.appendChild(strikethrough);
    document.appendChild(paragraph);

    BlockQuote blockQuote = new BlockQuote();
    Paragraph quoteParagraph = new Paragraph();
    quoteParagraph.appendChild(new Text("quoted"));
    blockQuote.appendChild(quoteParagraph);
    document.appendChild(blockQuote);

    BulletList bulletList = new BulletList();
    ListItem bulletItem = new ListItem();
    Paragraph bulletParagraph = new Paragraph();
    bulletParagraph.appendChild(new Text("bullet"));
    bulletItem.appendChild(bulletParagraph);
    bulletList.appendChild(bulletItem);
    document.appendChild(bulletList);

    OrderedList orderedList = new OrderedList();
    ListItem orderedItem = new ListItem();
    Paragraph orderedParagraph = new Paragraph();
    orderedParagraph.appendChild(new Text("ordered"));
    orderedItem.appendChild(orderedParagraph);
    orderedList.appendChild(orderedItem);
    document.appendChild(orderedList);

    FencedCodeBlock fencedCodeBlock = new FencedCodeBlock();
    fencedCodeBlock.setLiteral("code");
    document.appendChild(fencedCodeBlock);

    IndentedCodeBlock indentedCodeBlock = new IndentedCodeBlock();
    indentedCodeBlock.setLiteral("indented");
    document.appendChild(indentedCodeBlock);

    document.appendChild(new ThematicBreak());
    return document;
  }
}
