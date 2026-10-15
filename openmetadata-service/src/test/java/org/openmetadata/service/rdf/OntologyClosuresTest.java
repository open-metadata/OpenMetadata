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

package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.apache.jena.query.Dataset;
import org.apache.jena.query.DatasetFactory;
import org.apache.jena.query.QueryExecution;
import org.apache.jena.query.QuerySolution;
import org.apache.jena.query.ResultSet;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.RDFNode;
import org.apache.jena.update.UpdateAction;
import org.apache.jena.vocabulary.OWL2;
import org.apache.jena.vocabulary.RDF;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.rdf.RdfOntologyCandidate;
import org.openmetadata.schema.api.rdf.RdfOntologyCandidateOutcome;
import org.openmetadata.schema.api.rdf.RdfOntologyClosure;
import org.openmetadata.schema.api.rdf.RdfOntologyClosureProblem;
import org.openmetadata.schema.api.rdf.RdfOntologyClosureProblemCode;
import org.openmetadata.schema.api.rdf.RdfOntologyExclusion;
import org.openmetadata.schema.api.rdf.RdfOntologyExclusionReason;
import org.openmetadata.schema.api.rdf.RdfOntologyReasoningStatus;
import org.openmetadata.schema.api.rdf.RdfOntologySelection;
import org.openmetadata.schema.api.rdf.RdfReasoningCheckKind;
import org.openmetadata.schema.api.rdf.RdfReasoningJobRequest;
import org.openmetadata.schema.api.rdf.RdfReasoningOperation;
import org.openmetadata.schema.api.rdf.RdfSourceRevision;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.OntologyConfiguration;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyExpressionKind;
import org.openmetadata.schema.type.OntologyLayer;
import org.openmetadata.schema.type.OntologyRestrictionKind;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

/**
 * Projects ontology entities into an in-memory dataset the way live writes do, then selects,
 * digests, activates and checks closures over it with real SPARQL.
 */
class OntologyClosuresTest {
  private static final String BASE = "https://open-metadata.org/";
  private static final String EX = "https://example.org/retail/";
  private static final String OMR = OntologyReasoningVocabulary.NS;
  private static final RdfSourceRevision REVISION =
      new RdfSourceRevision().withDatasetGeneration(UUID.randomUUID()).withLiveWriteWatermark(42L);

  private final Dataset dataset = DatasetFactory.create();
  private final Catalog catalog = new Catalog();
  private final OntologyGraphProjection projection =
      new OntologyGraphProjection(URI.create(BASE), catalog);
  private final MutableClock clock = new MutableClock();
  private final OntologyClosures closures = closures(OntologyClosures.PAGE_SIZE);

  @AfterEach
  void close() {
    dataset.close();
  }

  @Test
  void aDraftAxiomStaysOutOfTheClosureUntilItIsApproved() {
    final Glossary retail = catalog.glossary("Retail");
    save(term(retail, "Customer", EntityStatus.APPROVED));
    final OntologyAxiom contactable =
        save(axiom(retail, "ContactableCustomer", named(EX + "Customer"), EntityStatus.DRAFT));

    final RdfOntologyClosure draft = closures.approved(retail.getId()).orElseThrow();

    assertEquals(RdfOntologySelection.APPROVED, draft.getSelection());
    assertEquals(0L, draft.getIncluded().getAxioms());
    assertEquals(1L, draft.getIncluded().getTerms());
    assertEquals(
        List.of(exclusion(Entity.ONTOLOGY_AXIOM, RdfOntologyExclusionReason.DRAFT, 1)),
        draft.getExcluded());
    assertEquals(List.of(), draft.getProblems());

    save(contactable.withEntityStatus(EntityStatus.APPROVED));
    final RdfOntologyClosure approved = closures.approved(retail.getId()).orElseThrow();

    assertEquals(1L, approved.getIncluded().getAxioms());
    assertEquals(List.of(), approved.getExcluded());
    assertNotEquals(draft.getClosureDigest(), approved.getClosureDigest());

    save(contactable.withEntityStatus(EntityStatus.REJECTED));
    final RdfOntologyClosure rejected = closures.approved(retail.getId()).orElseThrow();
    assertEquals(draft.getClosureDigest(), rejected.getClosureDigest(), "rejecting it removes it");
    assertEquals(
        List.of(exclusion(Entity.ONTOLOGY_AXIOM, RdfOntologyExclusionReason.REJECTED, 1)),
        rejected.getExcluded());
  }

