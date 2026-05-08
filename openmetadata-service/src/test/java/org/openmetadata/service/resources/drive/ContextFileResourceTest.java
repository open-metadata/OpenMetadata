package org.openmetadata.service.resources.drive;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

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
}
