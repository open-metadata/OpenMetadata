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

import java.io.InputStream;
import java.net.URI;
import java.util.AbstractList;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.OntologyPackSample;
import org.openmetadata.schema.api.data.OntologyPackSampleConcept;
import org.openmetadata.schema.api.data.OntologyPackSampleRelation;

class OntologyPackSamplerTest {
  private final OntologyPackSampler sampler =
      new OntologyPackSampler(
          OntologyPackCatalog.bundled(),
          new OntologyPackContentLoader(getClass().getClassLoader()));

  @Test
  void equivalentSelectionsReuseTheSampleWithoutReadingThePayloadAgain() {
    final AtomicInteger reads = new AtomicInteger();
    final ClassLoader resources =
        new ClassLoader(getClass().getClassLoader()) {
          @Override
          public InputStream getResourceAsStream(final String name) {
            reads.incrementAndGet();
            return super.getResourceAsStream(name);
          }
        };
    final OntologyPackModels documents =
        new OntologyPackModels(new OntologyPackContentLoader(resources), 0);
    final OntologyPackSampler cached =
        new OntologyPackSampler(OntologyPackCatalog.bundled(), documents);

    final OntologyPackSample first = cached.sample("sosa-ssn", List.of("ssn"));
    final int coldReads = reads.get();
    final OntologyPackSample second = cached.sample("sosa-ssn", List.of("ssn", "sosa"));

    assertTrue(coldReads > 0);
    assertEquals(first, second);
    assertEquals(coldReads, reads.get(), "an equivalent warm sample must not reread bundled RDF");
  }

  @Test
  void changingAResponseCannotChangeTheNextSample() {
    final OntologyPackSample first = sampler.sample("sosa-ssn", List.of("sosa"));
    final String label = first.getConcepts().getFirst().getLabel();
    first.getConcepts().getFirst().setLabel("changed by the caller");
    first.setConceptCount(-1);

    final OntologyPackSample second = sampler.sample("sosa-ssn", List.of("sosa"));

    assertEquals(label, second.getConcepts().getFirst().getLabel());
    assertEquals(16, second.getConceptCount());
  }

  @Test
  void aSmallSampleBudgetEvictsSelections() {
    final AtomicInteger reads = new AtomicInteger();
    final ClassLoader resources =
        new ClassLoader(getClass().getClassLoader()) {
          @Override
          public InputStream getResourceAsStream(final String name) {
            reads.incrementAndGet();
            return super.getResourceAsStream(name);
          }
        };
    final OntologyPackModels documents =
        new OntologyPackModels(new OntologyPackContentLoader(resources), 0);
    final OntologyPackSampler cached =
        new OntologyPackSampler(OntologyPackCatalog.bundled(), documents, 16 * 1024);
    final var first = cached.sample("sosa-ssn", List.of("sosa"));
    final var next = cached.sample("sosa-ssn", List.of("ssn"));
    final int coldReads = reads.get();

    assertEquals(first, cached.sample("sosa-ssn", List.of("sosa")));
    assertEquals(next, cached.sample("sosa-ssn", List.of("ssn")));
    assertTrue(reads.get() > coldReads, "the sample budget cannot retain both selections");
  }

  @Test
  void boundingAChainScansRelationsWithinALinearBudget() {
    final List<OntologyPackSampleConcept> concepts =
        IntStream.range(0, 100)
            .mapToObj(
                index ->
                    new OntologyPackSampleConcept()
                        .withIri(URI.create("https://example.org/sample#C%03d".formatted(index)))
                        .withLabel("Concept %03d".formatted(index)))
            .toList();
    final List<OntologyPackSampleRelation> relations =
        IntStream.range(1, concepts.size())
            .mapToObj(
                index ->
                    new OntologyPackSampleRelation()
                        .withSourceIri(concepts.get(index).getIri())
                        .withPropertyIri(
                            URI.create("http://www.w3.org/2000/01/rdf-schema#subClassOf"))
                        .withTargetIri(concepts.get(index - 1).getIri()))
            .toList();
    final AtomicInteger reads = new AtomicInteger();
    final List<OntologyPackSampleRelation> counted =
        new AbstractList<>() {
          @Override
          public OntologyPackSampleRelation get(final int index) {
            reads.incrementAndGet();
            return relations.get(index);
          }

          @Override
          public int size() {
            return relations.size();
          }
        };
    final OntologyPackSample sample =
        OntologyPackSampler.bound(
            new OntologyPackSample()
                .withConceptCount(concepts.size())
                .withRelationCount(relations.size())
                .withConcepts(concepts)
                .withRelations(counted),
            OntologyPackSampler.MAX_CONCEPTS);

    assertEquals(concepts.subList(0, 60), sample.getConcepts());
    assertEquals(relations.subList(0, 59), sample.getRelations());
    assertEquals(100, sample.getConceptCount());
    assertEquals(99, sample.getRelationCount());
    assertTrue(
        reads.get() <= 10 * relations.size(),
        "sample traversal exceeded its relation scan budget with " + reads.get() + " reads");
  }

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
  void samplesAPackTooBigForOneInteractiveImportWithinTheSampleLimit() {
    final OntologyPackSample sample = sampler.sample("fibo", List.of("fibo-quickstart"));

    assertEquals(2413, sample.getConceptCount());
    assertEquals(OntologyPackSampler.MAX_CONCEPTS, sample.getConcepts().size());
  }
}
