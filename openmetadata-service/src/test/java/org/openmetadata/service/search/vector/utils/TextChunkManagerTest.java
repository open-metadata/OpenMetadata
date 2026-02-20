package org.openmetadata.service.search.vector.utils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import java.util.List;
import org.junit.jupiter.api.Test;

class TextChunkManagerTest {

  @Test
  void testNullInputReturnsSingleBlankChunk() {
    List<String> result = TextChunkManager.chunk(null);
    assertEquals(1, result.size());
    assertEquals("", result.get(0));
  }

  @Test
  void testEmptyInputReturnsSingleBlankChunk() {
    List<String> result = TextChunkManager.chunk("");
    assertEquals(1, result.size());
    assertEquals("", result.get(0));
  }

  @Test
  void testWhitespaceInputReturnsSingleBlankChunk() {
    List<String> result = TextChunkManager.chunk("     ");
    assertEquals(1, result.size());
    assertEquals("", result.get(0));
  }

  @Test
  void testSingleShortChunk() {
    String text = "foo bar baz";
    List<String> result = TextChunkManager.chunk(text);
    assertEquals(1, result.size());
    assertEquals("foo bar baz", result.get(0));
  }

  @Test
  void testSplitsIntoMultipleChunksByWordLimit() {
    StringBuilder sb = new StringBuilder();
    for (int i = 0; i < 800; i++) {
      sb.append("word").append(" ");
    }
    List<String> result = TextChunkManager.chunk(sb.toString());
    assertEquals(3, result.size());
    assertEquals(380, result.get(0).split("\\s+").length);
    assertEquals(380, result.get(1).split("\\s+").length);
    assertEquals(40, result.get(2).split("\\s+").length);
  }

  @Test
  void testSkipsLongTokens() {
    String normal = "foo";
    String longToken = "x".repeat(601);
    String input = String.join(" ", normal, longToken, normal, normal);
    List<String> result = TextChunkManager.chunk(input);
    assertEquals(1, result.size());
    assertEquals("foo foo foo", result.get(0));
  }

  @Test
  void testHandlesTextWithExactlyWordLimit() {
    StringBuilder sb = new StringBuilder();
    for (int i = 0; i < 380; i++) sb.append("a ");
    String input = sb.toString();
    List<String> result = TextChunkManager.chunk(input);
    assertEquals(1, result.size());
    assertEquals(380, result.get(0).split("\\s+").length);
  }

  @Test
  void testTrimsResultingChunks() {
    String input = "   hello   world   ";
    List<String> result = TextChunkManager.chunk(input);
    assertEquals(1, result.size());
    assertEquals("hello world", result.get(0));
  }

  @Test
  void testAllTokensTooLongReturnsFallbackChunk() {
    String s = "a".repeat(601) + " " + "b".repeat(601) + " " + "c".repeat(601);
    List<String> chunks = TextChunkManager.chunk(s);
    assertEquals(1, chunks.size());
    assertEquals("", chunks.get(0));
  }

  @Test
  void testChunkHandlesVeryLongText() {
    StringBuilder sb = new StringBuilder();
    for (int i = 0; i < 5000; i++) sb.append("token").append(" ");
    List<String> result = TextChunkManager.chunk(sb.toString());

    assertEquals(14, result.size());
    for (int i = 0; i < 13; i++) {
      assertEquals(
          380, result.get(i).split("\\s+").length, "Chunk " + i + " should have 380 words");
    }
    assertEquals(60, result.get(13).split("\\s+").length, "Last chunk should have 60 words");
  }

  @Test
  void testComputeFingerprint() {
    String fingerprint = TextChunkManager.computeFingerprint("hello world");
    assertFalse(fingerprint.isEmpty());
    assertEquals(fingerprint, TextChunkManager.computeFingerprint("hello world"));
  }

  @Test
  void testComputeFingerprintNullAndEmpty() {
    assertEquals("", TextChunkManager.computeFingerprint(null));
    assertEquals("", TextChunkManager.computeFingerprint(""));
  }
}