  @Test
  void theDigestChangesWhenAndOnlyWhenAMemberGraphsTriplesChange() {
    final Glossary retail = catalog.glossary("Retail");
    final OntologyAxiom member =
        save(
            axiom(
                retail,
                "ContactableCustomer",
                some(EX + "hasContact", named(EX + "Email")),
                EntityStatus.APPROVED));
    final OntologyAxiom draft =
        save(axiom(retail, "VipCustomer", named(EX + "Customer"), EntityStatus.DRAFT));
    final String original = digest(retail);

    save(member.withDescription("Reworded; the axiom itself is unchanged"));
    assertEquals(original, digest(retail), "a rewrite with new blank node labels digests equally");

    save(draft.withExpressions(List.of(named(EX + "Party"))));
    assertEquals(original, digest(retail), "a non-member's graph is not in the closure");

    save(member.withExpressions(List.of(some(EX + "hasContact", named(EX + "Phone")))));
    assertNotEquals(original, digest(retail));
  }

  @Test
  void pagingThroughMembersDigestsTheSameClosure() {
    final Glossary retail = catalog.glossary("Retail");
    for (int index = 0; index < 7; index++) {
      save(term(retail, "Term" + index, EntityStatus.APPROVED));
      save(axiom(retail, "Class" + index, named(EX + "Thing"), EntityStatus.APPROVED));
    }

    final RdfOntologyClosure paged = closures(3).approved(retail.getId()).orElseThrow();

    assertEquals(digest(retail), paged.getClosureDigest());
    assertEquals(14L, paged.getMemberCount());
  }

  @Test
  void activationPublishesAManifestThatPinsEveryMemberWithItsDigest() {
    final Glossary retail = catalog.glossary("Retail");
    final GlossaryTerm customer = save(term(retail, "Customer", EntityStatus.APPROVED));
    final OntologyAxiom axiom =
        save(axiom(retail, "Contactable", named(EX + "Customer"), EntityStatus.APPROVED));
    save(axiom(retail, "Draft", named(EX + "Customer"), EntityStatus.DRAFT));

    final RdfOntologyClosure active = closures.activate(retail.getId()).orElseThrow();

    assertTrue(active.getPublished());
    assertTrue(active.getActive());
    final Model manifest = dataset.getNamedModel(active.getManifestGraph().toString());
    final String ontology = active.getOntologyIri().toString();
    assertTrue(manifest.contains(manifest.createResource(ontology), RDF.type, OWL2.Ontology));
    assertTrue(
        manifest.contains(
            manifest.createResource(ontology),
            OWL2.versionIRI,
            manifest.createResource(active.getVersionIri().toString())));
    assertEquals(
        Map.of(
            graph(Entity.ONTOLOGY_AXIOM, axiom.getId()),
            recordedDigest(graph(Entity.ONTOLOGY_AXIOM, axiom.getId())),
            graph(Entity.GLOSSARY_TERM, customer.getId()),
            recordedDigest(graph(Entity.GLOSSARY_TERM, customer.getId()))),
        pinned(active.getManifestGraph().toString()),
        "only Approved graphs are pinned, each with the digest recorded beside it");
    assertEquals(
        active.getManifestGraph().toString(),
        single(
            "SELECT ?m WHERE { GRAPH <%s> { <%s> <%sactiveManifest> ?m } }"
                .formatted(
                    OntologyGraphs.activationsGraph(BASE),
                    GlossaryOntologyIri.entityIri(retail.getId(), URI.create(BASE)),
                    OMR)));

    final RdfOntologyClosure again = closures.activate(retail.getId()).orElseThrow();
    assertEquals(active.getClosureDigest(), again.getClosureDigest());
    assertEquals(1, manifestGraphs().size(), "an unchanged closure reuses its manifest");
  }

