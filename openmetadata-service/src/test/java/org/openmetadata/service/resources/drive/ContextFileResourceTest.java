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
