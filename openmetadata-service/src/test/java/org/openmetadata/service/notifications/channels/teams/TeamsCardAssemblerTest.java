package org.openmetadata.service.notifications.channels.teams;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;

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
import org.commonmark.node.Heading;
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
import org.openmetadata.service.apps.bundles.changeEvent.msteams.TeamsMessage;

class TeamsCardAssemblerTest {

  @Test
  void visitDocumentFormatsHeadingsInlineFallbackQuotesAndSeparators() {
    TeamsCardAssembler assembler = new TeamsCardAssembler();
    Document document = new Document();

    document.appendChild(createHeading(1, "Heading 1"));
    document.appendChild(createHeading(2, "Heading 2"));
    document.appendChild(createHeading(3, "Heading 3"));
    document.appendChild(createHeading(5, "Heading 5"));

    CustomBlock customBlock = new CustomBlock() {};
    customBlock.appendChild(new Text("plain "));

    Emphasis emphasis = new Emphasis();
    emphasis.appendChild(new Text("em"));
    customBlock.appendChild(emphasis);
    customBlock.appendChild(new Text(" "));

    StrongEmphasis strongEmphasis = new StrongEmphasis();
    strongEmphasis.appendChild(new Text("strong"));
    customBlock.appendChild(strongEmphasis);
    customBlock.appendChild(new Text(" "));

    Code code = new Code();
    code.setLiteral("code");
    customBlock.appendChild(code);
    customBlock.appendChild(new Text(" "));

    Link validLink = new Link();
    validLink.setDestination("https://example.com/a b");
    validLink.appendChild(new Text("ok"));
    customBlock.appendChild(validLink);
    customBlock.appendChild(new Text(" "));

    Link invalidLink = new Link();
    invalidLink.setDestination("https://example.com/%zz");
    invalidLink.appendChild(new Text("bad(x)"));
    customBlock.appendChild(invalidLink);
    customBlock.appendChild(new Text(" "));

    Link unlabeledLink = new Link();
    unlabeledLink.setDestination("mailto:team@example.com");
    customBlock.appendChild(unlabeledLink);
    customBlock.appendChild(new Text(" "));

    CustomNode customNode = new CustomNode() {};
    customNode.appendChild(new Text("custom"));
    customBlock.appendChild(customNode);
    customBlock.appendChild(new Text(" "));

    Strikethrough strikethrough = new Strikethrough("~~");
    strikethrough.appendChild(new Text("gone"));
    customBlock.appendChild(strikethrough);
    customBlock.appendChild(new SoftLineBreak());
    customBlock.appendChild(new Text("soft"));
    customBlock.appendChild(new HardLineBreak());
    customBlock.appendChild(new Text("hard"));
    document.appendChild(customBlock);

    BlockQuote blockQuote = new BlockQuote();
    Paragraph quoteParagraph = new Paragraph();
    quoteParagraph.appendChild(new Text("quoted"));
    blockQuote.appendChild(quoteParagraph);

    FencedCodeBlock quoteCode = new FencedCodeBlock();
    quoteCode.setLiteral("quoted code");
    blockQuote.appendChild(quoteCode);

    IndentedCodeBlock quoteIndented = new IndentedCodeBlock();
    quoteIndented.setLiteral("quoted indented");
    blockQuote.appendChild(quoteIndented);
    document.appendChild(blockQuote);
    document.appendChild(new ThematicBreak());

    document.accept(assembler);

    List<TeamsMessage.BodyItem> body = assembler.getBodyItems();
    assertEquals(9, body.size());

    assertHeading(body.get(0), "Heading 1", "ExtraLarge");
    assertHeading(body.get(1), "Heading 2", "Large");
    assertHeading(body.get(2), "Heading 3", "Medium");
    assertHeading(body.get(3), "Heading 5", "Default");

    TeamsMessage.TextBlock inlineLine = assertTextBlock(body.get(4));
    assertTrue(
        inlineLine
            .getText()
            .contains(
                "plain *em* **strong** `code` [ok](https://example.com/a%20b) bad\\(x\\) [mailto:team@example.com](mailto:team@example.com) custom ~~gone~~"));
    assertEquals("soft", assertTextBlock(body.get(5)).getText());
    assertEquals("hard", assertTextBlock(body.get(6)).getText());

    TeamsMessage.Container quoteContainer =
        assertInstanceOf(TeamsMessage.Container.class, body.get(7));
    TeamsMessage.TextBlock quoteText = assertTextBlock(quoteContainer.getItems().get(0));
    assertTrue(quoteText.getText().contains("> quoted"));
    assertTrue(quoteText.getText().contains("> quoted code"));
    assertTrue(quoteText.getText().contains("> quoted indented"));

    assertTrue(assertTextBlock(body.get(8)).isSeparator());
  }

