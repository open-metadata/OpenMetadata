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

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Drift detection is only useful if it is quiet when nothing is wrong. Every rule here exists to stop
 * it reporting something no operator can act on, because a noisy detector gets switched off and then
 * the real drift goes unseen too.
 */
class DocumentDriftTest {

  private static final ProjectionSpec SPEC = new DefaultProjectionSpec();

  @Test
  @DisplayName("an identical document has no drift")
  void identicalDocumentsAgree() {
    Map<String, Object> doc = Map.of("description", "same", "owners", List.of("a"));
    assertThat(drift(doc, doc)).isEmpty();
  }

  @Test
  @DisplayName("a changed derived path is drift")
  void changedDerivedPathDrifts() {
    assertThat(drift(Map.of("description", "old"), Map.of("description", "new")))
        .containsExactly("description");
  }

  @Test
  @DisplayName("absent, null and empty are the same thing")
  void absentNullAndEmptyAreEquivalent() {
    Map<String, Object> stored = new HashMap<>();
    stored.put("owners", null);
    stored.put("followers", List.of());
    stored.put("domains", Map.of());

    // The two write paths disagree about materialising empty collections, in both directions. That
    // is
    // not a user-visible difference, and reporting it would drown the findings that are.
    assertThat(drift(stored, Map.of())).isEmpty();
    assertThat(drift(Map.of(), stored)).isEmpty();
  }

  @Test
  @DisplayName("an empty value against a populated one is still drift")
  void emptyVersusPopulatedIsStillDrift() {
    assertThat(drift(Map.of("owners", List.of()), Map.of("owners", List.of("someone"))))
        .containsExactly("owners");
  }

  @Test
  @DisplayName("carried and fenced paths are never reported, however different they look")
  void pathsOutsideRebuildAuthorityAreSkipped() {
    Map<String, Object> stored =
        Map.of("embedding", List.of(0.1, 0.2), "testSuitesRevision", 7, "description", "same");
    // A projection cannot reconstruct an embedding or hold a fenced ordinal, so these always
    // differ.
    // Reporting them would make the metric useless on every single sampled document.
    Map<String, Object> projected = Map.of("description", "same");

    assertThat(drift(stored, projected)).isEmpty();
  }

  private static java.util.Set<String> drift(
      Map<String, Object> stored, Map<String, Object> projected) {
    return DocumentDrift.paths(stored, projected, SPEC, DocumentProjector.REBUILD_AUTHORITY);
  }
}
