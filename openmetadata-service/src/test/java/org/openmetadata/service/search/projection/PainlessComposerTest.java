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

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.search.SearchClient;

/** Composition has to produce exactly what hand-appending produced, or it is a behaviour change. */
class PainlessComposerTest {

  private static final String BODY = "ctx._source.tags.add(params.newTag);\n";

  @Test
  @DisplayName("composing a tag write equals appending the postlude by hand")
  void tagWriteMatchesHandAppendedScript() {
    // The three call sites in SearchRepository previously read `body + TAG_RESEPARATION_SCRIPT`.
    // Byte equality is the whole safety argument for having replaced them.
    assertThat(PainlessComposer.composeForTagWrite(BODY))
        .isEqualTo(BODY + SearchClient.TAG_RESEPARATION_SCRIPT);
  }

  @Test
  @DisplayName("a script that does not write tags gets no postlude")
  void unrelatedWriteGetsNothingAppended() {
    String body = "ctx._source.description = params.description;";
    assertThat(PainlessComposer.compose(body, Set.of("description"))).isEqualTo(body);
  }

  @Test
  @DisplayName("declaring the path is what pulls the postlude in, so it cannot be forgotten")
  void postludeFollowsFromTheDeclaredPath() {
    // The point of the class: the author says what they write, not which script constant to
    // remember.
    // Any future invariant depending on tags is appended here too, without touching the call sites.
    assertThat(PainlessComposer.compose(BODY, Set.of("tags")))
        .contains(SearchClient.TAG_RESEPARATION_SCRIPT);
    assertThat(PainlessComposer.compose(BODY, Set.of()))
        .doesNotContain(SearchClient.TAG_RESEPARATION_SCRIPT);
  }

  @Test
  @DisplayName("a tag write is told which paths it cannot keep correct")
  void tagWriteReportsUnmaintainablePaths() {
    // A script can recompute tier from tags; it cannot recompute the label-type counts, because
    // they
    // are counted from per-column tag lists the document does not carry. Phase 5 has to reproject
    // these rather than generate painless for them.
    assertThat(PainlessComposer.unmaintainablePaths(new DefaultProjectionSpec(), Set.of("tags")))
        .containsExactlyInAnyOrder("tagSources", "tierSources");
  }
}