  @Test
  void aSupersededManifestIsSweptOnceItsGracePeriodEnds() {
    final Glossary retail = catalog.glossary("Retail");
    final OntologyAxiom axiom =
        save(axiom(retail, "Contactable", named(EX + "Customer"), EntityStatus.APPROVED));
    final RdfOntologyClosure first = closures.activate(retail.getId()).orElseThrow();

    save(axiom.withExpressions(List.of(named(EX + "Party"))));
    closures.activate(retail.getId());
    assertEquals(2, manifestGraphs().size(), "a fresh manifest is kept through the grace period");

    clock.advance(OntologyClosures.MANIFEST_GRACE.plusMinutes(1));
    final RdfOntologyClosure second = closures.activate(retail.getId()).orElseThrow();

    assertEquals(Set.of(second.getManifestGraph().toString()), manifestGraphs());
    assertFalse(dataset.containsNamedModel(first.getManifestGraph().toString()));
  }

  @Test
  void importsArePinnedByVersionAndActivatedWithTheImporter() {
    final Glossary core = catalog.glossary("Core");
    save(term(core, "Party", EntityStatus.APPROVED));
    final Glossary retail = catalog.glossary("Retail", core);
    save(term(retail, "Customer", EntityStatus.APPROVED));

    final RdfOntologyClosure active = closures.activate(retail.getId()).orElseThrow();
    final RdfOntologyClosure coreClosure = closures.approved(core.getId()).orElseThrow();

    assertEquals(1, active.getImports().size());
    assertEquals(coreClosure.getClosureDigest(), active.getImports().getFirst().getClosureDigest());
    assertTrue(coreClosure.getActive(), "activating an importer activates what it imports");
    final Model manifest = dataset.getNamedModel(active.getManifestGraph().toString());
    assertTrue(
        manifest.contains(
            manifest.createResource(active.getOntologyIri().toString()),
            OWL2.imports,
            manifest.createResource(coreClosure.getVersionIri().toString())));

    final String before = active.getClosureDigest();
    save(term(core, "Organization", EntityStatus.APPROVED));
    assertNotEquals(
        before,
        closures.approved(retail.getId()).orElseThrow().getClosureDigest(),
        "an imported closure's change is a new version of the importer");
  }

  @Test
  void aMissingImportOrAnImportCycleRefusesActivation() {
    final Glossary retail = catalog.glossary("Retail");
    final EntityReference missing =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType(Entity.GLOSSARY)
            .withFullyQualifiedName("Gone");
    retail.getOntologyConfiguration().setImports(List.of(missing));

    final OntologyClosures.ActivationRefusedException refused =
        assertThrows(
            OntologyClosures.ActivationRefusedException.class,
            () -> closures.activate(retail.getId()));

    assertEquals(List.of(RdfOntologyClosureProblemCode.MISSING_IMPORT), codes(refused.closure()));
    assertTrue(manifestGraphs().isEmpty(), "nothing is published");

    final Glossary first = catalog.glossary("First");
    final Glossary second = catalog.glossary("Second", first);
    first.getOntologyConfiguration().setImports(List.of(second.getEntityReference()));
    final OntologyClosures.ActivationRefusedException cycle =
        assertThrows(
            OntologyClosures.ActivationRefusedException.class,
            () -> closures.activate(first.getId()));
    assertEquals(List.of(RdfOntologyClosureProblemCode.IMPORT_CYCLE), codes(cycle.closure()));
  }

  @Test
  void approvedGraphsTheStoreDoesNotHoldRefuseActivation() {
    final Glossary retail = catalog.glossary("Retail");
    save(axiom(retail, "Projected", named(EX + "Customer"), EntityStatus.APPROVED));
    catalog.saveWithoutProjecting(
        axiom(retail, "NotYetProjected", named(EX + "Party"), EntityStatus.APPROVED));

    final OntologyClosures.ActivationRefusedException refused =
        assertThrows(
            OntologyClosures.ActivationRefusedException.class,
            () -> closures.activate(retail.getId()));

    assertEquals(
        List.of(RdfOntologyClosureProblemCode.INCOMPLETE_PROJECTION), codes(refused.closure()));
  }

