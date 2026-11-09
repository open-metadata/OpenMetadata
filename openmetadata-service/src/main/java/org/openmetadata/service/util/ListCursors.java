package org.openmetadata.service.util;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import org.openmetadata.service.fernet.Fernet;

/**
 * Cursors of a listing whose rows are filtered per caller. Such a cursor can point at a row the
 * caller may not read, and a plain cursor spells out that row's name and id, so it is sealed with
 * the server's Fernet key. Where no key is configured cursors stay plain
 * (ADR:2026-11-03-a-listing-returns-only-rows-the-caller-may-read).
 */
public final class ListCursors {
  private static final String SEALED_PREFIX = "s.";

  private ListCursors() {}

  public static String seal(String cursor) {
    Fernet fernet = Fernet.getInstance();
    if (cursor == null || !fernet.isKeyDefined()) {
      return cursor;
    }
    return SEALED_PREFIX
        + Base64.getUrlEncoder()
            .withoutPadding()
            .encodeToString(fernet.encrypt(cursor).getBytes(StandardCharsets.UTF_8));
  }

  /** The plain cursor a sealed one stands for; any other cursor is returned as it is. */
  public static String unseal(String cursor) {
    if (cursor == null || !cursor.startsWith(SEALED_PREFIX)) {
      return cursor;
    }
    try {
      String token =
          new String(
              Base64.getUrlDecoder().decode(cursor.substring(SEALED_PREFIX.length())),
              StandardCharsets.UTF_8);
      return Fernet.getInstance().decrypt(token);
    } catch (RuntimeException e) {
      throw new IllegalArgumentException("Invalid paging cursor");
    }
  }
}