  @Test
  void visitDocumentProcessesNestedListsBlocksAndTables() {
    TeamsCardAssembler assembler = new TeamsCardAssembler();
    Document document = new Document();

    BulletList bulletList = new BulletList();

    ListItem blockOnlyItem = new ListItem();
    FencedCodeBlock fencedCodeBlock = new FencedCodeBlock();
    fencedCodeBlock.setLiteral("code1");
    blockOnlyItem.appendChild(fencedCodeBlock);

    BulletList nestedBulletList = new BulletList();
    nestedBulletList.appendChild(createParagraphListItem("nested bullet"));
    blockOnlyItem.appendChild(nestedBulletList);

    OrderedList nestedOrderedList = new OrderedList();
    nestedOrderedList.setMarkerStartNumber(4);
    nestedOrderedList.appendChild(createParagraphListItem("nested ordered"));
    blockOnlyItem.appendChild(nestedOrderedList);
    bulletList.appendChild(blockOnlyItem);

    ListItem richItem = new ListItem();
    Paragraph paragraph = new Paragraph();
    paragraph.appendChild(new Text("item"));
    richItem.appendChild(paragraph);

    IndentedCodeBlock indentedCodeBlock = new IndentedCodeBlock();
    indentedCodeBlock.setLiteral("indented");
    richItem.appendChild(indentedCodeBlock);

    BlockQuote blockQuote = new BlockQuote();
    Paragraph quoteParagraph = new Paragraph();
    quoteParagraph.appendChild(new Text("quoted"));
    blockQuote.appendChild(quoteParagraph);
    richItem.appendChild(blockQuote);

    richItem.appendChild(createTable(new String[] {"Name", "Value"}, new String[] {"alpha"}));
    bulletList.appendChild(richItem);
    document.appendChild(bulletList);

    OrderedList topLevelOrdered = new OrderedList();
    topLevelOrdered.setMarkerStartNumber(3);
    ListItem orderedItem = new ListItem();
    BulletList nestedFromEmpty = new BulletList();
    nestedFromEmpty.appendChild(createParagraphListItem("from empty"));
    orderedItem.appendChild(nestedFromEmpty);
    topLevelOrdered.appendChild(orderedItem);
    document.appendChild(topLevelOrdered);

    document.accept(assembler);

    List<TeamsMessage.BodyItem> body = assembler.getBodyItems();
    assertEquals("-", assertTextBlock(body.get(0)).getText());
    assertEquals("code1", getContainerText(body.get(1)));
    assertEquals("  - nested bullet", assertTextBlock(body.get(2)).getText());
    assertEquals("  4. nested ordered", assertTextBlock(body.get(3)).getText());
    assertEquals("- item", assertTextBlock(body.get(4)).getText());
    assertEquals("indented", getContainerText(body.get(5)));
    assertTrue(getContainerText(body.get(6)).contains("> quoted"));

    TeamsMessage.Container tableContainer =
        assertInstanceOf(TeamsMessage.Container.class, body.get(7));
    TeamsMessage.Table table =
        assertInstanceOf(TeamsMessage.Table.class, tableContainer.getItems().get(0));
    assertFalse(table.getFirstRowAsHeader());
    assertEquals("Name", getCellText(table.getRows().get(0).getCells().get(0), 0));
    assertEquals("alpha", getCellText(table.getRows().get(0).getCells().get(1), 0));
    assertEquals("Value", getCellText(table.getRows().get(1).getCells().get(0), 0));
    assertEquals("—", getCellText(table.getRows().get(1).getCells().get(1), 0));

    assertEquals("3.", assertTextBlock(body.get(8)).getText());
    assertEquals("  - from empty", assertTextBlock(body.get(9)).getText());
  }

