package org.openmetadata.service.notifications.channels.slack;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.slack.api.model.block.DividerBlock;
import com.slack.api.model.block.HeaderBlock;
import com.slack.api.model.block.ImageBlock;
import com.slack.api.model.block.LayoutBlock;
import com.slack.api.model.block.SectionBlock;
import java.util.List;
import org.commonmark.ext.gfm.strikethrough.Strikethrough;
import org.commonmark.ext.gfm.tables.TableBlock;
import org.commonmark.ext.gfm.tables.TableBody;
import org.commonmark.ext.gfm.tables.TableCell;
import org.commonmark.ext.gfm.tables.TableHead;
import org.commonmark.ext.gfm.tables.TableRow;
import org.commonmark.node.BlockQuote;
import org.commonmark.node.BulletList;
import org.commonmark.node.Code;
import org.commonmark.node.CustomBlock;
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
import org.junit.jupiter.api.Test;
import org.openmetadata.service.notifications.channels.MarkdownParser;

class SlackBlockAssemblerTest {

  @Test
  void visitDocumentBuildsBlocksForMarkdownSections() {
    SlackBlockAssembler assembler = new SlackBlockAssembler();

    MarkdownParser.parse(
            "# Title\n\n"
                + "## Details\n\n"
                + "Paragraph with tag and [docs](https://example.com)\n\n"
                + "> quoted line\n\n"
                + "- first\n"
                + "  - nested\n\n"
                + "1. ordered\n\n"
                + "```sql\nselect * from foo;\n```\n\n"
                + "![](https://img.example/x.png \"Diagram\")\n\n"
                + "![fallback](javascript:alert(1))\n\n"
                + "---")
        .accept(assembler);
    assembler.flushCurrentText();

    List<LayoutBlock> blocks = assembler.blocks;
    assertEquals(10, blocks.size());

    HeaderBlock headerBlock = assertInstanceOf(HeaderBlock.class, blocks.get(0));
    assertEquals("Title", headerBlock.getText().getText());

    SectionBlock detailBlock = assertInstanceOf(SectionBlock.class, blocks.get(1));
    assertEquals("*Details*", detailBlock.getText().getText());

    SectionBlock paragraphBlock = assertInstanceOf(SectionBlock.class, blocks.get(2));
    assertTrue(
        paragraphBlock
            .getText()
            .getText()
            .contains("Paragraph with tag and <https://example.com|docs>"));

    SectionBlock quoteBlock = assertInstanceOf(SectionBlock.class, blocks.get(3));
    assertTrue(quoteBlock.getText().getText().contains("> quoted line"));

    SectionBlock bulletBlock = assertInstanceOf(SectionBlock.class, blocks.get(4));
    assertTrue(bulletBlock.getText().getText().contains("• first"));
    assertTrue(bulletBlock.getText().getText().contains("◦ nested"));

    SectionBlock orderedBlock = assertInstanceOf(SectionBlock.class, blocks.get(5));
    assertTrue(orderedBlock.getText().getText().contains("1. ordered"));

    SectionBlock codeBlock = assertInstanceOf(SectionBlock.class, blocks.get(6));
    assertTrue(codeBlock.getText().getText().contains("select * from foo;"));

    ImageBlock imageBlock = assertInstanceOf(ImageBlock.class, blocks.get(7));
    assertEquals("https://img.example/x.png", imageBlock.getImageUrl());
    assertEquals("Diagram", imageBlock.getAltText());

    SectionBlock fallbackImageBlock = assertInstanceOf(SectionBlock.class, blocks.get(8));
    assertEquals("fallback", fallbackImageBlock.getText().getText());

    assertInstanceOf(DividerBlock.class, blocks.get(9));
  }

