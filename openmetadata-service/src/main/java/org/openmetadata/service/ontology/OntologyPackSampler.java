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

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.api.data.OntologyPackSample;
import org.openmetadata.schema.api.data.OntologyPackSampleConcept;
import org.openmetadata.schema.api.data.OntologyPackSampleRelation;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyChangeOperationType;
import org.openmetadata.schema.type.OntologyExpressionKind;
import org.openmetadata.schema.type.OntologyPackModule;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.schema.type.OntologyState;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.rdf.NativeOntologyRdfImporter;

public final class OntologyPackSampler {
  public static final int MAX_CONCEPTS = 60;
  private static final long MAX_CACHED_SAMPLE_BYTES = 4L * 1024 * 1024;
  private static final URI SUBCLASS_OF =
      URI.create("http://www.w3.org/2000/01/rdf-schema#subClassOf");
  private final OntologyPackCatalog catalog;
  private final OntologyPackModels models;
  private final Cache<OntologyPackModels.SourceKey, byte[]> samples;

  public OntologyPackSampler(
      final OntologyPackCatalog catalog, final OntologyPackContentLoader loader) {
    this(catalog, new OntologyPackModels(loader));
  }

  public OntologyPackSampler(final OntologyPackCatalog catalog, final OntologyPackModels models) {
    this(catalog, models, MAX_CACHED_SAMPLE_BYTES);
  }

  OntologyPackSampler(
      final OntologyPackCatalog catalog, final OntologyPackModels models, final long cacheBytes) {
    this.catalog = catalog;
    this.models = models;
    samples =
        Caffeine.newBuilder()
            .maximumWeight(cacheBytes)
            .<OntologyPackModels.SourceKey, byte[]>weigher(
                (key, value) -> OntologyPackModels.cacheWeight(value))
            .executor(Runnable::run)
            .build();
  }

  public OntologyPackSample sample(final String packId, final Collection<String> moduleIds) {
    final var selected = models.select(catalog, packId, moduleIds);
    final byte[] cached =
        samples.get(
            OntologyPackModels.key(selected),
            ignored -> JsonUtils.pojoToJson(sample(selected)).getBytes(StandardCharsets.UTF_8));
    return JsonUtils.readValue(
        new String(cached, StandardCharsets.UTF_8), OntologyPackSample.class);
  }

  private OntologyPackSample sample(final OntologyPackContentLoader.Selection selected) {
    final var plan =
        new NativeOntologyRdfImporter()
            .reconcileUnbounded(models.document(selected), emptySnapshot());
    final List<OntologyPackSampleConcept> concepts =
        plan.getOperations().stream()
            .filter(
                operation ->
                    operation.getOperationType() == OntologyChangeOperationType.UPSERT_CONCEPT)
            .map(operation -> operation.getConcept())
            .map(
                concept ->
                    new OntologyPackSampleConcept()
                        .withIri(concept.getIri())
                        .withLabel(
                            concept.getDisplayName() == null
                                ? concept.getName()
                                : concept.getDisplayName())
                        .withDescription(concept.getDescription()))
            .toList();
    final List<OntologyPackSampleRelation> relations =
        plan.getOperations().stream()
            .filter(
                operation ->
                    operation.getOperationType() == OntologyChangeOperationType.UPSERT_AXIOM)
            .map(operation -> operation.getAxiom())
            .flatMap(axiom -> relation(axiom).stream())
            .toList();
    return bound(
        new OntologyPackSample()
            .withPackId(selected.manifest().getId())
            .withVersion(selected.manifest().getVersion())
            .withModuleIds(
                new LinkedHashSet<>(
                    selected.modules().stream().map(OntologyPackModule::getId).toList()))
            .withConceptCount(concepts.size())
            .withRelationCount(relations.size())
            .withConcepts(concepts)
            .withRelations(relations),
        MAX_CONCEPTS);
  }

