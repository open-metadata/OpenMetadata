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

package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.OntologyPackSample;

class OntologyPackSamplerTest {
  private final OntologyPackSampler sampler =
      new OntologyPackSampler(
          OntologyPackCatalog.bundled(),
          new OntologyPackContentLoader(getClass().getClassLoader()));

  @Test
  void returnsTheConceptsAndRelationsAnEmptyInstallCreates() {
    final OntologyPackSample sample = sampler.sample("sosa-ssn", List.of("sosa", "ssn"));

    assertEquals(List.of("sosa", "ssn"), new ArrayList<>(sample.getModuleIds()));
    assertEquals(22, sample.getConceptCount());
    assertEquals(22, sample.getConcepts().size());
    assertEquals(sample.getRelationCount(), sample.getRelations().size());
    assertTrue(
        sample.getRelations().stream()
            .allMatch(
                relation ->
                    sample.getConcepts().stream()
                            .anyMatch(concept -> concept.getIri().equals(relation.getSourceIri()))
                        && sample.getConcepts().stream()
                            .anyMatch(
                                concept -> concept.getIri().equals(relation.getTargetIri()))));
    assertEquals(
        sample.getConcepts(), sampler.sample("sosa-ssn", List.of("sosa", "ssn")).getConcepts());
  }

  @Test
  void boundsALargeVocabularyToTheSampleLimit() {
    final OntologyPackSample sample = sampler.sample("odrl", List.of("odrl"));

    assertEquals(214, sample.getConceptCount());
    assertEquals(OntologyPackSampler.MAX_CONCEPTS, sample.getConcepts().size());
  }

  @Test
  void narrowsTheSampleWhenTheSelectionChanges() {
    final OntologyPackSample sample = sampler.sample("sosa-ssn", List.of("sosa"));

    assertEquals(16, sample.getConceptCount());
    assertThrows(
        IllegalArgumentException.class, () -> sampler.sample("sosa-ssn", List.of("unknown")));
  }

  @Test
  void refusesAPackThatTheBackgroundJobInstalls() {
    assertThrows(
        IllegalArgumentException.class, () -> sampler.sample("fibo", List.of("fibo-quickstart")));
  }
}