  @Test
  void relationshipTypeGraphsJoinAClosureWhenAMemberUsesThem() {
    final Glossary retail = catalog.glossary("Retail");
    final RelationshipType hasContact = catalog.type("hasContact");
    final RelationshipType contactOf = catalog.type("contactOf");
    hasContact.setInverse(reference(contactOf));
    contactOf.setInverse(reference(hasContact));
    catalog.type("unused");
    project(catalog.types());
    save(
        axiom(
            retail,
            "Contactable",
            some(EX + "hasContact", named(EX + "Email")),
            EntityStatus.APPROVED));

    final RdfOntologyClosure closure = closures.activate(retail.getId()).orElseThrow();

    assertEquals(2L, closure.getIncluded().getRelationshipTypes(), "hasContact and its inverse");
    assertEquals(
        Set.of(
            graph(Entity.ONTOLOGY_AXIOM, catalog.axioms.keySet().iterator().next()),
            graph(Entity.RELATIONSHIP_TYPE, hasContact.getId()),
            graph(Entity.RELATIONSHIP_TYPE, contactOf.getId())),
        pinned(closure.getManifestGraph().toString()).keySet());
  }

  @Test
  void aCandidateClosureAddsDraftGraphsWithoutChangingProduction() {
    final Glossary core = catalog.glossary("Core");
    final GlossaryTerm draftParty = save(term(core, "Party", EntityStatus.DRAFT));
    final Glossary retail = catalog.glossary("Retail", core);
    final OntologyAxiom approved =
        save(axiom(retail, "Contactable", named(EX + "Customer"), EntityStatus.APPROVED));
    final OntologyAxiom draft =
        save(axiom(retail, "Vip", named(EX + "Customer"), EntityStatus.IN_REVIEW));
    final Glossary unrelated = catalog.glossary("Unrelated");
    final OntologyAxiom elsewhere =
        save(axiom(unrelated, "Elsewhere", named(EX + "Thing"), EntityStatus.DRAFT));
    final RdfOntologyClosure production = closures.activate(retail.getId()).orElseThrow();
    final UUID neverApplied = UUID.randomUUID();

    final RdfOntologyClosure candidate =
        closures
            .candidate(
                retail.getId(),
                List.of(
                    draft.getId(),
                    draftParty.getId(),
                    approved.getId(),
                    elsewhere.getId(),
                    neverApplied))
            .orElseThrow();

    assertEquals(RdfOntologySelection.CANDIDATE, candidate.getSelection());
    assertEquals(
        RdfOntologySelection.CANDIDATE,
        candidate.getImports().getFirst().getSelection(),
        "a draft in an imported glossary makes that import a candidate too");
    assertEquals(2L, candidate.getCandidateCount());
    assertEquals(
        Map.of(
            draft.getId(),
            RdfOntologyCandidateOutcome.INCLUDED,
            draftParty.getId(),
            RdfOntologyCandidateOutcome.INCLUDED,
            approved.getId(),
            RdfOntologyCandidateOutcome.ALREADY_APPROVED,
            elsewhere.getId(),
            RdfOntologyCandidateOutcome.OUTSIDE_CLOSURE,
            neverApplied,
            RdfOntologyCandidateOutcome.NOT_PROJECTED),
        outcomes(candidate));
    assertTrue(candidate.getPublished());
    assertFalse(candidate.getActive());
    assertTrue(
        pinned(candidate.getManifestGraph().toString())
            .containsKey(graph(Entity.ONTOLOGY_AXIOM, draft.getId())));

    final RdfOntologyClosure after = closures.approved(retail.getId()).orElseThrow();
    assertEquals(production.getClosureDigest(), after.getClosureDigest());
    assertTrue(after.getActive(), "production still points at its own manifest");
    assertFalse(
        pinned(production.getManifestGraph().toString())
            .containsKey(graph(Entity.ONTOLOGY_AXIOM, draft.getId())));

    final RdfReasoningJobRequest check = candidate.getCheckRequest();
    assertEquals(RdfReasoningOperation.CHECK, check.getOperation());
    assertEquals(RdfOntologySelection.CANDIDATE, check.getOntologySelection());
    assertEquals(candidate.getClosureDigest(), check.getOntologyDigest());
    assertEquals(candidate.getOntologyIri(), check.getOntologyIri());
    assertEquals(RdfReasoningCheckKind.CONSISTENCY, check.getCheck().getKind());
    assertEquals(REVISION, check.getSourceRevision());
    assertEquals(
        check.getRequestId(),
        closures
            .candidate(retail.getId(), List.of(draft.getId(), draftParty.getId()))
            .orElseThrow()
            .getCheckRequest()
            .getRequestId(),
        "the same candidate against the same revision is the same job");
    JsonUtils.readValue(JsonUtils.pojoToJson(check), RdfReasoningJobRequest.class);
  }

