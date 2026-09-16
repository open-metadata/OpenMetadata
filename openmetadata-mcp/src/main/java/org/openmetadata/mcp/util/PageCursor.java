package org.openmetadata.mcp.util;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Opaque page-cursor codec shared by the paginating MCP read tools. A cursor is the base64 of a tiny
 * JSON tag ({@code {"t":"o","v":60}} for an offset page, {@code {"t":"k","v":"<afterId>"}} for a
 * keyset page). Tools hand the encoded string back as {@code nextCursor}; the LLM client echoes it
 * verbatim on the next call. Because the client never inspects the token, each tool can carry
 * whatever paging state is correct for it (ES {@code from} offset, repository {@code listAfter} id)
 * behind one uniform wire field.
 *
 * <p>{@link #decode} never throws: a null, blank or malformed token yields {@link Optional#empty()}
 * so the tool falls back to the first page rather than surfacing an error the client cannot act on.
 */
@Slf4j
public final class PageCursor {

  private static final String TYPE_KEY = "t";
  private static final String VALUE_KEY = "v";
  private static final String OFFSET_TAG = "o";
  private static final String KEYSET_TAG = "k";

  private PageCursor() {}

  /** Paging mechanism a decoded cursor represents. */
  public enum Kind {
    OFFSET,
    KEYSET
  }

  /**
   * Decoded cursor. {@code offset} is meaningful only for {@link Kind#OFFSET}; {@code after} only for
   * {@link Kind#KEYSET}. Use {@link #isOffset()} to branch.
   */
  public record Cursor(Kind kind, int offset, String after) {
    public boolean isOffset() {
      return kind == Kind.OFFSET;
    }
  }

  /** Encodes an offset page (start index of the next page). */
  public static String encodeOffset(int from) {
    return encode(OFFSET_TAG, from);
  }

  /** Encodes a keyset page (the repository {@code after} id for the next page). */
  public static String encodeKeyset(String after) {
    return encode(KEYSET_TAG, after);
  }

  /** Decodes a token to a cursor, or empty when the token is absent or unusable. */
  public static Optional<Cursor> decode(String token) {
    Optional<Cursor> result = Optional.empty();
    if (token != null && !token.isBlank()) {
      result = tryDecode(token);
    }
    return result;
  }

  private static Optional<Cursor> tryDecode(String token) {
    Optional<Cursor> result = Optional.empty();
    try {
      byte[] raw = Base64.getUrlDecoder().decode(token);
      Map<String, Object> map =
          JsonUtils.readValue(new String(raw, StandardCharsets.UTF_8), Map.class);
      result = fromMap(map);
    } catch (Exception ex) {
      LOG.debug("Ignoring malformed page cursor '{}': {}", token, ex.getMessage());
    }
    return result;
  }

  private static Optional<Cursor> fromMap(Map<String, Object> map) {
    Optional<Cursor> result = Optional.empty();
    Object type = map.get(TYPE_KEY);
    Object value = map.get(VALUE_KEY);
    if (OFFSET_TAG.equals(type) && value instanceof Number number) {
      result = Optional.of(new Cursor(Kind.OFFSET, number.intValue(), null));
    } else if (KEYSET_TAG.equals(type) && value instanceof String after) {
      result = Optional.of(new Cursor(Kind.KEYSET, 0, after));
    }
    return result;
  }

  private static String encode(String type, Object value) {
    String json = JsonUtils.pojoToJson(Map.of(TYPE_KEY, type, VALUE_KEY, value));
    return Base64.getUrlEncoder()
        .withoutPadding()
        .encodeToString(json.getBytes(StandardCharsets.UTF_8));
  }
}
