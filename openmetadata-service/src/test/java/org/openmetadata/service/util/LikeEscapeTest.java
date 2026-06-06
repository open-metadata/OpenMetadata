/*
 *  Copyright 2025 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 */

package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;

class LikeEscapeTest {

  @Test
  void escape_nullReturnsNull() {
    assertNull(LikeEscape.escape(null));
  }

  @Test
  void escape_emptyReturnsEmpty() {
    assertEquals("", LikeEscape.escape(""));
  }

  @Test
  void escape_plainStringUnchanged() {
    assertEquals("svc.db.schema.table", LikeEscape.escape("svc.db.schema.table"));
  }

  @Test
  void escape_underscoreEscaped() {
    assertEquals("my!_table", LikeEscape.escape("my_table"));
  }

  @Test
  void escape_percentAndUnderscoreEscaped() {
    assertEquals("100!%!_growth", LikeEscape.escape("100%_growth"));
  }

  @Test
  void escape_bangDoubled() {
    // Bang is the escape character; it must be doubled first so the subsequent % and _
    // replacements don't introduce ambiguity with pre-existing bangs in the input.
    assertEquals("a!!b!_c", LikeEscape.escape("a!b_c"));
  }

  @Test
  void escape_backslashUnchanged() {
    // Backslash has no special meaning under ESCAPE '!', so it passes through as a literal.
    assertEquals("a\\b!_c", LikeEscape.escape("a\\b_c"));
  }
}
