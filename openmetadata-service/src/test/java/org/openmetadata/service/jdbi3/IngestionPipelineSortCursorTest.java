/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository.DisplayNameCursor;
import org.openmetadata.service.util.RestUtil;

/**
 * The keyset cursor for {@code sortField=displayName} carries the value of the SQL sort expression
 * {@code COALESCE(NULLIF(displayName,''), name)}, so Java has to reproduce it exactly.
 *
 * <p>Any disagreement is silent and data-dependent: the cursor is compared against the expression
 * with {@code >}/{@code =}, so a Java value one character off from the stored one skips or repeats a
 * row at a page boundary rather than failing. The value is carried whole — the expression is not
 * length-capped, so the cursor must not truncate either.
 */
class IngestionPipelineSortCursorTest {
  private static final IngestionPipelineRepository repository;

  static {
    // The real constructor registers the entity with the DAO-backed Entity registry; these helpers
    // are pure functions of their arguments, so call them on an otherwise-uninitialised instance.
    repository = mock(IngestionPipelineRepository.class);
    when(repository.displayNameCursorValue(Mockito.any())).thenCallRealMethod();
    when(repository.parseDisplayNameCursor(Mockito.anyString())).thenCallRealMethod();
    when(repository.parseCursorMap(Mockito.nullable(String.class))).thenCallRealMethod();
    when(repository.forwardBeforeCursor(Mockito.nullable(String.class), Mockito.any()))
        .thenCallRealMethod();
  }

  private IngestionPipeline pipeline(String name, String displayName) {
    return new IngestionPipeline()
        .withId(UUID.fromString("00000000-0000-0000-0000-000000000001"))
        .withName(name)
        .withDisplayName(displayName);
  }

  private String sortKeyOf(IngestionPipeline pipeline) {
    return repository
        .parseCursorMap(repository.displayNameCursorValue(pipeline))
        .get("displayNameSort");
  }

  @Test
  void test_sortKey_prefersDisplayNameOverName() {
    assertEquals("Alpha", sortKeyOf(pipeline("machine-generated-name", "Alpha")));
  }

  /** {@code NULLIF(displayName,'')} — an empty displayName is not a label, so the name wins. */
  @Test
  void test_sortKey_fallsBackToNameWhenDisplayNameIsEmpty() {
    assertEquals("n2", sortKeyOf(pipeline("n2", "")));
  }

  /** {@code COALESCE(...)} — the JSON key is absent entirely. */
  @Test
  void test_sortKey_fallsBackToNameWhenDisplayNameIsAbsent() {
    assertEquals("n1", sortKeyOf(pipeline("n1", null)));
  }

  @Test
  void test_sortKey_isEmptyWhenNeitherNameNorDisplayNameIsSet() {
    assertEquals("", sortKeyOf(pipeline(null, null)));
  }

  /**
   * The sort key is carried whole — no truncation. The SQL expression is not length-capped either,
   * so a long displayName's cursor must equal its full value or the keyset comparison skips a row.
   */
  @Test
  void test_sortKey_carriesLongDisplayNamesWhole() {
    String longName = "a".repeat(300);
    assertEquals(longName, sortKeyOf(pipeline("machine-name", longName)));
  }

  @Test
  void test_cursor_roundTripsThroughTheWireEncoding() {
    // U+1F600 is a surrogate pair — the full value, emoji included, must survive encode/decode.
    String longName = "a".repeat(255) + "😀" + "b";
    IngestionPipeline pipeline = pipeline("n7", longName);

    DisplayNameCursor parsed =
        repository.parseDisplayNameCursor(
            RestUtil.encodeCursor(repository.displayNameCursorValue(pipeline)));

    assertEquals(longName, parsed.displayName());
    assertEquals(pipeline.getId().toString(), parsed.id());
  }

  /**
   * A pipeline whose name and displayName are both empty has an empty sort key, which is a legal
   * cursor value — only a missing key is malformed.
   */
  @Test
  void test_cursor_acceptsAnEmptySortKey() {
    DisplayNameCursor parsed = repository.parseDisplayNameCursor(cursorOf("\"\"", "\"id-1\""));

    assertEquals("", parsed.displayName());
    assertEquals("id-1", parsed.id());
  }

  /**
   * The unsorted listing issues {@code (name, id)} cursors. Callers persist cursors, so one can
   * arrive here after the sort order that produced it was lost — it must be rejected rather than
   * fed to the keyset comparison, where a missing key binds as NULL and quietly matches no row.
   */
  @Test
  void test_cursor_rejectsACursorFromTheDefaultListing() {
    String defaultListingCursor =
        RestUtil.encodeCursor("{\"name\":\"some-pipeline\",\"id\":\"id-1\"}");

    assertThrows(
        BadRequestException.class, () -> repository.parseDisplayNameCursor(defaultListingCursor));
  }

  /**
   * A page can come back empty when the cursor was valid but every row past it was deleted
   * meanwhile; the caller's own cursor is echoed so navigation does not dead-end. {@link ResultList}
   * base64-encodes every cursor it is handed, and the echoed one arrived off the wire already
   * encoded — returning it as-is hands the client a double-encoded cursor that no later request can
   * parse.
   */
  @Test
  void test_emptyPage_echoesACursorTheClientCanUseAgain() {
    String wireCursor = RestUtil.encodeCursor("{\"displayNameSort\":\"Alpha\",\"id\":\"id-1\"}");

    String echoed = repository.forwardBeforeCursor(wireCursor, List.of());

    assertEquals(
        wireCursor,
        new ResultList<>(List.of(), echoed, null, 0).getPaging().getBefore(),
        "echoed cursor must survive ResultList's encoding unchanged");
  }

  @Test
  void test_emptyPage_echoesNothingOnAGenuineFirstPage() {
    assertNull(repository.forwardBeforeCursor(null, List.of()));
  }

  @Test
  void test_cursor_rejectsAMissingOrBlankId() {
    String noId = cursorOf("\"Alpha\"", null);
    String blankId = cursorOf("\"Alpha\"", "\"  \"");

    assertThrows(BadRequestException.class, () -> repository.parseDisplayNameCursor(noId));
    assertThrows(BadRequestException.class, () -> repository.parseDisplayNameCursor(blankId));
  }

  private String cursorOf(String displayNameSortJson, String idJson) {
    String json =
        idJson == null
            ? String.format("{\"displayNameSort\":%s}", displayNameSortJson)
            : String.format("{\"displayNameSort\":%s,\"id\":%s}", displayNameSortJson, idJson);
    return RestUtil.encodeCursor(json);
  }
}
