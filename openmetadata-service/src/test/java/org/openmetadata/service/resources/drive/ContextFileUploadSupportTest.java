package org.openmetadata.service.resources.drive;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.openmetadata.schema.attachments.Asset;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.ContextFileContent;
import org.openmetadata.schema.entity.data.ContextFileType;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ContextFileUploadSupportTest {

  @Test
  void detectFileTypeUsesMimeMappings() {
    assertEquals(ContextFileType.PDF, ContextFileUploadSupport.detectFileType("application/pdf"));
    assertEquals(
        ContextFileType.Spreadsheet,
        ContextFileUploadSupport.detectFileType(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
    assertEquals(ContextFileType.Image, ContextFileUploadSupport.detectFileType("image/png"));
    assertEquals(ContextFileType.CSV, ContextFileUploadSupport.detectFileType("text/csv"));
    assertEquals(
        ContextFileType.Other, ContextFileUploadSupport.detectFileType("application/octet-stream"));
  }

  @Test
  void sanitizeEntityNameProducesBoundedUniqueName() {
    String name = ContextFileUploadSupport.sanitizeEntityName("Quarterly Report (Final).pdf");
    assertTrue(name.startsWith("quarterly_report_final_.pdf_"));
    assertTrue(name.length() <= 189);
  }

  @Test
  void exceedsMaxFileSizeHonorsConfiguredLimit() {
    assertTrue(ContextFileUploadSupport.exceedsMaxFileSize(1025, 1024));
    assertTrue(!ContextFileUploadSupport.exceedsMaxFileSize(1024, 1024));
    assertTrue(!ContextFileUploadSupport.exceedsMaxFileSize(2048, 0));
  }

  @Test
  void buildAssetAndContentCarryCanonicalFileIdentity() {
    ContextFile file =
        new ContextFile()
            .withId(UUID.randomUUID())
            .withName("q1-report")
            .withFullyQualifiedName("finance.q1-report");
    byte[] bytes = "hello world".getBytes(StandardCharsets.UTF_8);

    Asset asset =
        ContextFileUploadSupport.buildAsset(
            file, "Q1 Report.pdf", "application/pdf", "pdf", bytes.length, "admin");
    ContextFileContent content =
        ContextFileUploadSupport.buildContent(
            file, asset, ContextFileUploadSupport.sha256(bytes), "admin");

    assertNotNull(asset.getId());
    assertEquals("<#E::contextFile::finance.q1-report>", asset.getEntityLink());
    assertEquals(file.getEntityReference(), content.getContextFile());
    assertEquals(asset.getId(), content.getAssetId());
    assertEquals(ContextFileUploadSupport.sha256(bytes), content.getChecksum());
    assertTrue(content.getName().startsWith("q1-report_content_"));
  }

  @Test
  void bufferUploadStreamsToTempFileAndComputesChecksum() throws Exception {
    byte[] bytes = "streamed payload".getBytes(StandardCharsets.UTF_8);

    try (ContextFileUploadSupport.BufferedUpload bufferedUpload =
        ContextFileUploadSupport.bufferUpload(new ByteArrayInputStream(bytes), 1024)) {
      assertEquals(bytes.length, bufferedUpload.getSize());
      assertEquals(ContextFileUploadSupport.sha256(bytes), bufferedUpload.getChecksum());
      try (var inputStream = bufferedUpload.newInputStream()) {
        assertArrayEquals(bytes, inputStream.readAllBytes());
      }
    }
  }

  @Test
  void bufferUploadRejectsOversizedFiles() {
    byte[] bytes = "too-large".getBytes(StandardCharsets.UTF_8);

    ContextFileUploadSupport.MaxFileSizeExceededException ex =
        assertThrows(
            ContextFileUploadSupport.MaxFileSizeExceededException.class,
            () -> ContextFileUploadSupport.bufferUpload(new ByteArrayInputStream(bytes), 3));

    assertEquals(bytes.length, ex.getActualSize());
    assertEquals(3, ex.getMaxFileSize());
  }
}
