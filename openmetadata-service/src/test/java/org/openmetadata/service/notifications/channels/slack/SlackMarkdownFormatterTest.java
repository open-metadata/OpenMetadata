package org.openmetadata.service.notifications.channels.slack;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.commonmark.ext.gfm.strikethrough.Strikethrough;
import org.commonmark.node.BlockQuote;
import org.commonmark.node.BulletList;
import org.commonmark.node.Code;
import org.commonmark.node.Document;
import org.commonmark.node.Emphasis;
import org.commonmark.node.FencedCodeBlock;
import org.commonmark.node.HardLineBreak;
import org.commonmark.node.Heading;
import org.commonmark.node.Image;
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

class SlackMarkdownFormatterTest {

  @Test
  void renderInlineChildrenFormatsAndEscapesSupportedMarkdown() {
    SlackMarkdownFormatter formatter = new SlackMarkdownFormatter();
    Document document = buildDocument();

    String rendered = formatter.renderInlineChildren(document);

    assertTrue(rendered.contains("Escaped &lt;&amp;&gt;"));
    assertTrue(rendered.contains("_em_"));
    assertTrue(rendered.contains("*strong*"));
    assertTrue(rendered.contains("`code&lt;`"));
    assertTrue(rendered.contains("<https://example.com?q=1&v=2|ok>"));
    assertTrue(rendered.contains("bad"));
    assertTrue(rendered.contains("<https://img.example/x.png|Diagram>"));
    assertTrue(rendered.contains("fallback"));
    assertTrue(rendered.contains("~gone~"));
    assertTrue(rendered.contains("\nnext"));
    assertTrue(rendered.contains("\nafterhard"));
    assertTrue(rendered.contains("heading"));
    assertTrue(rendered.contains("quoted"));
    assertTrue(rendered.contains("bullet"));
    assertTrue(rendered.contains("ordered"));
    assertTrue(rendered.contains("```\nselect * from foo;\n```"));
    assertTrue(rendered.contains("```\nindented\n```"));
  }

  @Test
  void renderInlineChildrenResetsAccumulatorAcrossCalls() {
    SlackMarkdownFormatter formatter = new SlackMarkdownFormatter();

    formatter.renderInlineChildren(MarkdownParser.parse("first"));
    assertEquals("second", formatter.renderInlineChildren(MarkdownParser.parse("second")).trim());
  }

  private static Document buildDocument() {
    Document document = new Document();
    Paragraph paragraph = new Paragraph();
    paragraph.appendChild(new Text("Escaped <&> "));

    Emphasis emphasis = new Emphasis();
    emphasis.appendChild(new Text("em"));
    paragraph.appendChild(emphasis);
    paragraph.appendChild(new Text(" "));

    StrongEmphasis strongEmphasis = new StrongEmphasis();
    strongEmphasis.appendChild(new Text("strong"));
    paragraph.appendChild(strongEmphasis);
    paragraph.appendChild(new Text(" "));

    Code code = new Code();
    code.setLiteral("code<");
    paragraph.appendChild(code);
    paragraph.appendChild(new Text(" "));

    Link validLink = new Link();
    validLink.setDestination("https://example.com?q=1&v=2");
    validLink.appendChild(new Text("ok"));
    paragraph.appendChild(validLink);
    paragraph.appendChild(new Text(" "));

    Link invalidLink = new Link();
    invalidLink.setDestination("javascript:alert(1)");
    invalidLink.appendChild(new Text("bad"));
    paragraph.appendChild(invalidLink);
    paragraph.appendChild(new Text(" "));

    Image titledImage = new Image();
    titledImage.setDestination("https://img.example/x.png");
    titledImage.setTitle("Diagram");
    paragraph.appendChild(titledImage);
    paragraph.appendChild(new Text(" "));

    Image fallbackImage = new Image();
    fallbackImage.setDestination("javascript:alert(1)");
    fallbackImage.appendChild(new Text("fallback"));
    paragraph.appendChild(fallbackImage);
    paragraph.appendChild(new Text(" "));

    Strikethrough strikethrough = new Strikethrough("~~");
    strikethrough.appendChild(new Text("gone"));
    paragraph.appendChild(strikethrough);
    paragraph.appendChild(new SoftLineBreak());
    paragraph.appendChild(new Text("next"));
    paragraph.appendChild(new HardLineBreak());
    paragraph.appendChild(new Text("afterhard"));
    document.appendChild(paragraph);

    Heading heading = new Heading();
    heading.setLevel(2);
    heading.appendChild(new Text("heading"));
    document.appendChild(heading);

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
    fencedCodeBlock.setLiteral("select * from foo;");
    document.appendChild(fencedCodeBlock);

    IndentedCodeBlock indentedCodeBlock = new IndentedCodeBlock();
    indentedCodeBlock.setLiteral("indented");
    document.appendChild(indentedCodeBlock);

    document.appendChild(new ThematicBreak());
    return document;
  }
}
