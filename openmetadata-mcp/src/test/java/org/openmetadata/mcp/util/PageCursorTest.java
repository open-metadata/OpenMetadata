/*
 *  Copyright 2025 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.mcp.util;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.openmetadata.mcp.util.PageCursor.Cursor;

/**
 * Pins the opaque page-cursor codec. The token is an implementation detail the client only echoes,
 * so the guarantees under test are: an encoded offset/keyset round-trips to the same value, and any
 * unusable token (null, blank, non-base64, base64 of non-cursor JSON) decodes to empty so the tool
 * safely restarts at the first page instead of throwing at the caller.
 */
class PageCursorTest {

  @Test
  void offsetTokenRoundTrips() {
    Optional<Cursor> decoded = PageCursor.decode(PageCursor.encodeOffset(60));

    assertThat(decoded).isPresent();
    assertThat(decoded.get().isOffset()).isTrue();
    assertThat(decoded.get().offset()).isEqualTo(60);
  }

  @Test
  void keysetTokenRoundTrips() {
    Optional<Cursor> decoded = PageCursor.decode(PageCursor.encodeKeyset("svc.db.orders.id"));

    assertThat(decoded).isPresent();
    assertThat(decoded.get().isOffset()).isFalse();
    assertThat(decoded.get().after()).isEqualTo("svc.db.orders.id");
  }

  @Test
  void tokenIsOpaqueAndDoesNotLeakPlaintext() {
    String token = PageCursor.encodeOffset(60);

    assertThat(token).doesNotContain("offset").doesNotContain("60");
  }

  @Test
  void decodeNullOrBlankReturnsEmpty() {
    assertThat(PageCursor.decode(null)).isEmpty();
    assertThat(PageCursor.decode("")).isEmpty();
    assertThat(PageCursor.decode("   ")).isEmpty();
  }

  @Test
  void decodeGarbageReturnsEmpty() {
    assertThat(PageCursor.decode("!!!not-base64!!!")).isEmpty();
    assertThat(PageCursor.decode(java.util.Base64.getUrlEncoder().encodeToString("hi".getBytes())))
        .isEmpty();
  }

  @Test
  void decodeCursorMissingTypeReturnsEmpty() {
    String bad =
        java.util.Base64.getUrlEncoder().withoutPadding().encodeToString("{\"v\":5}".getBytes());

    assertThat(PageCursor.decode(bad)).isEmpty();
  }
}
