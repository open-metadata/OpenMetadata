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

package org.openmetadata.mcp.tools;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.openmetadata.mcp.util.PageCursor;

/**
 * Pins the keyset arm of the unified pagination contract. {@code get_test_definitions} pages with
 * the repository's native {@code listAfter} cursor, so the tool must surface {@code paging.after} as
 * an opaque keyset {@code nextCursor} (identical wire shape to the offset tools) while a last page
 * with no {@code after} emits neither {@code hasMore} nor {@code nextCursor}.
 */
class TestDefinitionsToolTest {

  @Test
  void nativeAfterBecomesKeysetNextCursorAndTotalSurfaces() {
    Map<String, Object> page = new HashMap<>();
    page.put("data", List.of(Map.of("name", "columnValuesToBeUnique")));
    page.put("paging", Map.of("after", "AFTER_TOKEN_123", "total", 42));

    TestDefinitionsTool.attachPagingContract(page);

    assertThat(page.get("total")).isEqualTo(42);
    assertThat(page.get("hasMore")).isEqualTo(Boolean.TRUE);
    Optional<PageCursor.Cursor> decoded = PageCursor.decode((String) page.get("nextCursor"));
    assertThat(decoded).isPresent();
    assertThat(decoded.get().isOffset()).isFalse();
    assertThat(decoded.get().after()).isEqualTo("AFTER_TOKEN_123");
  }

  @Test
  void lastPageWithoutAfterEmitsNoCursor() {
    Map<String, Object> page = new HashMap<>();
    Map<String, Object> paging = new HashMap<>();
    paging.put("total", 42);
    page.put("paging", paging);

    TestDefinitionsTool.attachPagingContract(page);

    assertThat(page).doesNotContainKey("nextCursor").doesNotContainKey("hasMore");
    assertThat(page.get("total")).isEqualTo(42);
  }
}
