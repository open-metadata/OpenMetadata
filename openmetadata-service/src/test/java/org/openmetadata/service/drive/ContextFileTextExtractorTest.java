package org.openmetadata.service.drive;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.UUID;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.ContextFileType;
import org.openmetadata.schema.entity.data.ProcessingStatus;

class ContextFileTextExtractorTest {

  private final ContextFileTextExtractor extractor = new ContextFileTextExtractor();

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
  void extractImageUsesConfiguredOcrEngine() throws Exception {
    ContextFileTextExtractor extractor =
        new ContextFileTextExtractor(
            new ContextFileTextExtractor.ImageOcrEngine() {
              @Override
              public boolean isAvailable() {
                return true;
              }

              @Override
              public String extract(java.nio.file.Path imagePath) {
                return "Revenue chart shows regional growth";
              }
            });
    ContextFile file =
        new ContextFile()
            .withId(UUID.randomUUID())
            .withName("diagram")
            .withFileType(ContextFileType.Image)
            .withFileExtension("png");

    ContextFileTextExtractor.ExtractionResult result =
        extractor.extract(new ByteArrayInputStream(new byte[] {1, 2, 3}), file);

    assertEquals(ProcessingStatus.Processed, result.processingStatus());
    assertEquals("Revenue chart shows regional growth", result.extractedText());
    assertEquals(result.extractedText(), result.indexedText());
    assertEquals(1, result.pageCount());
  }

  @Test
  void extractImageReturnsUnsupportedWhenOcrUnavailable() throws Exception {
    ContextFileTextExtractor extractor =
        new ContextFileTextExtractor(
            new ContextFileTextExtractor.ImageOcrEngine() {
              @Override
              public boolean isAvailable() {
                return false;
              }

              @Override
              public String extract(java.nio.file.Path imagePath) {
                throw new UnsupportedOperationException("OCR should not run when unavailable");
              }
            });
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
    assertTrue(result.processingError().contains("OCR"));
  }

  @Test
  void extractImageUsesConfiguredTikaTesseractPathOverride() throws Exception {
    String originalPath = System.getProperty(ContextFileTextExtractor.TIKA_TESSERACT_PATH_PROPERTY);
    Path fakeTesseractHome = createFakeTesseractHome("Revenue chart shows regional growth");
    System.setProperty(
        ContextFileTextExtractor.TIKA_TESSERACT_PATH_PROPERTY, fakeTesseractHome.toString());

    try {
      ContextFileTextExtractor extractor =
          new ContextFileTextExtractor(new ContextFileTextExtractor.TesseractImageOcrEngine());
      ContextFile file =
          new ContextFile()
              .withId(UUID.randomUUID())
              .withName("diagram")
              .withFileType(ContextFileType.Image)
              .withFileExtension("png");

      ContextFileTextExtractor.ExtractionResult result =
          extractor.extract(new ByteArrayInputStream(new byte[] {1, 2, 3}), file);

      assertEquals(ProcessingStatus.Processed, result.processingStatus());
      assertEquals("Revenue chart shows regional growth", result.extractedText());
      assertEquals(result.extractedText(), result.indexedText());
    } finally {
      if (originalPath == null) {
        System.clearProperty(ContextFileTextExtractor.TIKA_TESSERACT_PATH_PROPERTY);
      } else {
        System.setProperty(ContextFileTextExtractor.TIKA_TESSERACT_PATH_PROPERTY, originalPath);
      }
      deleteRecursively(fakeTesseractHome);
    }
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

  private Path createFakeTesseractHome(String extractedText) throws IOException {
    Path home = Files.createTempDirectory("fake-tesseract-home-");
    Path executable = home.resolve("tesseract");
    Files.writeString(
        executable,
        "#!/bin/sh\n"
            + "if [ $# -eq 0 ] || [ \"$1\" = \"--version\" ]; then\n"
            + "  echo \"tesseract 5.0.0\"\n"
            + "  exit 0\n"
            + "fi\n"
            + "output_base=\"$2\"\n"
            + "printf '%s\\n' \""
            + extractedText
            + "\" > \"${output_base}.txt\"\n",
        StandardCharsets.UTF_8);
    executable.toFile().setExecutable(true);
    return home;
  }

  private void deleteRecursively(Path root) throws IOException {
    if (root == null || Files.notExists(root)) {
      return;
    }
    try (var paths = Files.walk(root)) {
      paths.sorted(Comparator.reverseOrder()).forEach(path -> path.toFile().delete());
    }
  }
}
