package org.openmetadata.service.notifications.channels.gchat;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.commonmark.ext.gfm.tables.TableBlock;
import org.commonmark.ext.gfm.tables.TableBody;
import org.commonmark.ext.gfm.tables.TableCell;
import org.commonmark.ext.gfm.tables.TableHead;
import org.commonmark.ext.gfm.tables.TableRow;
import org.commonmark.node.BlockQuote;
import org.commonmark.node.BulletList;
import org.commonmark.node.CustomBlock;
import org.commonmark.node.CustomNode;
import org.commonmark.node.Document;
import org.commonmark.node.FencedCodeBlock;
import org.commonmark.node.HardLineBreak;
import org.commonmark.node.Heading;
import org.commonmark.node.Image;
import org.commonmark.node.IndentedCodeBlock;
import org.commonmark.node.ListItem;
import org.commonmark.node.OrderedList;
import org.commonmark.node.Paragraph;
import org.commonmark.node.SoftLineBreak;
import org.commonmark.node.Text;
import org.commonmark.node.ThematicBreak;
import org.junit.jupiter.api.Test;

class GChatCardAssemblerTest {

  @Test
  void visitDocumentBuildsSectionsForMixedContentAndImages() {
    GChatCardAssembler assembler = new GChatCardAssembler();
    Document document = new Document();

    CustomBlock customBlock = new CustomBlock() {};
    Paragraph wrappedParagraph = new Paragraph();
    wrappedParagraph.appendChild(new Text("wrapped"));
    customBlock.appendChild(wrappedParagraph);

    CustomNode customNode = new CustomNode() {};
    Image customImage = new Image();
    customImage.setDestination("https://example.com/%zz");
    customImage.appendChild(new Text("custom"));
    customNode.appendChild(customImage);
    customBlock.appendChild(customNode);
    document.appendChild(customBlock);

    Heading heading = new Heading();
    heading.setLevel(2);
    heading.appendChild(new Text("heading"));
    document.appendChild(heading);

    Paragraph paragraph = new Paragraph();
    paragraph.appendChild(new Text("first"));
    paragraph.appendChild(new SoftLineBreak());
    paragraph.appendChild(new Text("second"));
    paragraph.appendChild(new HardLineBreak());
    paragraph.appendChild(new Text("third"));
    document.appendChild(paragraph);

    Paragraph imageParagraph = new Paragraph();
    Image image = new Image();
    image.setDestination("https://img.example/x.png");
    image.setTitle("Diagram");
    imageParagraph.appendChild(image);
    document.appendChild(imageParagraph);

    BlockQuote blockQuote = new BlockQuote();
    Paragraph quoteParagraph = new Paragraph();
    quoteParagraph.appendChild(new Text("quoted"));
    blockQuote.appendChild(quoteParagraph);
    blockQuote.appendChild(createBulletList("bullet"));
    OrderedList orderedList = new OrderedList();
    orderedList.setMarkerStartNumber(3);
    orderedList.appendChild(createParagraphListItem("ordered"));
    blockQuote.appendChild(orderedList);
    document.appendChild(blockQuote);

    FencedCodeBlock fencedCodeBlock = new FencedCodeBlock();
    fencedCodeBlock.setLiteral("code");
    document.appendChild(fencedCodeBlock);

    IndentedCodeBlock indentedCodeBlock = new IndentedCodeBlock();
    indentedCodeBlock.setLiteral("indented");
    document.appendChild(indentedCodeBlock);
    document.appendChild(new ThematicBreak());

    document.accept(assembler);

    assertEquals(3, assembler.sections.size());
    assertEquals("wrapped", textWidget(assembler.sections.get(0), 0));
    assertEquals("custom", textWidget(assembler.sections.get(0), 1));
    assertEquals("*heading*", textWidget(assembler.sections.get(1), 0));

    GChatMessageV2.Section richSection = assembler.sections.get(2);
    assertEquals("first", textWidget(richSection, 0));
    assertEquals("second", textWidget(richSection, 1));
    assertEquals("third", textWidget(richSection, 2));

    GChatMessageV2.Image renderedImage =
        assertInstanceOf(GChatMessageV2.Image.class, richSection.getWidgets().get(3).getImage());
    assertEquals("https://img.example/x.png", renderedImage.getImageUrl());
    assertEquals("Diagram", renderedImage.getAltText());

    assertTrue(textWidget(richSection, 4).contains("> quoted"));
    assertTrue(textWidget(richSection, 4).contains("> - bullet"));
    assertTrue(textWidget(richSection, 4).contains("> 3. ordered"));
    assertEquals("```\ncode\n```", textWidget(richSection, 5));
    assertEquals("```\nindented\n```", textWidget(richSection, 6));
    assertNull(richSection.getWidgets().get(7).getTextParagraph());
    assertInstanceOf(GChatMessageV2.Divider.class, richSection.getWidgets().get(7).getDivider());
  }

