package org.openmetadata.service.drive;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Collections;
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
import org.apache.tika.exception.TikaConfigException;
import org.apache.tika.exception.TikaException;
import org.apache.tika.metadata.Metadata;
import org.apache.tika.parser.ParseContext;
import org.apache.tika.parser.ocr.TesseractOCRConfig;
import org.apache.tika.parser.ocr.TesseractOCRParser;
import org.apache.tika.sax.BodyContentHandler;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.ContextFileType;
import org.openmetadata.schema.entity.data.ProcessingStatus;
import org.xml.sax.SAXException;

public class ContextFileTextExtractor {
  static final int MAX_CANONICAL_TEXT_LENGTH = 1_000_000;
  static final int MAX_INDEXED_TEXT_LENGTH = 200_000;
  public static final String TIKA_TESSERACT_PATH_PROPERTY = "collate.tika.tesseract.path";
  public static final String TIKA_TESSERACT_PATH_ENV = "COLLATE_TIKA_TESSERACT_PATH";
  public static final String TIKA_TESSDATA_PATH_PROPERTY = "collate.tika.tessdata.path";
  public static final String TIKA_TESSDATA_PATH_ENV = "COLLATE_TIKA_TESSDATA_PATH";
  @Deprecated public static final String TESSERACT_COMMAND_PROPERTY = "collate.tesseract.command";
  @Deprecated public static final String TESSERACT_COMMAND_ENV = "COLLATE_TESSERACT_COMMAND";
  private static final long OCR_TIMEOUT_SECONDS = 60;

  private final ImageOcrEngine imageOcrEngine;

  public ContextFileTextExtractor() {
    this(new TesseractImageOcrEngine());
  }

  ContextFileTextExtractor(ImageOcrEngine imageOcrEngine) {
    this.imageOcrEngine = imageOcrEngine;
  }

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
      case Image -> extractImage(inputStream, file.getFileExtension());
      case Archive, Other -> ExtractionResult.unsupported(
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

  private ExtractionResult extractImage(InputStream inputStream, String fileExtension)
      throws IOException {
    Path tempFile = spoolToTempFile(inputStream, fileExtension);
    try {
      if (!imageOcrEngine.isAvailable()) {
        return ExtractionResult.unsupported(
            "Image OCR requires tesseract to be installed and configured for Apache Tika");
      }
      return ExtractionResult.processed(imageOcrEngine.extract(tempFile), 1);
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

  interface ImageOcrEngine {
    boolean isAvailable();

    String extract(Path imagePath) throws IOException;
  }

  static class TesseractImageOcrEngine implements ImageOcrEngine {
    private volatile Boolean available;
    private volatile String availableForConfiguration;

    @Override
    public boolean isAvailable() {
      String configuration = resolveAvailabilityConfiguration();
      Boolean cached = available;
      if (cached != null && configuration.equals(availableForConfiguration)) {
        return cached;
      }
      synchronized (this) {
        configuration = resolveAvailabilityConfiguration();
        if (available != null && configuration.equals(availableForConfiguration)) {
          return available;
        }
        available = detectAvailability();
        availableForConfiguration = configuration;
        return available;
      }
    }

    @Override
    public String extract(Path imagePath) throws IOException {
      try {
        TesseractOCRParser parser = createParser();
        TesseractOCRConfig config = createConfig();
        ParseContext parseContext = new ParseContext();
        parseContext.set(TesseractOCRConfig.class, config);
        // Bound the handler at MAX_CANONICAL_TEXT_LENGTH so a very large or malicious image
        // cannot drive Tika to accumulate unbounded OCR output on the heap (OOM risk).
        BodyContentHandler handler = new BodyContentHandler(MAX_CANONICAL_TEXT_LENGTH);
        Metadata metadata = new Metadata();

        try (InputStream stream = Files.newInputStream(imagePath)) {
          parser.parse(stream, handler, metadata, parseContext);
        }
        return handler.toString();
      } catch (TikaConfigException e) {
        throw new IOException("Invalid Apache Tika OCR configuration", e);
      } catch (TikaException | SAXException e) {
        throw new IOException("Apache Tika OCR failed", e);
      }
    }

    private boolean detectAvailability() {
      try {
        return createParser().hasTesseract();
      } catch (TikaConfigException e) {
        return false;
      }
    }

    private TesseractOCRParser createParser() throws TikaConfigException {
      TesseractOCRParser parser = new TesseractOCRParser();
      String tesseractPath = resolveTesseractPath();
      if (!tesseractPath.isBlank()) {
        parser.setTesseractPath(tesseractPath);
      }
      String tessdataPath = resolveTessdataPath();
      if (!tessdataPath.isBlank()) {
        parser.setTessdataPath(tessdataPath);
      }
      parser.initialize(Collections.emptyMap());
      return parser;
    }

    private TesseractOCRConfig createConfig() {
      TesseractOCRConfig config = new TesseractOCRConfig();
      config.setTimeoutSeconds((int) OCR_TIMEOUT_SECONDS);
      return config;
    }

    private String resolveAvailabilityConfiguration() {
      return resolveTesseractPath() + "|" + resolveTessdataPath();
    }

    private String resolveTesseractPath() {
      String configuredValue =
          firstNonBlankPropertyOrEnv(
              TIKA_TESSERACT_PATH_PROPERTY,
              TIKA_TESSERACT_PATH_ENV,
              TESSERACT_COMMAND_PROPERTY,
              TESSERACT_COMMAND_ENV);
      if (configuredValue == null) {
        return "";
      }
      return normalizeTesseractPath(configuredValue);
    }

    private String resolveTessdataPath() {
      String configuredValue =
          firstNonBlankPropertyOrEnv(TIKA_TESSDATA_PATH_PROPERTY, TIKA_TESSDATA_PATH_ENV);
      if (configuredValue == null) {
        return "";
      }
      return Path.of(configuredValue.trim()).normalize().toString();
    }

    private String firstNonBlankPropertyOrEnv(
        String propertyName, String envName, String fallbackPropertyName, String fallbackEnvName) {
      String configuredValue = firstNonBlankPropertyOrEnv(propertyName, envName);
      if (configuredValue != null) {
        return configuredValue;
      }
      return firstNonBlankPropertyOrEnv(fallbackPropertyName, fallbackEnvName);
    }

    private String firstNonBlankPropertyOrEnv(String propertyName, String envName) {
      String propertyValue = System.getProperty(propertyName);
      if (propertyValue != null && !propertyValue.isBlank()) {
        return propertyValue.trim();
      }

      String envValue = System.getenv(envName);
      if (envValue != null && !envValue.isBlank()) {
        return envValue.trim();
      }

      return null;
    }

    private String normalizeTesseractPath(String configuredValue) {
      Path path = Path.of(configuredValue.trim()).normalize();
      Path fileName = path.getFileName();
      if (fileName != null) {
        String lastSegment = fileName.toString();
        if ("tesseract".equals(lastSegment) || "tesseract.exe".equalsIgnoreCase(lastSegment)) {
          Path parent = path.getParent();
          return parent == null ? "" : parent.toString();
        }
      }
      return path.toString();
    }
  }
}
