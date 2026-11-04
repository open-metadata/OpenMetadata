package org.openmetadata.service.context.center;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.StringJoiner;
import lombok.Builder;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.extractor.ExtractorFactory;
import org.apache.poi.extractor.POITextExtractor;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.ContextFileType;
import org.openmetadata.schema.entity.data.ProcessingStatus;

public class ContextFileTextExtractor {
  static final int MAX_CANONICAL_TEXT_LENGTH = 1_000_000;
  static final int MAX_INDEXED_TEXT_LENGTH = 200_000;

  public ExtractionResult extract(InputStream inputStream, ContextFile file) throws IOException {
    if (inputStream == null) {
      throw new IOException("No file stream available for extraction");
    }

    ContextFileType fileType =
        file.getFileType() == null ? ContextFileType.Other : file.getFileType();
    return switch (fileType) {
      case PDF -> extractPdf(inputStream, file.getFileExtension());
      case Spreadsheet -> extractSpreadsheet(inputStream, file.getFileExtension());
      case Document, Presentation -> extractOfficeDocument(inputStream, file.getFileExtension());
      case CSV, Text -> extractPlainText(inputStream);
      case Image, Archive, Other -> ExtractionResult.unsupported(
          "Text extraction is not supported for file type " + fileType);
    };
  }

  private ExtractionResult extractPlainText(InputStream inputStream) throws IOException {
    String text = readText(inputStream, MAX_CANONICAL_TEXT_LENGTH);
    return ExtractionResult.processed(text, null);
  }

  private ExtractionResult extractPdf(InputStream inputStream, String fileExtension)
      throws IOException {
    Path tempFile = spoolToTempFile(inputStream, fileExtension);
    try (PDDocument document = PDDocument.load(tempFile.toFile())) {
      String text = new PDFTextStripper().getText(document);
      return ExtractionResult.processed(text, document.getNumberOfPages());
    } finally {
      Files.deleteIfExists(tempFile);
    }
  }

  private ExtractionResult extractSpreadsheet(InputStream inputStream, String fileExtension)
      throws IOException {
    Path tempFile = spoolToTempFile(inputStream, fileExtension);
    try (Workbook workbook = WorkbookFactory.create(tempFile.toFile())) {
      DataFormatter formatter = new DataFormatter();
      StringBuilder text = new StringBuilder();
      for (int i = 0; i < workbook.getNumberOfSheets(); i++) {
        Sheet sheet = workbook.getSheetAt(i);
        if (text.length() > 0) {
          text.append('\n');
        }
        text.append("Sheet: ").append(sheet.getSheetName()).append('\n');
        for (Row row : sheet) {
          StringJoiner joiner = new StringJoiner("\t");
          for (Cell cell : row) {
            String formatted = formatter.formatCellValue(cell);
            if (formatted != null && !formatted.isBlank()) {
              joiner.add(formatted.trim());
            }
          }
          String rowText = joiner.toString();
          if (!rowText.isBlank()) {
            text.append(rowText).append('\n');
          }
          if (text.length() >= MAX_CANONICAL_TEXT_LENGTH) {
            break;
          }
        }
        if (text.length() >= MAX_CANONICAL_TEXT_LENGTH) {
          break;
        }
      }
      return ExtractionResult.processed(text.toString(), workbook.getNumberOfSheets());
    } finally {
      Files.deleteIfExists(tempFile);
    }
  }

  private ExtractionResult extractOfficeDocument(InputStream inputStream, String fileExtension)
      throws IOException {
    Path tempFile = spoolToTempFile(inputStream, fileExtension);
    try (POITextExtractor extractor = ExtractorFactory.createExtractor(tempFile.toFile())) {
      return ExtractionResult.processed(extractor.getText(), null);
    } finally {
      Files.deleteIfExists(tempFile);
    }
  }

  private Path spoolToTempFile(InputStream inputStream, String fileExtension) throws IOException {
    String suffix = fileExtension == null || fileExtension.isBlank() ? ".bin" : "." + fileExtension;
    Path tempFile = Files.createTempFile("context-file-extract-", suffix);
    try (OutputStream outputStream = Files.newOutputStream(tempFile)) {
      inputStream.transferTo(outputStream);
    } catch (IOException | RuntimeException e) {
      Files.deleteIfExists(tempFile);
      throw e;
    }
    return tempFile;
  }

  private String readText(InputStream inputStream, int maxChars) throws IOException {
    StringBuilder builder = new StringBuilder(Math.min(maxChars, 8192));
    try (BufferedReader reader =
        new BufferedReader(new InputStreamReader(inputStream, StandardCharsets.UTF_8))) {
      char[] buffer = new char[4096];
      int read;
      while ((read = reader.read(buffer)) != -1) {
        int remaining = maxChars - builder.length();
        if (remaining <= 0) {
          break;
        }
        builder.append(buffer, 0, Math.min(read, remaining));
      }
    }
    return normalize(builder.toString());
  }

  static String normalize(String text) {
    if (text == null || text.isBlank()) {
      return "";
    }
    String normalized = text.replace("\u0000", "").replace("\r\n", "\n").replace('\r', '\n');
    return normalized.trim();
  }

  static String truncate(String text, int maxLength) {
    if (text == null || text.length() <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength);
  }

  @Builder
  public record ExtractionResult(
      ProcessingStatus processingStatus,
      String extractedText,
      String indexedText,
      Integer pageCount,
      String processingError) {
    static ExtractionResult processed(String text, Integer pageCount) {
      String normalized = normalize(text);
      return new ExtractionResult(
          ProcessingStatus.Processed,
          truncate(normalized, MAX_CANONICAL_TEXT_LENGTH),
          truncate(normalized, MAX_INDEXED_TEXT_LENGTH),
          pageCount,
          null);
    }

    static ExtractionResult unsupported(String reason) {
      return new ExtractionResult(ProcessingStatus.Unsupported, null, null, null, reason);
    }
  }
}
