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
package org.openmetadata.service.rdf.reasoning;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.rdf.RdfOntologySelection;
import org.openmetadata.schema.api.rdf.RdfReasoningFreshness;
import org.openmetadata.schema.api.rdf.RdfReasoningInput;
import org.openmetadata.schema.api.rdf.RdfSourceRevision;
import org.openmetadata.service.rdf.reasoning.ReasoningFreshness.Serving;

class ReasoningFreshnessTest {
  private static final UUID GENERATION = UUID.randomUUID();
  private static final String ONTOLOGY = "sha256:" + "a".repeat(64);
  private static final String RULES = "sha256:" + "b".repeat(64);
  private static final RdfReasoningInput READ =
      new RdfReasoningInput()
          .withSourceRevision(
              new RdfSourceRevision()
                  .withDatasetGeneration(GENERATION)
                  .withLiveWriteWatermark(18442L))
          .withOntologySelection(RdfOntologySelection.APPROVED)
          .withOntologyDigest(ONTOLOGY)
          .withRuleBundleDigest(RULES);

  @Test
  void aResultThatCoversEveryEnqueuedWriteIsCurrent() {
    assertEquals(
        RdfReasoningFreshness.CURRENT,
        ReasoningFreshness.of(READ, new Serving(GENERATION, 18442, false, ONTOLOGY, RULES)));
  }

  @Test
  void aWriteEnqueuedSinceTheResultWasReadMakesItStale() {
    assertEquals(
        RdfReasoningFreshness.STALE,
        ReasoningFreshness.of(READ, new Serving(GENERATION, 18443, false, ONTOLOGY, RULES)));
  }

  @Test
  void aPromotionMakesItStaleWhateverTheWatermark() {
    assertEquals(
        RdfReasoningFreshness.STALE,
        ReasoningFreshness.of(READ, new Serving(UUID.randomUUID(), 18442, false, ONTOLOGY, RULES)));
  }

  @Test
  void changedOntologiesMakeItStale() {
    assertEquals(
        RdfReasoningFreshness.STALE,
        ReasoningFreshness.of(
            READ, new Serving(GENERATION, 18442, false, "sha256:" + "c".repeat(64), RULES)));
  }

  @Test
  void changedRulesMakeItStale() {
    assertEquals(
        RdfReasoningFreshness.STALE,
        ReasoningFreshness.of(
            READ, new Serving(GENERATION, 18442, false, ONTOLOGY, "sha256:" + "c".repeat(64))));
  }

  @Test
  void aDegradedProjectionMakesItUnknownEvenWhenNothingElseChanged() {
    assertEquals(
        RdfReasoningFreshness.UNKNOWN,
        ReasoningFreshness.of(READ, new Serving(GENERATION, 18442, true, ONTOLOGY, RULES)));
  }

  @Test
  void aDegradedProjectionOutranksAKnownChange() {
    assertEquals(
        RdfReasoningFreshness.UNKNOWN,
        ReasoningFreshness.of(READ, new Serving(UUID.randomUUID(), 18500, true, ONTOLOGY, RULES)));
  }
}
