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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.Property;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.riot.Lang;
import org.apache.jena.riot.RDFParser;
import org.apache.jena.vocabulary.OWL2;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.factories.GlossaryTermTestFactory;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SharedResourceLocks;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateRelationshipType;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.RelationshipPaletteKey;
import org.openmetadata.schema.type.RelationshipTypeCategory;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.services.ontology.RelationshipTypeService;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.EntityRepository;

/**
 * An inverse pair created over REST the way the UI creates it (#38113): create B, create A with
 * inverse B, then update B with inverse A. Every reference reads back with its name, and an A edge
 * reads as A from its author and as B from the other end, whichever term has the higher id.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class RelationshipTypeInverseReferenceIT {
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final String SEEDED_FORWARD = "calculatedFrom";
  private static final String SEEDED_INVERSE = "usedToCalculate";
  private static final HttpClient HTTP =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

  @Test
  void restPairCarriesNamedInverseReferencesOnEveryRead(final TestNamespace ns) throws Exception {
    final Pair pair = createPairLikeTheUi();
    try {
      assertNamedInverse(pair.forward(), pair.inverse());
      assertNamedInverse(pair.inverse(), pair.forward());
      for (final RelationshipType type : List.of(pair.forward(), pair.inverse())) {
        final RelationshipType partner = type == pair.forward() ? pair.inverse() : pair.forward();
        assertNamedInverse(types().get(type.getId()), partner);
        assertNamedInverse(types().getByName(type.getName()), partner);
        assertNamedInverse(listed(type.getName()), partner);
      }
      final RelationshipType patched =
          types()
              .patch(
                  pair.forward().getId(),
                  OBJECT_MAPPER.readTree(
                      "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"patched\"}]"));
      assertNamedInverse(patched, pair.inverse());
    } finally {
      deleteTypes(pair);
    }
  }

  @Test
  void edgeReadsAsTheInverseFromTheOtherEndInEitherIdOrder(final TestNamespace ns)
      throws Exception {
    final Glossary glossary = GlossaryTestFactory.createSimple(ns);
    final Pair pair = createPairLikeTheUi();
    try {
      final List<GlossaryTerm> terms = termsSortedById(ns, glossary);
      final Edge fromLowerId = new Edge(terms.get(0), terms.get(1));
      final Edge fromHigherId = new Edge(terms.get(3), terms.get(2));
      for (final Edge edge : List.of(fromLowerId, fromHigherId)) {
        SdkClients.adminClient()
            .glossaryTerms()
            .addRelation(edge.source().getId(), edge.target().getId(), pair.forward().getName());
      }
      final Map<UUID, List<TermRelation>> listedRelations = listedRelations(glossary);
      for (final Edge edge : List.of(fromLowerId, fromHigherId)) {
        assertEdgeReads(edge, pair, relationsOf(edge.source()), relationsOf(edge.target()));
        assertEdgeReads(
            edge,
            pair,
            listedRelations.get(edge.source().getId()),
            listedRelations.get(edge.target().getId()));
      }
      assertExportedEdges(glossary, pair, List.of(fromLowerId, fromHigherId));

      removeRelation(fromLowerId.source(), fromLowerId.target(), pair.forward());
      removeRelation(fromHigherId.target(), fromHigherId.source(), pair.inverse());
      for (final GlossaryTerm term : terms) {
        assertTrue(relationsOf(term).isEmpty(), "edge left on " + term.getName());
      }
    } finally {
      deleteGlossary(glossary);
      deleteTypes(pair);
    }
  }

  /** The settings page saves a seeded pair over PUT; the pair must still flip afterwards. */
  @Test
  @ResourceLock(
      value = SharedResourceLocks.GLOSSARY_TERM_RELATION_SETTINGS,
      mode = ResourceAccessMode.READ_WRITE)
  void savingASeededPairThroughTheApiKeepsItsInverse(final TestNamespace ns) throws Exception {
    final Glossary glossary = GlossaryTestFactory.createSimple(ns);
    final RelationshipType seeded = types().getByName(SEEDED_FORWARD);
    final RelationshipType saved = types().upsert(requestLikeTheSettingsPage(seeded));
    final RelationshipType partner = types().getByName(SEEDED_INVERSE);
    assertNamedInverse(saved, partner);
    assertNamedInverse(types().get(seeded.getId()), partner);
    try {
      final List<GlossaryTerm> terms = termsSortedById(ns, glossary);
      final Edge fromHigherId = new Edge(terms.get(3), terms.get(0));
      SdkClients.adminClient()
          .glossaryTerms()
          .addRelation(
              fromHigherId.source().getId(), fromHigherId.target().getId(), SEEDED_FORWARD);
      assertEdgeReads(
          fromHigherId,
          new Pair(saved, partner),
          relationsOf(fromHigherId.source()),
          relationsOf(fromHigherId.target()));
    } finally {
      deleteGlossary(glossary);
    }
  }

  /**
   * Relations stored before their type named an inverse that names no type read and delete as that
   * type from both ends; a new relation of it is refused in either direction.
   */
  @Test
  void inverseThatNamesNoTypeIsIgnoredOnReadAndDeleteAndRefusedOnStore(final TestNamespace ns)
      throws Exception {
    final Glossary glossary = GlossaryTestFactory.createSimple(ns);
    final String missing = uniqueName("neverCreated");
    RelationshipType forward = null;
    try {
      forward = types().create(request(uniqueName("danglingA"), null));
      final List<GlossaryTerm> terms = termsSortedById(ns, glossary);
      final List<Edge> edges =
          List.of(new Edge(terms.get(0), terms.get(1)), new Edge(terms.get(3), terms.get(2)));
      for (final Edge edge : edges) {
        SdkClients.adminClient()
            .glossaryTerms()
            .addRelation(edge.source().getId(), edge.target().getId(), forward.getName());
      }
      types()
          .patch(
              forward.getId(),
              OBJECT_MAPPER.readTree(
                  "[{\"op\":\"add\",\"path\":\"/inverse\",\"value\":{\"type\":"
                      + "\"relationshipType\",\"fullyQualifiedName\":\""
                      + missing
                      + "\"}}]"));
      for (final Edge edge : edges) {
        assertEquals(
            Set.of(forward.getName()), typesTowards(relationsOf(edge.target()), edge.source()));
        removeRelation(edge.target(), edge.source(), forward);
      }
      for (final GlossaryTerm term : terms) {
        assertTrue(relationsOf(term).isEmpty(), "edge left on " + term.getName());
      }
      final String forwardName = forward.getName();
      for (final Edge edge : edges) {
        final InvalidRequestException refused =
            assertThrows(
                InvalidRequestException.class,
                () ->
                    SdkClients.adminClient()
                        .glossaryTerms()
                        .addRelation(edge.source().getId(), edge.target().getId(), forwardName));
        assertTrue(refused.getMessage().contains(missing), refused.getMessage());
      }
    } finally {
      deleteGlossary(glossary);
      if (forward != null) {
        types().delete(forward.getId().toString(), true);
      }
    }
  }

  @Test
  void patchNamingAnInverseByIdAloneStoresItWithItsName() throws Exception {
    final RelationshipType target = types().create(request(uniqueName("byIdTarget"), null));
    RelationshipType owner = null;
    try {
      owner = types().create(request(uniqueName("byIdOwner"), null));
      final RelationshipType patched =
          types()
              .patch(
                  owner.getId(),
                  OBJECT_MAPPER.readTree(
                      "[{\"op\":\"add\",\"path\":\"/inverse\",\"value\":{\"id\":\""
                          + target.getId()
                          + "\",\"type\":\"relationshipType\"}}]"));
      assertNamedInverse(patched, target);
      assertEquals(referenceTo(target), stored(owner.getId()).getInverse());
    } finally {
      if (owner != null) {
        types().delete(owner.getId().toString(), true);
      }
      types().delete(target.getId().toString(), true);
    }
  }

  @Test
  void patchThatPointsAReferenceAtTwoTypesIsRefused(final TestNamespace ns) throws Exception {
    final RelationshipType other = types().create(request(uniqueName("invRefC"), null));
    final Pair pair = createPairLikeTheUi();
    try {
      final String patch =
          "[{\"op\":\"replace\",\"path\":\"/inverse/fullyQualifiedName\",\"value\":\""
              + other.getName()
              + "\"}]";
      assertThrows(
          InvalidRequestException.class,
          () -> types().patch(pair.forward().getId(), OBJECT_MAPPER.readTree(patch)));
      assertNamedInverse(types().get(pair.forward().getId()), pair.inverse());
    } finally {
      deleteTypes(pair);
      types().delete(other.getId().toString(), true);
    }
  }

  /**
   * A reference stored before references carried both a name and an FQN, as main stored it or as a
   * name alone, still blocks deleting the type it names.
   */
  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void aReferenceStoredWithoutItsNameOrFqnStillBlocksTheDelete(final boolean storedLikeMain) {
    final RelationshipType referenced = types().create(request(uniqueName("guarded"), null));
    final RelationshipType referrer =
        types()
            .create(
                request(uniqueName("referrer"), null)
                    .withDisjointWith(Set.of(referenced.getName())));
    try {
      storeRow(
          stored(referrer.getId())
              .withDisjointWith(
                  Set.of(
                      storedLikeMain
                          ? withoutName(referenceTo(referenced))
                          : nameOnly(referenced))));
      final EntityReference raw = stored(referrer.getId()).getDisjointWith().iterator().next();
      assertEquals(storedLikeMain, raw.getName() == null && raw.getFullyQualifiedName() != null);

      final InvalidRequestException refused =
          assertThrows(
              InvalidRequestException.class,
              () -> types().delete(referenced.getId().toString(), false));

      assertTrue(
          refused.getMessage().contains("'" + referrer.getName() + "'"), refused.getMessage());
      assertFalse(Boolean.TRUE.equals(types().get(referenced.getId()).getDeleted()));
    } finally {
      types().delete(referrer.getId().toString(), true);
      types().delete(referenced.getId().toString(), true);
    }
  }

  /** Restoring one side of a pair main stored without names links the partner back named. */
  @Test
  void restoreLinksAPartnerStoredWithoutNamesBackWithTheNamedReference() {
    final Pair pair = createPairLikeTheUi();
    try {
      for (final RelationshipType type : List.of(pair.forward(), pair.inverse())) {
        final RelationshipType row = stored(type.getId());
        storeRow(row.withInverse(withoutName(row.getInverse())));
      }
      types().delete(pair.forward().getId().toString(), false);
      assertNull(stored(pair.inverse().getId()).getInverse());

      types().restore(pair.forward().getId());

      final EntityReference backLink = stored(pair.inverse().getId()).getInverse();
      assertEquals(referenceTo(types().get(pair.forward().getId())), backLink);
      assertNamedInverse(types().get(pair.forward().getId()), pair.inverse());
    } finally {
      deleteTypes(pair);
    }
  }

  private static EntityReference referenceTo(final RelationshipType type) {
    return new EntityReference()
        .withId(type.getId())
        .withType(Entity.RELATIONSHIP_TYPE)
        .withName(type.getName())
        .withFullyQualifiedName(type.getFullyQualifiedName());
  }

  private static EntityReference withoutName(final EntityReference reference) {
    return new EntityReference()
        .withId(reference.getId())
        .withType(Entity.RELATIONSHIP_TYPE)
        .withFullyQualifiedName(reference.getFullyQualifiedName());
  }

  private static EntityReference nameOnly(final RelationshipType type) {
    return new EntityReference().withType(Entity.RELATIONSHIP_TYPE).withName(type.getName());
  }

  /** The row as stored, without the names the API fills in on read. */
  private static RelationshipType stored(final UUID id) {
    return storedTypes().findEntityById(id, Include.ALL);
  }

  /** These tests run in-process with the server, so a row can be stored the way main stored it. */
  private static void storeRow(final RelationshipType row) {
    storedTypes().update(row);
    EntityRepository.invalidateCacheForEntity(
        Entity.RELATIONSHIP_TYPE, row.getId(), row.getFullyQualifiedName());
  }

  @SuppressWarnings("unchecked")
  private static EntityDAO<RelationshipType> storedTypes() {
    return ((EntityRepository<RelationshipType>)
            Entity.getEntityRepository(Entity.RELATIONSHIP_TYPE))
        .getDao();
  }

  private static CreateRelationshipType requestLikeTheSettingsPage(final RelationshipType type) {
    return new CreateRelationshipType()
        .withName(type.getName())
        .withDisplayName(type.getDisplayName())
        .withDescription(type.getDescription())
        .withIri(type.getIri())
        .withRdfPredicate(type.getRdfPredicate())
        .withCategory(type.getCategory())
        .withInverse(referenceName(type.getInverse()))
        .withDomain(new ArrayList<>(type.getDomain()))
        .withRange(new ArrayList<>(type.getRange()))
        .withCharacteristics(type.getCharacteristics())
        .withCardinality(type.getCardinality())
        .withPropertyChain(
            type.getPropertyChain().stream()
                .map(RelationshipTypeInverseReferenceIT::referenceName)
                .toList())
        .withDisjointWith(
            type.getDisjointWith().stream()
                .map(RelationshipTypeInverseReferenceIT::referenceName)
                .collect(Collectors.toSet()))
        .withCrossGlossaryAllowed(type.getCrossGlossaryAllowed())
        .withPaletteKey(type.getPaletteKey())
        .withReplacedBy(referenceName(type.getReplacedBy()))
        .withEntityStatus(type.getEntityStatus());
  }

  private static String referenceName(final EntityReference reference) {
    return reference == null
        ? null
        : reference.getFullyQualifiedName() == null
            ? reference.getName()
            : reference.getFullyQualifiedName();
  }

  private static Pair createPairLikeTheUi() {
    final String forwardName = uniqueName("invRefA");
    final String inverseName = uniqueName("invRefB");
    types().create(request(inverseName, null));
    final RelationshipType forward = types().create(request(forwardName, inverseName));
    final RelationshipType inverse = types().upsert(request(inverseName, forwardName));
    return new Pair(forward, inverse);
  }

  /** A term relation names its type in a query parameter that admits letters and digits only. */
  private static String uniqueName(final String base) {
    return base + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
  }

  private static CreateRelationshipType request(final String name, final String inverse) {
    return new CreateRelationshipType()
        .withName(name)
        .withDisplayName(name)
        .withDescription(name)
        .withRdfPredicate(URI.create("https://example.org/inverse-reference/" + name))
        .withCategory(RelationshipTypeCategory.CUSTOM)
        .withPaletteKey(RelationshipPaletteKey.BLUE)
        .withInverse(inverse);
  }

  private static void assertNamedInverse(
      final RelationshipType type, final RelationshipType partner) {
    final EntityReference inverse = type.getInverse();
    assertEquals(partner.getName(), inverse.getName(), type.getName() + " inverse name");
    assertEquals(partner.getId(), inverse.getId(), type.getName() + " inverse id");
    assertEquals(partner.getName(), inverse.getFullyQualifiedName());
  }

  private static RelationshipType listed(final String name) {
    String after = null;
    RelationshipType found = null;
    do {
      final ListResponse<RelationshipType> page =
          types().list(new ListParams().setLimit(200).setAfter(after));
      found =
          page.getData().stream()
              .filter(type -> name.equals(type.getName()))
              .findFirst()
              .orElse(null);
      after = page.getPaging() == null ? null : page.getPaging().getAfter();
    } while (found == null && after != null);
    assertTrue(found != null, name + " is listed");
    return found;
  }

  private static List<GlossaryTerm> termsSortedById(
      final TestNamespace ns, final Glossary glossary) {
    final List<GlossaryTerm> terms = new ArrayList<>();
    for (final String name : List.of("t1", "t2", "t3", "t4")) {
      terms.add(GlossaryTermTestFactory.createWithName(ns, glossary, name));
    }
    terms.sort(Comparator.comparing(GlossaryTerm::getId));
    return terms;
  }

  private static void assertEdgeReads(
      final Edge edge,
      final Pair pair,
      final List<TermRelation> sourceRelations,
      final List<TermRelation> targetRelations) {
    assertEquals(
        Set.of(pair.forward().getName()),
        typesTowards(sourceRelations, edge.target()),
        "author end of " + edge);
    assertEquals(
        Set.of(pair.inverse().getName()),
        typesTowards(targetRelations, edge.source()),
        "far end of " + edge);
  }

  private static Set<String> typesTowards(
      final List<TermRelation> relations, final GlossaryTerm other) {
    return relations.stream()
        .filter(relation -> other.getId().equals(relation.getTerm().getId()))
        .map(TermRelation::getRelationType)
        .collect(Collectors.toSet());
  }

  private static List<TermRelation> relationsOf(final GlossaryTerm term) {
    final List<TermRelation> relations =
        SdkClients.adminClient()
            .glossaryTerms()
            .get(term.getId().toString(), "relatedTerms")
            .getRelatedTerms();
    return relations == null ? List.of() : relations;
  }

  private static Map<UUID, List<TermRelation>> listedRelations(final Glossary glossary) {
    final ListResponse<GlossaryTerm> page =
        SdkClients.adminClient()
            .glossaryTerms()
            .list(
                new ListParams()
                    .setLimit(50)
                    .setFields("relatedTerms")
                    .addFilter("glossary", glossary.getId().toString()));
    return page.getData().stream()
        .collect(
            Collectors.toMap(
                GlossaryTerm::getId,
                term -> term.getRelatedTerms() == null ? List.of() : term.getRelatedTerms()));
  }

  /** The export states each edge from both ends and never the forward type from the far end. */
  private static void assertExportedEdges(
      final Glossary glossary, final Pair pair, final List<Edge> edges) throws Exception {
    final Model model = RDFParser.fromString(exportOntology(glossary), Lang.TURTLE).toModel();
    final Property forward = model.createProperty(pair.forward().getRdfPredicate().toString());
    final Property inverse = model.createProperty(pair.inverse().getRdfPredicate().toString());
    assertTrue(model.contains(forward, OWL2.inverseOf, inverse), "A owl:inverseOf B");
    assertTrue(model.contains(inverse, OWL2.inverseOf, forward), "B owl:inverseOf A");
    for (final Edge edge : edges) {
      final Resource source = termResource(model, edge.source());
      final Resource target = termResource(model, edge.target());
      assertTrue(model.contains(source, forward, target), "exported " + edge);
      assertTrue(model.contains(target, inverse, source), "exported inverse of " + edge);
      assertFalse(model.contains(target, forward, source), "reversed forward edge of " + edge);
    }
  }

  private static Resource termResource(final Model model, final GlossaryTerm term) {
    return model
        .listSubjects()
        .filterKeep(
            subject ->
                subject.isURIResource() && subject.getURI().endsWith(term.getId().toString()))
        .nextOptional()
        .orElseThrow(() -> new AssertionError(term.getName() + " missing from the export"));
  }

  private static String exportOntology(final Glossary glossary) throws Exception {
    final HttpRequest request =
        HttpRequest.newBuilder()
            .uri(
                URI.create(
                    SdkClients.getServerUrl()
                        + "/v1/glossaries/"
                        + glossary.getId()
                        + "/exportOntology?format=turtle"))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .timeout(Duration.ofSeconds(60))
            .GET()
            .build();
    final HttpResponse<String> response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
    assertEquals(200, response.statusCode(), response.body());
    return response.body();
  }

  private static void removeRelation(
      final GlossaryTerm from, final GlossaryTerm to, final RelationshipType type) {
    SdkClients.adminClient()
        .glossaryTerms()
        .removeRelation(from.getId(), to.getId(), type.getName());
  }

  private static void deleteGlossary(final Glossary glossary) {
    SdkClients.adminClient()
        .glossaries()
        .delete(glossary.getId().toString(), Map.of("hardDelete", "true", "recursive", "true"));
  }

  private static void deleteTypes(final Pair pair) {
    types().delete(pair.forward().getId().toString(), true);
    types().delete(pair.inverse().getId().toString(), true);
  }

  private static RelationshipTypeService types() {
    return SdkClients.adminClient().relationshipTypes();
  }

  private record Pair(RelationshipType forward, RelationshipType inverse) {}

  private record Edge(GlossaryTerm source, GlossaryTerm target) {
    @Override
    public String toString() {
      return source.getName() + " -> " + target.getName();
    }
  }
}
