package org.openmetadata.service.search.vector.utils;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import lombok.extern.slf4j.Slf4j;

@Slf4j
public final class TextChunkManager {
  private static final int MAX_WORDS_PER_CHUNK = 380;
  private static final int MAX_WORD_LENGTH = 600;

  private TextChunkManager() {}

  public static List<String> chunk(String text) {
    if (text == null || text.isBlank()) {
      return List.of("");
    }

    String[] words = text.trim().split("\\s+");
    List<String> chunks = new ArrayList<>();
    StringBuilder current = new StringBuilder();
    int wordCount = 0;

    for (String word : words) {
      if (word.length() >= MAX_WORD_LENGTH) {
        continue;
      }
      if (wordCount >= MAX_WORDS_PER_CHUNK) {
        chunks.add(current.toString().trim());
        current = new StringBuilder();
        wordCount = 0;
      }
      if (!current.isEmpty()) {
        current.append(' ');
      }
      current.append(word);
      wordCount++;
    }

    if (!current.isEmpty()) {
      chunks.add(current.toString().trim());
    }

    return chunks.isEmpty() ? List.of("") : chunks;
  }

  public static String computeFingerprint(String text) {
    if (text == null || text.isEmpty()) {
      return "";
    }
    try {
      MessageDigest md = MessageDigest.getInstance("MD5");
      byte[] hash = md.digest(text.getBytes());
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