  @Test
  void statusCountsIncludedAndExcludedGraphsAcrossGlossaries() {
    final Glossary retail = catalog.glossary("Retail");
    final Glossary core = catalog.glossary("Core");
    save(axiom(retail, "A", named(EX + "Customer"), EntityStatus.APPROVED));
    save(axiom(core, "B", named(EX + "Party"), EntityStatus.DRAFT));
    save(axiom(core, "C", named(EX + "Party"), EntityStatus.DRAFT));
    save(term(core, "Party", EntityStatus.IN_REVIEW));
    save(term(retail, "Customer", EntityStatus.APPROVED));
    closures.activate(retail.getId());

    final RdfOntologyReasoningStatus status = closures.status();

    assertEquals(1L, status.getIncluded().getAxioms());
    assertEquals(1L, status.getIncluded().getTerms());
    assertEquals(
        List.of(
            exclusion(Entity.GLOSSARY_TERM, RdfOntologyExclusionReason.IN_REVIEW, 1),
            exclusion(Entity.ONTOLOGY_AXIOM, RdfOntologyExclusionReason.DRAFT, 2)),
        status.getExcluded());
    assertEquals(1L, status.getActiveOntologies());
  }

  @Test
  void aDeletedEntityLeavesNoMemberRecord() {
    final Glossary retail = catalog.glossary("Retail");
    final OntologyAxiom axiom =
        save(axiom(retail, "Contactable", named(EX + "Customer"), EntityStatus.APPROVED));
    final String graph = graph(Entity.ONTOLOGY_AXIOM, axiom.getId());
    assertTrue(recordedDigest(graph) != null);

    save(axiom.withDeleted(true));

    assertEquals(null, recordedDigest(graph));
    assertEquals(0L, closures.approved(retail.getId()).orElseThrow().getIncluded().getAxioms());
  }

  // ---------------------------------------------------------------------------------------------

  private OntologyClosures closures(final int pageSize) {
    return new OntologyClosures(URI.create(BASE), new DatasetStore(), catalog, clock, pageSize);
  }

  private <T extends EntityInterface<?>> T save(final T entity) {
    catalog.saveWithoutProjecting(entity);
    project(List.of(entity));
    return entity;
  }

  private void project(final List<? extends EntityInterface<?>> entities) {
    OntologyGraphs.replaceUpdates(BASE, projection.replacements(entities), Long.MAX_VALUE)
        .forEach(update -> UpdateAction.parseExecute(update, dataset));
  }

  private String digest(final Glossary glossary) {
    return closures.approved(glossary.getId()).orElseThrow().getClosureDigest();
  }

  private static String graph(final String entityType, final UUID id) {
    return OntologyGraphs.graphIri(BASE, entityType, id).orElseThrow();
  }

  private String recordedDigest(final String graph) {
    return single(
        "SELECT ?d WHERE { GRAPH <%s> { <%s> <%scontentDigest> ?d } }"
            .formatted(OntologyGraphs.membersGraph(BASE), graph, OMR));
  }

  private Map<String, String> pinned(final String manifest) {
    final Map<String, String> pinned = new HashMap<>();
    select("SELECT ?g ?d WHERE { GRAPH <%s> { ?g <%spinnedDigest> ?d } }".formatted(manifest, OMR))
        .forEach(row -> pinned.put(row.get("g"), row.get("d")));
    return pinned;
  }

  private Set<String> manifestGraphs() {
    final Set<String> graphs = new java.util.HashSet<>();
    dataset
        .listNames()
        .forEachRemaining(
            name -> {
              if (name.startsWith(OntologyGraphs.manifestGraphPrefix(BASE))) {
                graphs.add(name);
              }
            });
    return graphs;
  }

