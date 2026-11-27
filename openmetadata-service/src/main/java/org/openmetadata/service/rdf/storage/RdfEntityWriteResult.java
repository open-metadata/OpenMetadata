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

package org.openmetadata.service.rdf.storage;

import java.util.Locale;
import java.util.Objects;

/** What one entity write did to the store. */
public record RdfEntityWriteResult(Outcome outcome, long deletedTriples, long insertedTriples) {
  public static final RdfEntityWriteResult UNCHANGED = new RdfEntityWriteResult(Outcome.UNCHANGED);
  public static final RdfEntityWriteResult REPLACED = new RdfEntityWriteResult(Outcome.REPLACED);
  public static final RdfEntityWriteResult CORRECTED = new RdfEntityWriteResult(Outcome.CORRECTED);

  public enum Outcome {
    /** The store already held the projection; nothing was sent. */
    UNCHANGED,
    /** Only the triples that differed were deleted and inserted. */
    CHANGED_TRIPLES,
    /** The projection was replaced whole. */
    REPLACED,
    /**
     * The difference was sent, but the projection read back afterwards differed: a write queued
     * ahead of it had committed in between, so the projection was then replaced whole.
     */
    CORRECTED;

    public String tag() {
      return name().toLowerCase(Locale.ROOT);
    }
  }

  public RdfEntityWriteResult {
    Objects.requireNonNull(outcome, "outcome");
  }

  private RdfEntityWriteResult(final Outcome outcome) {
    this(outcome, 0, 0);
  }

  public static RdfEntityWriteResult changedTriples(final long deleted, final long inserted) {
    return new RdfEntityWriteResult(Outcome.CHANGED_TRIPLES, deleted, inserted);
  }

  /** Whether the write may have changed the graph, so derived state must be refreshed. */
  public boolean changesGraph() {
    return outcome != Outcome.UNCHANGED;
  }
}