  @Test
  void visitDocumentCreatesTableAttachmentAndFormatsNestedTableContentInLists() {
    SlackBlockAssembler assembler = new SlackBlockAssembler();
    Document document = new Document();
    document.appendChild(createTable("Name", "Value", "foo", "bar"));

    BulletList bulletList = new BulletList();
    ListItem listItem = new ListItem();
    Paragraph paragraph = new Paragraph();
    paragraph.appendChild(new Text("Item"));
    listItem.appendChild(paragraph);

    FencedCodeBlock fencedCodeBlock = new FencedCodeBlock();
    fencedCodeBlock.setLiteral("select 1;");
    listItem.appendChild(fencedCodeBlock);

    BlockQuote blockQuote = new BlockQuote();
    Paragraph quoteParagraph = new Paragraph();
    quoteParagraph.appendChild(new Text("Quoted"));
    blockQuote.appendChild(quoteParagraph);
    listItem.appendChild(blockQuote);

    listItem.appendChild(createTable("C1", "C2", "a", "b"));
    bulletList.appendChild(listItem);
    document.appendChild(bulletList);

    document.accept(assembler);
    assembler.flushCurrentText();

    assertNotNull(assembler.getTableAttachment());
    SlackTableAttachment.TableBlock tableBlock =
        assertInstanceOf(
            SlackTableAttachment.TableBlock.class,
            assembler.getTableAttachment().getBlocks().get(0));
    assertEquals("Name", tableBlock.getRows().get(0).get(0).getText());
    assertEquals("foo", tableBlock.getRows().get(1).get(0).getText());

    SectionBlock listBlock = assertInstanceOf(SectionBlock.class, assembler.blocks.get(0));
    String text = listBlock.getText().getText();
    assertTrue(text.contains("• Item"));
    assertTrue(text.contains("```\nselect 1;\n```"));
    assertTrue(text.contains("> Quoted"));
    assertTrue(text.contains("| C1"));
    assertTrue(text.contains("| a"));
  }

  @Test
  void visitDocumentFormatsManualNodesAndQuotedLists() {
    SlackBlockAssembler assembler = new SlackBlockAssembler();
    Document document = new Document();

    CustomBlock customBlock = new CustomBlock() {};
    Paragraph wrappedParagraph = new Paragraph();
    wrappedParagraph.appendChild(new Text("wrapped"));
    customBlock.appendChild(wrappedParagraph);
    document.appendChild(customBlock);

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
    code.setLiteral("code<");
    paragraph.appendChild(code);
    paragraph.appendChild(new Text(" "));

    Link validLink = new Link();
    validLink.setDestination("https://example.com/docs");
    validLink.appendChild(new Text("ok"));
    paragraph.appendChild(validLink);
    paragraph.appendChild(new Text(" "));

    Link malformedLink = new Link();
    malformedLink.setDestination("https://example.com/%zz");
    malformedLink.appendChild(new Text("bad"));
    paragraph.appendChild(malformedLink);
    paragraph.appendChild(new Text(" "));

    CustomNode customNode = new CustomNode() {};
    customNode.appendChild(new Text("custom"));
    paragraph.appendChild(customNode);
    paragraph.appendChild(new Text(" "));

    Strikethrough strikethrough = new Strikethrough("~~");
    strikethrough.appendChild(new Text("gone"));
    paragraph.appendChild(strikethrough);
    paragraph.appendChild(new SoftLineBreak());
    paragraph.appendChild(new Text("soft"));
    paragraph.appendChild(new HardLineBreak());
    paragraph.appendChild(new Text("hard"));
    document.appendChild(paragraph);

    BlockQuote blockQuote = new BlockQuote();
    Paragraph quoteParagraph = new Paragraph();
    quoteParagraph.appendChild(new Text("quoted"));
    blockQuote.appendChild(quoteParagraph);
    blockQuote.appendChild(createBulletList("quoted bullet"));

    OrderedList quotedOrderedList = new OrderedList();
    quotedOrderedList.setMarkerStartNumber(3);
    quotedOrderedList.appendChild(createParagraphListItem("quoted ordered"));
    blockQuote.appendChild(quotedOrderedList);
    document.appendChild(blockQuote);

    IndentedCodeBlock indentedCodeBlock = new IndentedCodeBlock();
    indentedCodeBlock.setLiteral("indented");
    document.appendChild(indentedCodeBlock);

    document.accept(assembler);
    assembler.flushCurrentText();

    assertEquals(4, assembler.blocks.size());
    assertEquals("wrapped", getSectionText(assembler.blocks.get(0)));

    String inlineText = getSectionText(assembler.blocks.get(1));
    assertTrue(inlineText.contains("plain _em_ *strong* `code&lt;` <https://example.com/docs|ok>"));
    assertTrue(inlineText.contains("bad"));
    assertTrue(inlineText.contains("custom"));
    assertTrue(inlineText.contains("~gone~"));
    assertTrue(inlineText.contains("soft\nhard"));

    String quoteText = getSectionText(assembler.blocks.get(2));
    assertTrue(quoteText.contains("> quoted"));
    assertTrue(quoteText.contains("> • quoted bullet"));
    assertTrue(quoteText.contains("> 3. quoted ordered"));

    assertEquals("```\nindented\n```", getSectionText(assembler.blocks.get(3)));
  }

