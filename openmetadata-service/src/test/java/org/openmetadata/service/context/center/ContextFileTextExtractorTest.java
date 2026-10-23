package org.openmetadata.service.context.center;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xslf.usermodel.XMLSlideShow;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.ContextFileType;
import org.openmetadata.schema.entity.data.ProcessingStatus;

class ContextFileTextExtractorTest {

  private final ContextFileTextExtractor extractor = new ContextFileTextExtractor();

  @Test
  void extractRejectsMissingStream() {
    IOException exception =
        assertThrows(IOException.class, () -> extractor.extract(null, new ContextFile()));

    assertEquals("No file stream available for extraction", exception.getMessage());
  }

  @Test
  void extractPlainTextMarksFileProcessed() throws Exception {
    ContextFile file =
        new ContextFile()
            .withId(UUID.randomUUID())
            .withName("notes")
            .withFileType(ContextFileType.Text);
    byte[] content = "Context Center remembers this note".getBytes(StandardCharsets.UTF_8);

    ContextFileTextExtractor.ExtractionResult result =
        extractor.extract(new ByteArrayInputStream(content), file);

    assertEquals(ProcessingStatus.Processed, result.processingStatus());
    assertEquals("Context Center remembers this note", result.extractedText());
    assertEquals(result.extractedText(), result.indexedText());
    assertNull(result.pageCount());
  }

  @Test
  void extractPlainTextTruncatesLargeContent() throws Exception {
    ContextFile file = new ContextFile().withFileType(ContextFileType.Text);
    byte[] content =
        "x"
            .repeat(ContextFileTextExtractor.MAX_CANONICAL_TEXT_LENGTH + 8192)
            .getBytes(StandardCharsets.UTF_8);

    ContextFileTextExtractor.ExtractionResult result =
        extractor.extract(new ByteArrayInputStream(content), file);

    assertEquals(
        ContextFileTextExtractor.MAX_CANONICAL_TEXT_LENGTH, result.extractedText().length());
    assertEquals(ContextFileTextExtractor.MAX_INDEXED_TEXT_LENGTH, result.indexedText().length());
  }

  @Test
  void extractEmptyPlainTextReturnsEmptyText() throws Exception {
    ContextFile file = new ContextFile().withFileType(ContextFileType.Text);

    ContextFileTextExtractor.ExtractionResult result =
        extractor.extract(new ByteArrayInputStream(new byte[0]), file);

    assertEquals(ProcessingStatus.Processed, result.processingStatus());
    assertEquals("", result.extractedText());
    assertEquals("", result.indexedText());
  }

  @Test
  void extractPdfReturnsTextAndPageCount() throws Exception {
    ContextFile file =
        new ContextFile()
            .withId(UUID.randomUUID())
            .withName("report")
            .withFileType(ContextFileType.PDF)
            .withFileExtension("pdf");

    ContextFileTextExtractor.ExtractionResult result =
        extractor.extract(new ByteArrayInputStream(createPdf("Quarterly PDF Fixture")), file);

    assertEquals(ProcessingStatus.Processed, result.processingStatus());
    assertTrue(result.extractedText().contains("Quarterly PDF Fixture"));
    assertEquals(1, result.pageCount());
  }

  @Test
  void extractSpreadsheetReturnsSheetTextAndCount() throws Exception {
    ContextFile file =
        new ContextFile()
            .withId(UUID.randomUUID())
            .withName("pricing")
            .withFileType(ContextFileType.Spreadsheet)
            .withFileExtension("xlsx");

    ContextFileTextExtractor.ExtractionResult result =
        extractor.extract(new ByteArrayInputStream(createWorkbook()), file);

    assertEquals(ProcessingStatus.Processed, result.processingStatus());
    assertTrue(result.extractedText().contains("Sheet: Pricing"));
    assertTrue(result.extractedText().contains("Widget"));
    assertEquals(1, result.pageCount());
  }

  @Test
  void extractDocumentReturnsText() throws Exception {
    ContextFile file =
        new ContextFile().withFileType(ContextFileType.Document).withFileExtension("docx");
    try (XWPFDocument document = new XWPFDocument();
        ByteArrayOutputStream content = new ByteArrayOutputStream()) {
      document.createParagraph().createRun().setText("Office document fixture");
      document.write(content);

      ContextFileTextExtractor.ExtractionResult result =
          extractor.extract(new ByteArrayInputStream(content.toByteArray()), file);

      assertEquals(ProcessingStatus.Processed, result.processingStatus());
      assertTrue(result.extractedText().contains("Office document fixture"));
    }
  }

  @Test
  void extractPresentationReturnsText() throws Exception {
    ContextFile file =
        new ContextFile().withFileType(ContextFileType.Presentation).withFileExtension("pptx");
    try (XMLSlideShow presentation = new XMLSlideShow();
        ByteArrayOutputStream content = new ByteArrayOutputStream()) {
      presentation.createSlide().createTextBox().setText("Presentation fixture");
      presentation.write(content);

      ContextFileTextExtractor.ExtractionResult result =
          extractor.extract(new ByteArrayInputStream(content.toByteArray()), file);

      assertEquals(ProcessingStatus.Processed, result.processingStatus());
      assertTrue(result.extractedText().contains("Presentation fixture"));
    }
  }

  @Test
  void extractImageReturnsUnsupported() throws Exception {
    ContextFile file =
        new ContextFile()
            .withId(UUID.randomUUID())
            .withName("diagram")
            .withFileType(ContextFileType.Image)
            .withFileExtension("png");

    ContextFileTextExtractor.ExtractionResult result =
        extractor.extract(new ByteArrayInputStream(new byte[] {1, 2, 3}), file);

    assertEquals(ProcessingStatus.Unsupported, result.processingStatus());
    assertNull(result.extractedText());
    assertNull(result.indexedText());
    assertNull(result.pageCount());
    assertEquals("Text extraction is not supported for file type Image", result.processingError());
  }

  @Test
  void processedResultsTruncateIndexedTextBeforeCanonicalText() {
    String text = "x".repeat(ContextFileTextExtractor.MAX_CANONICAL_TEXT_LENGTH + 100);

    ContextFileTextExtractor.ExtractionResult result =
        ContextFileTextExtractor.ExtractionResult.processed(text, null);

    assertEquals(
        ContextFileTextExtractor.MAX_CANONICAL_TEXT_LENGTH, result.extractedText().length());
    assertEquals(ContextFileTextExtractor.MAX_INDEXED_TEXT_LENGTH, result.indexedText().length());
  }

  private byte[] createPdf(String text) throws IOException {
    try (PDDocument document = new PDDocument();
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
      PDPage page = new PDPage();
      document.addPage(page);
      try (PDPageContentStream contentStream = new PDPageContentStream(document, page)) {
        contentStream.beginText();
        contentStream.setFont(PDType1Font.HELVETICA_BOLD, 12);
        contentStream.newLineAtOffset(72, 720);
        contentStream.showText(text);
        contentStream.endText();
      }
      document.save(outputStream);
      return outputStream.toByteArray();
    }
  }

  private byte[] createWorkbook() throws IOException {
    try (Workbook workbook = new XSSFWorkbook();
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
      var sheet = workbook.createSheet("Pricing");
      var header = sheet.createRow(0);
      header.createCell(0).setCellValue("Item");
      header.createCell(1).setCellValue("Price");
      var row = sheet.createRow(1);
      row.createCell(0).setCellValue("Widget");
      row.createCell(1).setCellValue(42);
      workbook.write(outputStream);
      return outputStream.toByteArray();
    }
  }
}