  @Test
  void visitDocumentFormatsTablesAndNestedLists() {
    GChatCardAssembler assembler = new GChatCardAssembler();
    Document document = new Document();
    document.appendChild(
        createTable(new String[] {"Name", "Value"}, new String[] {"alpha", "beta"}));

    BulletList bulletList = new BulletList();
    ListItem item = new ListItem();
    Paragraph paragraph = new Paragraph();
    paragraph.appendChild(new Text("item"));
    item.appendChild(paragraph);

    FencedCodeBlock fencedCodeBlock = new FencedCodeBlock();
    fencedCodeBlock.setLiteral("code1");
    item.appendChild(fencedCodeBlock);

    IndentedCodeBlock indentedCodeBlock = new IndentedCodeBlock();
    indentedCodeBlock.setLiteral("code2");
    item.appendChild(indentedCodeBlock);

    BlockQuote blockQuote = new BlockQuote();
    Paragraph quoteParagraph = new Paragraph();
    quoteParagraph.appendChild(new Text("quoted"));
    blockQuote.appendChild(quoteParagraph);
    blockQuote.appendChild(createBulletList("qbullet"));
    OrderedList orderedInQuote = new OrderedList();
    orderedInQuote.setMarkerStartNumber(2);
    orderedInQuote.appendChild(createParagraphListItem("qordered"));
    blockQuote.appendChild(orderedInQuote);
    item.appendChild(blockQuote);

    item.appendChild(createBodyOnlyTable(new String[] {"left", "right"}));

    CustomNode custom = new CustomNode() {};
    custom.appendChild(new Text("custom"));
    item.appendChild(custom);

    CustomNode tail = new CustomNode() {};
    tail.appendChild(new Text("tail"));
    item.appendChild(tail);

    BulletList nestedBullet = new BulletList();
    nestedBullet.appendChild(createParagraphListItem("nested"));
    item.appendChild(nestedBullet);

    OrderedList nestedOrdered = new OrderedList();
    nestedOrdered.setMarkerStartNumber(4);
    nestedOrdered.appendChild(createParagraphListItem("nested ordered"));
    item.appendChild(nestedOrdered);
    bulletList.appendChild(item);
    document.appendChild(bulletList);

    OrderedList emptyOrdered = new OrderedList();
    emptyOrdered.setMarkerStartNumber(3);
    ListItem emptyItem = new ListItem();
    BulletList nestedFromEmpty = new BulletList();
    nestedFromEmpty.appendChild(createParagraphListItem("from empty"));
    emptyItem.appendChild(nestedFromEmpty);
    emptyOrdered.appendChild(emptyItem);
    document.appendChild(emptyOrdered);

    document.accept(assembler);

    assertEquals(2, assembler.sections.size());
    assertTrue(textWidget(assembler.sections.get(0), 0).contains("<b>📋 Record 1</b>"));
    assertTrue(textWidget(assembler.sections.get(0), 0).contains("Name  : alpha"));
    assertTrue(textWidget(assembler.sections.get(0), 0).contains("Value : beta"));

    String listText = textWidget(assembler.sections.get(1), 0);
    assertTrue(listText.contains("- item"));
    assertTrue(listText.contains("```\ncode1\n```"));
    assertTrue(listText.contains("```\ncode2\n```"));
    assertTrue(listText.contains("quoted"));
    assertTrue(listText.contains("- qbullet"));
    assertTrue(listText.contains("2. qordered"));
    assertTrue(listText.contains("<br><b>📋 Record 1</b>"));
    assertTrue(listText.contains("custom tail"));
    assertTrue(listText.contains("- nested"));
    assertTrue(listText.contains("4. nested ordered"));

    String orderedText = textWidget(assembler.sections.get(1), 1);
    assertTrue(orderedText.isBlank() || !orderedText.contains("3."));
    assertTrue(orderedText.contains("- from empty"));
  }

  @Test
  void visitDocumentFallsBackForInvalidImagesAndBuildsGeneratedTableHeaders() {
    GChatCardAssembler assembler = new GChatCardAssembler();
    Document document = new Document();
    document.appendChild(
        createBodyOnlyTable(new String[] {"first"}, new String[] {"second", "value"}));

    Paragraph fallbackParagraph = new Paragraph();
    Image fallbackImage = new Image();
    fallbackImage.setDestination("https://example.com/%zz");
    fallbackImage.appendChild(new Text("fallback"));
    fallbackParagraph.appendChild(fallbackImage);
    document.appendChild(fallbackParagraph);

    Paragraph defaultParagraph = new Paragraph();
    Image defaultImage = new Image();
    defaultImage.setDestination("https://example.com/%zz");
    defaultParagraph.appendChild(defaultImage);
    document.appendChild(defaultParagraph);

    document.accept(assembler);

    assertEquals(2, assembler.sections.size());
    String tableText = textWidget(assembler.sections.get(0), 0);
    assertTrue(tableText.contains("Column 1 : first"));
    assertTrue(tableText.contains("Column 2 :"));
    assertTrue(tableText.contains("Column 2 : value"));
    assertTrue(tableText.contains("📋 Record 2"));

    assertEquals("fallback", textWidget(assembler.sections.get(1), 0));
    assertEquals("Image", textWidget(assembler.sections.get(1), 1));
  }

  private static String textWidget(GChatMessageV2.Section section, int index) {
    return assertInstanceOf(
            GChatMessageV2.TextParagraph.class, section.getWidgets().get(index).getTextParagraph())
        .getText();
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

  private static TableBlock createTable(String[] headers, String[] row) {
    TableBlock tableBlock = new TableBlock();
    TableHead tableHead = new TableHead();
    tableHead.appendChild(createRow(headers));
    tableBlock.appendChild(tableHead);

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

  private static TableRow createRow(String[] values) {
    TableRow row = new TableRow();
    for (String value : values) {
      TableCell cell = new TableCell();
      cell.appendChild(new Text(value));
      row.appendChild(cell);
    }
    return row;
  }
}