  private String single(final String query) {
    final List<Map<String, String>> rows = select(query);
    return rows.isEmpty() ? null : rows.getFirst().values().iterator().next();
  }

  private List<Map<String, String>> select(final String query) {
    return new DatasetStore().select(query);
  }

  private static List<RdfOntologyClosureProblemCode> codes(final RdfOntologyClosure closure) {
    return closure.getProblems().stream().map(RdfOntologyClosureProblem::getCode).toList();
  }

  private static Map<UUID, RdfOntologyCandidateOutcome> outcomes(final RdfOntologyClosure closure) {
    final Map<UUID, RdfOntologyCandidateOutcome> outcomes = new LinkedHashMap<>();
    for (final RdfOntologyCandidate candidate : closure.getCandidates()) {
      outcomes.put(candidate.getEntityId(), candidate.getOutcome());
    }
    return outcomes;
  }

  private static RdfOntologyExclusion exclusion(
      final String entityType, final RdfOntologyExclusionReason reason, final long count) {
    return new RdfOntologyExclusion()
        .withEntityType(entityType)
        .withReason(reason)
        .withCount(count);
  }

  private static EntityReference reference(final RelationshipType type) {
    return new EntityReference()
        .withId(type.getId())
        .withType(Entity.RELATIONSHIP_TYPE)
        .withName(type.getName())
        .withFullyQualifiedName(type.getFullyQualifiedName());
  }

  private static GlossaryTerm term(
      final Glossary glossary, final String name, final EntityStatus status) {
    return new GlossaryTerm()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName(glossary.getName() + "." + name)
        .withGlossary(glossary.getEntityReference())
        .withConceptType(OntologyConceptType.BOTH)
        .withIri(URI.create(EX + glossary.getName() + "/" + name))
        .withEntityStatus(status);
  }

  private static OntologyAxiom axiom(
      final Glossary glossary,
      final String subject,
      final OntologyExpression expression,
      final EntityStatus status) {
    return new OntologyAxiom()
        .withId(UUID.randomUUID())
        .withName(subject)
        .withFullyQualifiedName(glossary.getName() + "." + subject)
        .withGlossary(glossary.getEntityReference())
        .withAxiomType(OntologyAxiomType.SUBCLASS_OF)
        .withSubjectIri(URI.create(EX + subject))
        .withExpressions(List.of(expression))
        .withEntityStatus(status);
  }

  private static OntologyExpression named(final String iri) {
    return new OntologyExpression()
        .withKind(OntologyExpressionKind.NAMED_CLASS)
        .withClassIri(URI.create(iri));
  }

  private static OntologyExpression some(final String property, final OntologyExpression filler) {
    return new OntologyExpression()
        .withKind(OntologyExpressionKind.RESTRICTION)
        .withPropertyIri(URI.create(property))
        .withRestrictionKind(OntologyRestrictionKind.SOME)
        .withFiller(filler);
  }

  /** SPARQL over the in-memory dataset, binding values as the production store adapter does. */
  private final class DatasetStore implements OntologyClosures.Store {
    @Override
    public List<Map<String, String>> select(final String query) {
      try (QueryExecution execution = QueryExecution.dataset(dataset).query(query).build()) {
        final ResultSet results = execution.execSelect();
        final List<Map<String, String>> rows = new ArrayList<>();
        while (results.hasNext()) {
          final QuerySolution solution = results.next();
          final Map<String, String> row = new HashMap<>();
          solution
              .varNames()
              .forEachRemaining(
                  variable -> {
                    final RDFNode node = solution.get(variable);
                    if (node != null) {
                      row.put(
                          variable,
                          node.isURIResource()
                              ? node.asResource().getURI()
                              : node.asLiteral().getLexicalForm());
                    }
                  });
          rows.add(row);
        }
        return rows;
      }
    }

    @Override
    public boolean ask(final String query) {
      try (QueryExecution execution = QueryExecution.dataset(dataset).query(query).build()) {
        return execution.execAsk();
      }
    }

    @Override
    public void update(final String update) {
      UpdateAction.parseExecute(update, dataset);
    }
  }

