package org.openmetadata.service.resources.drive;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.SQLException;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.ProcessingStatus;

class ContextFileResourceTest {

  // ------------------------------------------------------------------
  // sanitizeFileName
  // ------------------------------------------------------------------

  @Test
  void testSanitizeFileName_normalName() {
    assertEquals("report.pdf", ContextFileResource.sanitizeFileName("report.pdf"));
  }

  @Test
  void testSanitizeFileName_removesDoubleQuotes() {
    assertEquals("file_name_.pdf", ContextFileResource.sanitizeFileName("file\"name\".pdf"));
  }

  @Test
  void testSanitizeFileName_removesBackslashes() {
    assertEquals("path_to_file.txt", ContextFileResource.sanitizeFileName("path\\to\\file.txt"));
  }

  @Test
  void testSanitizeFileName_removesNewlines() {
    assertEquals("file_name.txt", ContextFileResource.sanitizeFileName("file\nname.txt"));
  }

  @Test
  void testSanitizeFileName_removesCarriageReturns() {
    assertEquals("file_name.txt", ContextFileResource.sanitizeFileName("file\rname.txt"));
  }

  @Test
  void testSanitizeFileName_combinedInjection() {
    assertEquals("a_b_c_d_e.txt", ContextFileResource.sanitizeFileName("a\"b\\c\rd\ne.txt"));
  }

  @Test
  void testSanitizeFileName_nullFallback() {
    assertEquals("download", ContextFileResource.sanitizeFileName(null));
  }

  @Test
  void testSanitizeFileName_blankFallback() {
    assertEquals("download", ContextFileResource.sanitizeFileName("   "));
  }

  // ------------------------------------------------------------------
  // isDuplicateKeyException
  // ------------------------------------------------------------------

  @Test
  void testIsDuplicateKeyException_detectsMySqlDuplicateCode() {
    SQLException mysqlDuplicate = new SQLException("Duplicate entry", "23000", 1062);

    assertTrue(ContextFileResource.isDuplicateKeyException(new RuntimeException(mysqlDuplicate)));
  }

  @Test
  void testIsDuplicateKeyException_detectsPostgresDuplicateState() {
    SQLException postgresDuplicate =
        new SQLException("duplicate key value violates unique constraint", "23505");

    assertTrue(
        ContextFileResource.isDuplicateKeyException(new RuntimeException(postgresDuplicate)));
  }

  @Test
  void testIsDuplicateKeyException_ignoresNonDuplicateSqlErrors() {
    SQLException connectionFailure = new SQLException("connection refused", "08001", 0);

    assertFalse(
        ContextFileResource.isDuplicateKeyException(new RuntimeException(connectionFailure)));
  }

  // ------------------------------------------------------------------
  // buildContentDisposition
  // ------------------------------------------------------------------

  @Test
  void testBuildContentDisposition_asciiName() {
    assertEquals(
        "attachment; filename=\"report.pdf\"; filename*=UTF-8''report.pdf",
        ContextFileResource.buildContentDisposition("report.pdf"));
  }

  @Test
  void testBuildContentDisposition_encodesUnicode() {
    // Non-ASCII characters must be percent-encoded per RFC 5987.
    assertEquals(
        "attachment; filename=\"héllo.txt\"; filename*=UTF-8''h%C3%A9llo.txt",
        ContextFileResource.buildContentDisposition("héllo.txt"));
  }

  @Test
  void testBuildContentDisposition_encodesSpacesAsPercent20() {
    assertEquals(
        "attachment; filename=\"my file.txt\"; filename*=UTF-8''my%20file.txt",
        ContextFileResource.buildContentDisposition("my file.txt"));
  }

  @Test
  void testBuildContentDisposition_stripsInjectionCharacters() {
    assertEquals(
        "attachment; filename=\"_evil_.txt\"; filename*=UTF-8''_evil_.txt",
        ContextFileResource.buildContentDisposition("\"evil\".txt"));
  }

  // ------------------------------------------------------------------
  // clampExpiry
  // ------------------------------------------------------------------

  @Test
  void testClampExpiry_normalValue() {
    assertEquals(300, ContextFileResource.clampExpiry(300));
  }

  @Test
  void testClampExpiry_zeroClampedToOne() {
    assertEquals(1, ContextFileResource.clampExpiry(0));
  }

  @Test
  void testClampExpiry_negativeClampedToOne() {
    assertEquals(1, ContextFileResource.clampExpiry(-100));
  }

  @Test
  void testClampExpiry_exactMax() {
    assertEquals(3600, ContextFileResource.clampExpiry(3600));
  }

  @Test
  void testClampExpiry_exceedsMaxClampedToMax() {
    assertEquals(3600, ContextFileResource.clampExpiry(999999999));
  }

  @Test
  void testClampExpiry_intMaxClampedToMax() {
    assertEquals(3600, ContextFileResource.clampExpiry(Integer.MAX_VALUE));
  }

  // ------------------------------------------------------------------
  // shouldResubmitExtraction
  //
  // A file soft-deleted while extraction was in flight (or before it even started) can be
  // restored with processingStatus stuck at a non-terminal value, because the async
  // extraction thread's write is silently dropped once it detects the concurrent delete
  // (see ContextFileExtractionService.updateFile). Restore must re-submit extraction in
  // that case so the file doesn't get permanently stuck.
  // ------------------------------------------------------------------

  @Test
  void testShouldResubmitExtraction_stuckAtUploaded() {
    ContextFile file = restoredFileWith(ProcessingStatus.Uploaded);

    assertTrue(ContextFileResource.shouldResubmitExtraction(file));
  }

  @Test
  void testShouldResubmitExtraction_stuckAtAnalyzing() {
    ContextFile file = restoredFileWith(ProcessingStatus.Analyzing);

    assertTrue(ContextFileResource.shouldResubmitExtraction(file));
  }

  @Test
  void testShouldResubmitExtraction_terminalProcessed() {
    ContextFile file = restoredFileWith(ProcessingStatus.Processed);

    assertFalse(ContextFileResource.shouldResubmitExtraction(file));
  }

  @Test
  void testShouldResubmitExtraction_terminalFailed() {
    ContextFile file = restoredFileWith(ProcessingStatus.Failed);

    assertFalse(ContextFileResource.shouldResubmitExtraction(file));
  }

  @Test
  void testShouldResubmitExtraction_terminalUnsupported() {
    ContextFile file = restoredFileWith(ProcessingStatus.Unsupported);

    assertFalse(ContextFileResource.shouldResubmitExtraction(file));
  }

  @Test
  void testShouldResubmitExtraction_noHeadContentIdNeverResubmits() {
    ContextFile file =
        new ContextFile()
            .withId(UUID.randomUUID())
            .withProcessingStatus(ProcessingStatus.Analyzing);
    file.setHeadContentId(null);

    assertFalse(ContextFileResource.shouldResubmitExtraction(file));
  }

  private static ContextFile restoredFileWith(ProcessingStatus processingStatus) {
    return new ContextFile()
        .withId(UUID.randomUUID())
        .withProcessingStatus(processingStatus)
        .withHeadContentId(UUID.randomUUID().toString());
  }
}