  @Test
  void visitDocumentBuildsHeaderedAndGeneratedTablesAndSkipsEmptyOnes() {
    TeamsCardAssembler assembler = new TeamsCardAssembler();
    Document document = new Document();
    document.appendChild(createEmptyTable());
    document.appendChild(
        createTable(new String[] {"Col1", "Col2"}, new String[] {"left", "right"}));
    document.appendChild(
        createBodyOnlyTable(new String[] {"first"}, new String[] {"second", "value"}));

    document.accept(assembler);

    List<TeamsMessage.BodyItem> body = assembler.getBodyItems();
    assertEquals(2, body.size());

    TeamsMessage.Container firstContainer =
        assertInstanceOf(TeamsMessage.Container.class, body.get(0));
    TeamsMessage.Table firstRecord =
        assertInstanceOf(TeamsMessage.Table.class, firstContainer.getItems().get(0));
    assertFalse(firstRecord.getFirstRowAsHeader());
    assertEquals("Col1", getCellText(firstRecord.getRows().get(0).getCells().get(0), 0));
    assertEquals("left", getCellText(firstRecord.getRows().get(0).getCells().get(1), 0));

    TeamsMessage.Container secondContainer =
        assertInstanceOf(TeamsMessage.Container.class, body.get(1));
    assertEquals(2, secondContainer.getItems().size());

    TeamsMessage.Table generatedHeaderRecord =
        assertInstanceOf(TeamsMessage.Table.class, secondContainer.getItems().get(0));
    assertTrue(generatedHeaderRecord.getFirstRowAsHeader());
    assertEquals(
        "Record 1", getCellText(generatedHeaderRecord.getRows().get(0).getCells().get(0), 0));
    assertEquals(
        "Column 1", getCellText(generatedHeaderRecord.getRows().get(1).getCells().get(0), 0));
    assertEquals("first", getCellText(generatedHeaderRecord.getRows().get(1).getCells().get(1), 0));
    assertEquals(
        "Column 2", getCellText(generatedHeaderRecord.getRows().get(2).getCells().get(0), 0));
    assertEquals("—", getCellText(generatedHeaderRecord.getRows().get(2).getCells().get(1), 0));

    TeamsMessage.Table secondGeneratedRecord =
        assertInstanceOf(TeamsMessage.Table.class, secondContainer.getItems().get(1));
    assertEquals("Medium", secondGeneratedRecord.getSpacing());
    assertTrue(secondGeneratedRecord.getSeparator());
    assertEquals("value", getCellText(secondGeneratedRecord.getRows().get(2).getCells().get(1), 0));
  }

  private static Heading createHeading(int level, String text) {
    Heading heading = new Heading();
    heading.setLevel(level);
    heading.appendChild(new Text(text));
    return heading;
  }

  private static TeamsMessage.TextBlock assertTextBlock(TeamsMessage.BodyItem item) {
    return assertInstanceOf(TeamsMessage.TextBlock.class, item);
  }

  private static void assertHeading(TeamsMessage.BodyItem item, String text, String size) {
    TeamsMessage.TextBlock heading = assertTextBlock(item);
    assertEquals(text, heading.getText());
    assertEquals("Bolder", heading.getWeight());
    assertEquals(size, heading.getSize());
  }

  private static String getContainerText(TeamsMessage.BodyItem item) {
    TeamsMessage.Container container = assertInstanceOf(TeamsMessage.Container.class, item);
    return assertTextBlock(container.getItems().get(0)).getText();
  }

  private static String getCellText(TeamsMessage.TableCell cell, int itemIndex) {
    return assertTextBlock(cell.getItems().get(itemIndex)).getText();
  }

  private static ListItem createParagraphListItem(String text) {
    ListItem listItem = new ListItem();
    Paragraph paragraph = new Paragraph();
    paragraph.appendChild(new Text(text));
    listItem.appendChild(paragraph);
    return listItem;
  }

  private static TableBlock createTable(String[] headers, String[] row) {
    TableBlock tableBlock = new TableBlock();
    if (headers != null) {
      TableHead tableHead = new TableHead();
      tableHead.appendChild(createRow(headers));
      tableBlock.appendChild(tableHead);
    }

    TableBody tableBody = new TableBody();
    tableBody.appendChild(createRow(row));
    tableBlock.appendChild(tableBody);
    return tableBlock;
  }

  private static TableBlock createBodyOnlyTable(String[]... rows) {
    TableBlock tableBlock = new TableBlock();
    TableBody tableBody = new TableBody();
    for (String[] row : rows) {
      tableBody.appendChild(createRow(row));
    }
    tableBlock.appendChild(tableBody);
    return tableBlock;
  }

  private static TableBlock createEmptyTable() {
    return new TableBlock();
  }

  private static TableRow createRow(String[] values) {
    TableRow row = new TableRow();
    for (String value : values) {
      TableCell cell = new TableCell();
      if (value != null) {
        cell.appendChild(new Text(value));
      }
      row.appendChild(cell);
    }
    return row;
  }
}