  /** The metadata database and the projection's sources, kept in step as a server keeps them. */
  private static final class Catalog
      implements OntologyClosures.Metadata, OntologyGraphProjection.Sources {
    private final Map<UUID, Glossary> glossaries = new HashMap<>();
    private final Map<UUID, OntologyAxiom> axioms = new LinkedHashMap<>();
    private final Map<UUID, GlossaryTerm> terms = new HashMap<>();
    private final Map<UUID, RelationshipType> types = new LinkedHashMap<>();

    Glossary glossary(final String name, final Glossary... imports) {
      final Glossary glossary =
          new Glossary()
              .withId(UUID.randomUUID())
              .withName(name)
              .withFullyQualifiedName(name)
              .withOntologyConfiguration(
                  new OntologyConfiguration()
                      .withLayer(OntologyLayer.L_3)
                      .withBaseIri(URI.create(EX + name + "/"))
                      .withImports(
                          List.of(imports).stream().map(Glossary::getEntityReference).toList()));
      glossaries.put(glossary.getId(), glossary);
      return glossary;
    }

    RelationshipType type(final String name) {
      final RelationshipType type =
          new RelationshipType()
              .withId(UUID.randomUUID())
              .withName(name)
              .withFullyQualifiedName(name)
              .withDisplayName(name)
              .withRdfPredicate(URI.create(EX + name))
              .withEntityStatus(EntityStatus.APPROVED)
              .withCharacteristics(Set.of())
              .withDomain(Set.of())
              .withRange(Set.of())
              .withPropertyChain(List.of())
              .withDisjointWith(Set.of());
      types.put(type.getId(), type);
      return type;
    }

    List<RelationshipType> types() {
      return List.copyOf(types.values());
    }

    void saveWithoutProjecting(final EntityInterface<?> entity) {
      switch (entity) {
        case OntologyAxiom axiom -> axioms.put(axiom.getId(), axiom);
        case GlossaryTerm term -> terms.put(term.getId(), term);
        default -> throw new IllegalArgumentException("Unexpected entity " + entity);
      }
    }

    @Override
    public Optional<Glossary> glossary(final UUID glossaryId) {
      return Optional.ofNullable(glossaries.get(glossaryId));
    }

    @Override
    public long approvedAxiomCount(final UUID glossaryId) {
      return axioms.values().stream()
          .filter(axiom -> glossaryId.equals(axiom.getGlossary().getId()))
          .filter(OntologyClosuresTest::isApproved)
          .count();
    }

    @Override
    public long approvedTermCount(final Glossary glossary) {
      return terms.values().stream()
          .filter(term -> glossary.getId().equals(term.getGlossary().getId()))
          .filter(OntologyClosuresTest::isApproved)
          .count();
    }

    @Override
    public boolean projectionReady() {
      return true;
    }

    @Override
    public Optional<RdfSourceRevision> sourceRevision() {
      return Optional.of(REVISION);
    }

    @Override
    public List<RelationshipType> relationshipTypes() {
      return types();
    }

    @Override
    public Optional<GlossaryTerm> glossaryTerm(final UUID termId) {
      return Optional.ofNullable(terms.get(termId));
    }

    @Override
    public List<GlossaryTerm> glossaryTerms(final EntityReference glossary) {
      return terms.values().stream()
          .filter(term -> glossary.getId().equals(term.getGlossary().getId()))
          .toList();
    }
  }

  private static boolean isApproved(final EntityInterface<?> entity) {
    final EntityStatus status =
        entity instanceof OntologyAxiom axiom
            ? axiom.getEntityStatus()
            : ((GlossaryTerm) entity).getEntityStatus();
    return status == EntityStatus.APPROVED && !Boolean.TRUE.equals(entity.getDeleted());
  }

  private static final class MutableClock extends Clock {
    private Instant now = Instant.parse("2026-10-15T08:00:00Z");

    void advance(final Duration duration) {
      now = now.plus(duration);
    }

    @Override
    public java.time.ZoneId getZone() {
      return ZoneOffset.UTC;
    }

    @Override
    public Clock withZone(final java.time.ZoneId zone) {
      return this;
    }

    @Override
    public Instant instant() {
      return now;
    }
  }
}