  @Test
  void visitDocumentCreatesAttachmentFromListTableAndFormatsNestedStructures() {
    SlackBlockAssembler assembler = new SlackBlockAssembler();
    Document document = new Document();
    BulletList bulletList = new BulletList();
    ListItem rootItem = new ListItem();

    CustomNode first = new CustomNode() {};
    first.appendChild(new Text("first"));
    rootItem.appendChild(first);

    CustomNode second = new CustomNode() {};
    second.appendChild(new Text("second"));
    rootItem.appendChild(second);

    IndentedCodeBlock indentedCodeBlock = new IndentedCodeBlock();
    indentedCodeBlock.setLiteral("list code");
    rootItem.appendChild(indentedCodeBlock);

    BlockQuote blockQuote = new BlockQuote();
    blockQuote.appendChild(createBulletList("qbullet"));
    OrderedList orderedInQuote = new OrderedList();
    orderedInQuote.setMarkerStartNumber(2);
    orderedInQuote.appendChild(createParagraphListItem("qordered"));
    blockQuote.appendChild(orderedInQuote);
    rootItem.appendChild(blockQuote);

    rootItem.appendChild(createTable("H1", "H2", "A|1", "B\n2"));

    BulletList nestedBulletList = new BulletList();
    ListItem nestedItem = createParagraphListItem("mid");

    OrderedList nestedOrderedList = new OrderedList();
    nestedOrderedList.setMarkerStartNumber(4);
    nestedOrderedList.appendChild(createParagraphListItem("nested ordered"));
    nestedItem.appendChild(nestedOrderedList);

    BulletList deepBulletList = new BulletList();
    deepBulletList.appendChild(createParagraphListItem("deep"));
    nestedItem.appendChild(deepBulletList);

    nestedBulletList.appendChild(nestedItem);
    rootItem.appendChild(nestedBulletList);
    bulletList.appendChild(rootItem);
    document.appendChild(bulletList);

    document.accept(assembler);
    assembler.flushCurrentText();

    assertNotNull(assembler.getTableAttachment());
    SlackTableAttachment.TableBlock tableBlock =
        assertInstanceOf(
            SlackTableAttachment.TableBlock.class,
            assembler.getTableAttachment().getBlocks().get(0));
    assertEquals("A\\|1", tableBlock.getRows().get(1).get(0).getText());
    assertEquals("B 2", tableBlock.getRows().get(1).get(1).getText());

    String listText = getSectionText(assembler.blocks.get(0));
    assertTrue(listText.contains("• first second"));
    assertTrue(listText.contains("```\nlist code\n```"));
    assertTrue(listText.contains("> • qbullet"));
    assertTrue(listText.contains("> 2. qordered"));
    assertTrue(listText.contains("◦ mid"));
    assertTrue(listText.contains("4. nested ordered"));
    assertTrue(listText.contains("▪ deep"));
  }

  private static TableBlock createTable(
      String headerOne, String headerTwo, String bodyOne, String bodyTwo) {
    TableBlock tableBlock = new TableBlock();
    TableHead tableHead = new TableHead();
    TableBody tableBody = new TableBody();

    tableHead.appendChild(createRow(headerOne, headerTwo));
    tableBody.appendChild(createRow(bodyOne, bodyTwo));

    tableBlock.appendChild(tableHead);
    tableBlock.appendChild(tableBody);
    return tableBlock;
  }

  private static TableRow createRow(String firstCell, String secondCell) {
    TableRow tableRow = new TableRow();
    tableRow.appendChild(createCell(firstCell));
    tableRow.appendChild(createCell(secondCell));
    return tableRow;
  }

  private static TableCell createCell(String text) {
    TableCell tableCell = new TableCell();
    tableCell.appendChild(new Text(text));
    return tableCell;
  }

  private static BulletList createBulletList(String text) {
    BulletList bulletList = new BulletList();
    bulletList.appendChild(createParagraphListItem(text));
    return bulletList;
  }

  private static ListItem createParagraphListItem(String text) {
    ListItem listItem = new ListItem();
    Paragraph paragraph = new Paragraph();
    paragraph.appendChild(new Text(text));
    listItem.appendChild(paragraph);
    return listItem;
  }

  private static String getSectionText(LayoutBlock block) {
    return assertInstanceOf(SectionBlock.class, block).getText().getText();
  }
}
