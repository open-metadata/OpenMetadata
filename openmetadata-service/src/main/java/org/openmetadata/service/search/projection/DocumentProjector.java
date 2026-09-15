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
package org.openmetadata.service.search.projection;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.service.search.indexes.DocBuildContext;
import org.openmetadata.service.search.indexes.SearchIndex;

/**
 * Projects a document through a {@link FieldMask}, honouring {@link FieldOwnership}.
 *
 * <p>Deliberately built on top of the existing {@code buildSearchIndexDoc(ctx)} rather than replacing
 * it: rewriting the doc builders and mixins is an explicit non-goal, and one definition of the
 * document is the point. This narrows the result to the masked paths and drops paths the caller has no
 * authority to write.
 *
 * <p>Correctness never depends on a tight mask. A mask that is wider than necessary costs work; one
 * that is narrower than the truth is a bug, and it is the projection parity property test — not this
 * class — that catches it.
 */
public final class DocumentProjector {

  /** Ownerships a routine rebuild may write: derived fields only, per §5's rule. */
  public static final Set<FieldOwnership> REBUILD_AUTHORITY = Set.of(FieldOwnership.DERIVED);

  private final ProjectionSpec spec;
  private final List<DocInvariant> invariants;

  public DocumentProjector(ProjectionSpec spec) {
    this(spec, List.of(TagDocInvariant.INSTANCE));
  }

  public DocumentProjector(ProjectionSpec spec, List<DocInvariant> invariants) {
    this.spec = spec;
    this.invariants = List.copyOf(invariants);
  }

  /**
   * Builds the document and retains the masked paths plus {@link ProjectionSpec#alwaysProjected()}.
   *
   * @param authority which ownerships this caller may write. A rebuild that does not hold a fenced
   *     path's ordinal must not pass {@link FieldOwnership#FENCED}, or it will overwrite state it
   *     cannot reconstruct — which is the failure this whole taxonomy exists to prevent.
   */
  public Map<String, Object> project(
      SearchIndex index, DocBuildContext ctx, FieldMask mask, Set<FieldOwnership> authority) {
    Map<String, Object> full = index.buildSearchIndexDoc(ctx);

    // Invariants run before narrowing: tier is a function of tags, so it must be recomputed from
    // the
    // tags this write produced, not left describing the previous ones.
    for (DocInvariant invariant : invariants) {
      if (invariant.appliesTo(mask)) {
        invariant.applyJava(full);
      }
    }

    Map<String, Object> projected = new LinkedHashMap<>();
    for (Map.Entry<String, Object> entry : full.entrySet()) {
      String path = entry.getKey();
      boolean retained = mask.covers(path) || spec.alwaysProjected().contains(path);
      if (retained && authority.contains(spec.ownershipOf(path))) {
        projected.put(path, entry.getValue());
      }
    }
    return projected;
  }

  /** Full authoritative rebuild of every derived path. */
  public Map<String, Object> projectAll(SearchIndex index, DocBuildContext ctx) {
    return project(index, ctx, FieldMask.all(), REBUILD_AUTHORITY);
  }

  /**
   * Paths this projector would refuse to write for {@code authority} — the ones a caller has to
   * splice forward or leave alone. Exposed so a writer can assert it is preserving them rather than
   * discovering later that it dropped them.
   */
  public Set<String> unwritablePaths(Map<String, Object> fullDoc, Set<FieldOwnership> authority) {
    return fullDoc.keySet().stream()
        .filter(path -> !authority.contains(spec.ownershipOf(path)))
        .collect(java.util.stream.Collectors.toUnmodifiableSet());
  }
}
