package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.openmetadata.service.search.vector.utils.TextChunkManager;

class EmbeddingModelChangeDetectionTest {

  @Test
  void testFingerprintStableForSameInput() {
    String text = "This is a test entity description";
    String fp1 = TextChunkManager.computeFingerprint(text);
    String fp2 = TextChunkManager.computeFingerprint(text);

    assertEquals(fp1, fp2);
  }

  @Test
  void testFingerprintDiffersForDifferentInput() {
    String fp1 = TextChunkManager.computeFingerprint("text version 1");
    String fp2 = TextChunkManager.computeFingerprint("text version 2");

    assertNotEquals(fp1, fp2);
  }

  @Test
  void testFingerprintHandlesNull() {
    String fp = TextChunkManager.computeFingerprint(null);
    assertTrue(fp.isEmpty());
  }

  @Test
  void testFingerprintHandlesEmpty() {
    String fp = TextChunkManager.computeFingerprint("");
    assertTrue(fp.isEmpty());
  }

  @Test
  void testChunkingSmallText() {
    var chunks = TextChunkManager.chunk("small text");
    assertEquals(1, chunks.size());
    assertEquals("small text", chunks.getFirst());
  }

  @Test
  void testChunkingLargeText() {
    StringBuilder sb = new StringBuilder();
    for (int i = 0; i < 500; i++) {
      sb.append("word ");
    }
    var chunks = TextChunkManager.chunk(sb.toString());
    assertTrue(chunks.size() > 1);
  }

  @Test
  void testChunkingNullReturnsEmptyList() {
    var chunks = TextChunkManager.chunk(null);
    assertEquals(1, chunks.size());
    assertEquals("", chunks.getFirst());
  }

  @Test
  void testChunkingBlankReturnsEmptyList() {
    var chunks = TextChunkManager.chunk("   ");
    assertEquals(1, chunks.size());
    assertEquals("", chunks.getFirst());
  }

  @Test
  void testChunkingSkipsLongWords() {
    String longWord = "a".repeat(700);
    var chunks = TextChunkManager.chunk("hello " + longWord + " world");
    assertEquals(1, chunks.size());
    assertTrue(chunks.getFirst().contains("hello"));
    assertTrue(chunks.getFirst().contains("world"));
    assertFalse(chunks.getFirst().contains(longWord));
  }

  @Test
  void testBuildSearchableText() {
    String text =
        TextChunkManager.buildSearchableText(
            "test_table",
            "Test Table",
            "A test table description",
            "service.db.schema.test_table",
            java.util.List.of("PII.Sensitive"),
            java.util.List.of("id", "name", "email"));

    assertTrue(text.contains("test_table"));
    assertTrue(text.contains("Test Table"));
    assertTrue(text.contains("A test table description"));
    assertTrue(text.contains("PII.Sensitive"));
    assertTrue(text.contains("email"));
  }
}
