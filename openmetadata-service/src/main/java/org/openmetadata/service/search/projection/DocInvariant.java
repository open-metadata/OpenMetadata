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

import java.util.Map;
import java.util.Set;

/**
 * A rule where some document fields are a function of <em>other document fields</em>.
 *
 * <p>The motivating case is tags: {@code tier}, {@code classificationTags} and {@code glossaryTags}
 * are all derived from {@code tags}. Today that rule exists twice and is kept in sync by hand — the
 * javadoc on {@code SearchClient.TAG_RESEPARATION_SCRIPT} asks authors to remember to append the
 * painless snippet to every script that mutates {@code tags}, and notes that the conditional {@code
 * tier} assignment was discovered by a Playwright test after the fact. Anything held together by
 * remembering will eventually not be.
 *
 * <p>Two renderings of one rule is unavoidable: painless cannot call Java, and update-by-query is the
 * only way to touch a million children without reading them. This does not pretend otherwise. What it
 * changes is that the pair is declared together, applied structurally, and asserted equal by a test —
 * the projector runs {@link #applyJava} for every invariant intersecting the mask, and the writer
 * appends {@link #painlessPostlude} for every invariant intersecting the touched paths. Forgetting
 * becomes impossible because nobody appends anything by hand.
 */
public interface DocInvariant {

  /** Document paths whose change triggers this invariant. */
  Set<String> dependsOn();

  /** Document paths this invariant computes. */
  Set<String> produces();

  /** Recompute {@link #produces} in place. Delegates to the same code the rebuild path uses. */
  void applyJava(Map<String, Object> doc);

  /** The painless equivalent, appended to any script touching {@link #dependsOn}. */
  String painlessPostlude();

  /** Whether this invariant is implicated by a write covering {@code mask}. */
  default boolean appliesTo(FieldMask mask) {
    return dependsOn().stream().anyMatch(mask::covers);
  }
}
