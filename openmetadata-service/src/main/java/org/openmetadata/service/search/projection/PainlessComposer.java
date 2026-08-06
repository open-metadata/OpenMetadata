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

import java.util.List;
import java.util.Set;

/**
 * Builds an update script from what it touches, appending every invariant that follows.
 *
 * <p>This replaces remembering. The javadoc on {@code SearchClient.TAG_RESEPARATION_SCRIPT} asks
 * authors to paste it onto every script that mutates {@code tags[]} so the live path reproduces the tag
 * separation the rebuild produces — and records that the conditional {@code tier} assignment was
 * discovered by a Playwright test after the fact. A caller here declares the paths it writes and the
 * consequences are derived, so a new tag-mutating script cannot be written without them.
 *
 * <p>The invariant list is the same one the projector applies in Java, so the two renderings stay in
 * step by construction rather than by review.
 *
 * <p><b>Not usable from {@code SearchClient}'s own constants.</b> Those are compile-time strings, and
 * {@link TagDocInvariant#painlessPostlude()} reads {@code SearchClient.TAG_RESEPARATION_SCRIPT}, so
 * composing them here would make the class initialise against itself. Moving the canonical script text
 * out of {@code SearchClient} and into the invariant is what unblocks those five call sites, and it
 * belongs with the rest of phase 5 rather than bolted on ahead of it.
 */
public final class PainlessComposer {

  private static final List<DocInvariant> INVARIANTS = List.of(TagDocInvariant.INSTANCE);

  private PainlessComposer() {}

  /**
   * Appends the postlude of every invariant depending on a path this script writes.
   *
   * @param body the script's own statements
   * @param writtenPaths document paths {@code body} mutates — {@code tags} for a tag cascade
   */
  public static String compose(String body, Set<String> writtenPaths) {
    StringBuilder script = new StringBuilder(body);
    for (DocInvariant invariant : INVARIANTS) {
      if (invariant.dependsOn().stream().anyMatch(writtenPaths::contains)) {
        script.append(invariant.painlessPostlude());
      }
    }
    return script.toString();
  }

  /** Convenience for the common case: a script that rewrites {@code tags[]}. */
  public static String composeForTagWrite(String body) {
    return compose(body, Set.of("tags"));
  }

  /**
   * Paths a script writing {@code writtenPaths} cannot keep correct, because no painless can compute
   * them — see {@link ProjectionSpec#requiresReprojection()}. A cascade reaching these has to reproject
   * the affected documents instead of scripting them.
   */
  public static Set<String> unmaintainablePaths(ProjectionSpec spec, Set<String> writtenPaths) {
    FieldMask mask = FieldMask.of(writtenPaths);
    return spec.requiresReprojection().stream()
        .filter(path -> spec.docPathsFor("tags").contains(path) || mask.covers(path))
        .collect(java.util.stream.Collectors.toUnmodifiableSet());
  }
}
