package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.fernet.Fernet;

class ListCursorsTest {
  private static final String CURSOR =
      Base64.getUrlEncoder()
          .encodeToString(
              "{\"name\":\"hidden_row\",\"id\":\"1\"}".getBytes(StandardCharsets.UTF_8));

  @BeforeEach
  void setKey() {
    Fernet.getInstance().setFernetKey("GhtAEzEb5WD6bTLvwa24JA6ePHxfVLDjb8X4hMShmVY=");
  }

  @AfterEach
  void clearKey() {
    Fernet.getInstance().setFernetKey((String) null);
  }

  @Test
  void aSealedCursorCarriesNoRowAndUnsealsToTheOriginal() {
    String sealed = ListCursors.seal(CURSOR);

    assertTrue(sealed.startsWith("s."), sealed);
    assertFalse(sealed.contains(CURSOR));
    assertEquals(CURSOR, ListCursors.unseal(sealed));
  }

  @Test
  void aPlainCursorPassesThroughUnseal() {
    assertEquals(CURSOR, ListCursors.unseal(CURSOR));
    assertNull(ListCursors.unseal(null));
  }

  @Test
  void aTamperedCursorIsRefused() {
    String sealed = ListCursors.seal(CURSOR);
    assertThrows(
        IllegalArgumentException.class,
        () -> ListCursors.unseal(sealed.substring(0, sealed.length() - 4) + "AAAA"));
  }
}
