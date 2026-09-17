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
package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * {@link SearchClient#STALE_GUARDED_UPDATE_SCRIPT} exists so a writer that rebuilt a document from
 * an older read of the entity cannot overwrite a newer one already in the index — the retry worker
 * re-reads on claim, and a live update committed in between is already indexed.
 *
 * <p>Painless only runs on a real cluster, so these assertions pin the script's structure rather
 * than its execution: that it still applies the same field writes as the unguarded script, and that
 * the guard keeps the properties it was chosen for. End-to-end behaviour belongs in an integration
 * test against a live engine.
 */
class StaleGuardedUpdateScriptTest {

  @Test
  @DisplayName("guarded script applies exactly the writes the unguarded script does")
  void guardedScriptIsSupersetOfDefault() {
    String guarded = stripWhitespace(SearchClient.STALE_GUARDED_UPDATE_SCRIPT);
    String unguarded = stripWhitespace(SearchClient.DEFAULT_UPDATE_SCRIPT);

    assertTrue(
        guarded.contains(unguarded),
        "STALE_GUARDED_UPDATE_SCRIPT must wrap DEFAULT_UPDATE_SCRIPT verbatim so the two cannot "
            + "drift; update both together");
  }

  @Test
  @DisplayName("a stale write is a no-op rather than a partial write")
  void staleWriteIsNoop() {
    assertTrue(
        stripWhitespace(SearchClient.STALE_GUARDED_UPDATE_SCRIPT).contains("ctx.op='noop'"),
        "the else branch must no-op, otherwise a stale write silently falls through");
  }

  /**
   * {@code >=} keeps a replayed write idempotent. {@code >} would drop it, which matters because
   * the retry queue can redeliver the same failure.
   */
  @Test
  @DisplayName("equal timestamps still apply, so replays stay idempotent")
  void equalTimestampsApply() {
    String guarded = stripWhitespace(SearchClient.STALE_GUARDED_UPDATE_SCRIPT);

    assertTrue(guarded.contains("params.updatedAt>=ctx._source.updatedAt"));
    assertFalse(
        guarded.contains("params.updatedAt>ctx._source.updatedAt"),
        "a strict comparison would discard idempotent replays from the retry queue");
  }

  @Test
  @DisplayName("missing ordering information applies the write instead of discarding it")
  void missingTimestampsApply() {
    String guarded = stripWhitespace(SearchClient.STALE_GUARDED_UPDATE_SCRIPT);

    assertTrue(guarded.contains("ctx._source.updatedAt==null"));
    assertTrue(guarded.contains("params.updatedAt==null"));
  }

  private String stripWhitespace(String script) {
    return script.replaceAll("\\s+", "");
  }
}