  private static Optional<OntologyPackSampleRelation> relation(final OntologyAxiom axiom) {
    if (axiom.getAxiomType() == OntologyAxiomType.OBJECT_PROPERTY_ASSERTION) {
      return Optional.of(
          new OntologyPackSampleRelation()
              .withSourceIri(axiom.getSubjectIri())
              .withPropertyIri(axiom.getPropertyIri())
              .withLabel(localName(axiom.getPropertyIri()))
              .withTargetIri(axiom.getTargetIri()));
    }
    if (axiom.getAxiomType() == OntologyAxiomType.SUBCLASS_OF
        && axiom.getExpressions().size() == 1
        && axiom.getExpressions().getFirst().getKind() == OntologyExpressionKind.NAMED_CLASS) {
      return Optional.of(
          new OntologyPackSampleRelation()
              .withSourceIri(axiom.getSubjectIri())
              .withPropertyIri(SUBCLASS_OF)
              .withLabel(localName(SUBCLASS_OF))
              .withTargetIri(axiom.getExpressions().getFirst().getClassIri()));
    }
    return Optional.empty();
  }

  static OntologyPackSample bound(final OntologyPackSample sample, final int limit) {
    final Comparator<OntologyPackSampleConcept> order =
        Comparator.comparing(
                (OntologyPackSampleConcept concept) -> concept.getLabel().toLowerCase(Locale.ROOT))
            .thenComparing(concept -> concept.getIri().toString());
    final List<OntologyPackSampleConcept> sorted =
        sample.getConcepts().stream().sorted(order).toList();
    final Set<URI> sources = new HashSet<>();
    final Map<URI, Set<URI>> childIrisByTarget = new HashMap<>();
    sample
        .getRelations()
        .forEach(
            relation -> {
              sources.add(relation.getSourceIri());
              childIrisByTarget
                  .computeIfAbsent(relation.getTargetIri(), ignored -> new HashSet<>())
                  .add(relation.getSourceIri());
            });
    final ArrayDeque<OntologyPackSampleConcept> queue = new ArrayDeque<>();
    sorted.stream().filter(concept -> !sources.contains(concept.getIri())).forEach(queue::add);
    if (queue.isEmpty()) {
      queue.addAll(sorted);
    }
    final Set<URI> kept = new HashSet<>();
    while (!queue.isEmpty() && kept.size() < limit) {
      final OntologyPackSampleConcept concept = queue.removeFirst();
      if (kept.add(concept.getIri())) {
        final Set<URI> children = childIrisByTarget.getOrDefault(concept.getIri(), Set.of());
        sorted.stream().filter(child -> children.contains(child.getIri())).forEach(queue::add);
      }
    }
    if (kept.size() < limit) {
      sorted.stream()
          .filter(concept -> !kept.contains(concept.getIri()))
          .limit(limit - kept.size())
          .forEach(concept -> kept.add(concept.getIri()));
    }
    final List<OntologyPackSampleConcept> concepts =
        sorted.stream().filter(concept -> kept.contains(concept.getIri())).toList();
    final List<OntologyPackSampleRelation> relations =
        sample.getRelations().stream()
            .filter(
                relation ->
                    kept.contains(relation.getSourceIri())
                        && kept.contains(relation.getTargetIri()))
            .sorted(
                Comparator.comparing(
                        (OntologyPackSampleRelation relation) -> relation.getSourceIri().toString())
                    .thenComparing(relation -> relation.getPropertyIri().toString())
                    .thenComparing(relation -> relation.getTargetIri().toString()))
            .toList();
    return sample.withConcepts(concepts).withRelations(relations);
  }

  private static String localName(final URI iri) {
    final String value = iri.toString();
    return value.substring(Math.max(value.lastIndexOf('#'), value.lastIndexOf('/')) + 1);
  }

  private static OntologyWorkingSnapshot.Snapshot emptySnapshot() {
    final Ontology root =
        new Ontology()
            .withId(UUID.randomUUID())
            .withName("library-sample")
            .withFullyQualifiedName("library-sample");
    final OntologyState state = new OntologyState().withWorkingRevision(0L);
    return new OntologyWorkingSnapshot.Snapshot(
        state, List.of(new OntologyWorkingSnapshot.Entry(MemberKind.ONTOLOGY, root)));
  }
}
