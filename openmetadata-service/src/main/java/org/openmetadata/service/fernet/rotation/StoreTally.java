/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.fernet.rotation;

import java.util.EnumMap;
import java.util.Map;

/**
 * What one store held: how many values hold a token, and how many tokens had each outcome.
 *
 * @param readable false when the store threw while it was read, so nothing can be said about it
 */
record StoreTally(String store, boolean readable, long values, Map<Outcome, Long> counts) {

  StoreTally {
    counts = Map.copyOf(counts);
  }

  static StoreTally unreadable(String store) {
    return new StoreTally(store, false, 0, Map.of());
  }

  long count(Outcome outcome) {
    return counts.getOrDefault(outcome, 0L);
  }

  /**
   * This tally with the re-encrypted and contended counts of {@code rewritePass} added. A value the
   * write failed on is not replaced, so the write pass may count more not-rewritable values than the
   * read after it; the larger count stands.
   */
  StoreTally withWrites(StoreTally rewritePass) {
    Map<Outcome, Long> merged = new EnumMap<>(Outcome.class);
    merged.putAll(counts);
    merged.put(Outcome.REKEYED, rewritePass.count(Outcome.REKEYED));
    merged.put(Outcome.CONTENDED, rewritePass.count(Outcome.CONTENDED));
    merged.put(
        Outcome.UNREWRITABLE,
        Math.max(count(Outcome.UNREWRITABLE), rewritePass.count(Outcome.UNREWRITABLE)));
    return new StoreTally(store, readable, values, merged);
  }
}
