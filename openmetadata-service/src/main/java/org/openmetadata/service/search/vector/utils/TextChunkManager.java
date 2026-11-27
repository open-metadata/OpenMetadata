package org.openmetadata.service.search.vector.utils;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.BitSet;
import java.util.HexFormat;
import java.util.List;
import lombok.extern.slf4j.Slf4j;

@Slf4j
public final class TextChunkManager {
  private static final int MAX_WORDS_PER_CHUNK = 380;
  private static final int MAX_WORD_LENGTH = 600;

  private TextChunkManager() {}

  public static List<String> chunk(String text) {
    return chunk(text, null);
  }

  /** Omits source characters from the output while keeping the original index chunk boundaries. */
  public static List<String> chunk(String text, BitSet omissions) {
    return text == null || text.isBlank() ? List.of("") : chunkWords(text, omissions);
  }

  private static List<String> chunkWords(String text, BitSet omissions) {
    String trimmed = text.trim();
    String[] words = trimmed.split("\\s+");
    boolean hasOmissions = omissions != null && !omissions.isEmpty();
    int nextWord = hasOmissions ? text.indexOf(trimmed) : 0;
    List<String> chunks = new ArrayList<>();
    StringBuilder current = new StringBuilder();
    int wordCount = 0;

    for (String word : words) {
      int start = hasOmissions ? text.indexOf(word, nextWord) : 0;
      nextWord = start + word.length();
      if (word.length() >= MAX_WORD_LENGTH) {
        continue;
      }
      if (wordCount >= MAX_WORDS_PER_CHUNK) {
        chunks.add(current.toString().trim());
        current = new StringBuilder();
        wordCount = 0;
      }
      appendWord(current, hasOmissions ? withoutOmissions(word, start, omissions) : word);
      wordCount++;
    }

    if (wordCount > 0) {
      chunks.add(current.toString().trim());
    }

    return chunks.isEmpty() ? List.of("") : chunks;
  }

  private static void appendWord(StringBuilder chunk, String word) {
    if (!word.isEmpty()) {
      if (!chunk.isEmpty()) {
        chunk.append(' ');
      }
      chunk.append(word);
    }
  }

  private static String withoutOmissions(String word, int start, BitSet omissions) {
    int firstOmission = omissions.nextSetBit(start);
    String result = word;
    if (firstOmission >= 0 && firstOmission < start + word.length()) {
      StringBuilder retained = new StringBuilder(word.length());
      for (int index = 0; index < word.length(); index++) {
        if (!omissions.get(start + index)) {
          retained.append(word.charAt(index));
        }
      }
      result = retained.toString();
    }
    return result;
  }

  public static String computeFingerprint(String text) {
    if (text == null || text.isEmpty()) {
      return "";
    }
    try {
      MessageDigest md = MessageDigest.getInstance("MD5");
      byte[] hash = md.digest(text.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(hash);
    } catch (NoSuchAlgorithmException e) {
      LOG.error("MD5 algorithm not available", e);
      return String.valueOf(text.hashCode());
    }
  }

  public static String buildSearchableText(
      String name,
      String displayName,
      String description,
      String fullyQualifiedName,
      List<String> tags,
      List<String> columnNames) {
    StringBuilder sb = new StringBuilder();
    appendField(sb, name);
    appendField(sb, displayName);
    appendField(sb, description);
    appendField(sb, fullyQualifiedName);
    if (tags != null) {
      for (String tag : tags) {
        appendField(sb, tag);
      }
    }
    if (columnNames != null) {
      for (String col : columnNames) {
        appendField(sb, col);
      }
    }
    return sb.toString().trim();
  }

  private static void appendField(StringBuilder sb, String field) {
    if (field != null && !field.isEmpty()) {
      if (!sb.isEmpty()) {
        sb.append(" ");
      }
      sb.append(field);
    }
  }
}
