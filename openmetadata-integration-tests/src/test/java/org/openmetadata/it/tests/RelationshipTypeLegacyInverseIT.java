package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.GlossaryTermTestFactory;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.util.NamespaceCleanup;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateRelationshipType;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.RelationshipCharacteristic;
import org.openmetadata.schema.type.RelationshipPaletteKey;
import org.openmetadata.schema.type.RelationshipTypeCategory;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.schema.type.TermRelationMetadata;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.OntologyRelationshipRow;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Existing inverse metadata must not silently reinterpret stored term relations. */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class RelationshipTypeLegacyInverseIT {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final Logger LOG = LoggerFactory.getLogger(RelationshipTypeLegacyInverseIT.class);
  private final List<UUID> typeIds = new ArrayList<>();
  private OpenMetadataClient client;
  private Glossary glossary;
  private CreateRelationshipType forwardRequest;
  private CreateRelationshipType inverseRequest;
  private RelationshipType forward;
  private RelationshipType inverse;

  @BeforeEach
  void setup(TestNamespace ns) {
    client = SdkClients.adminClient();
    glossary = GlossaryTestFactory.createSimple(ns);
    inverseRequest = typeRequest("inverse" + ns.uniqueShortId());
    inverse = client.relationshipTypes().create(inverseRequest);
    typeIds.add(inverse.getId());
    forwardRequest = typeRequest("forward" + ns.uniqueShortId()).withInverse(inverse.getName());
    forward = client.relationshipTypes().create(forwardRequest);
    typeIds.add(forward.getId());
    inverseRequest.withInverse(forward.getName());
    inverse = client.relationshipTypes().upsert(inverseRequest);
  }

  @AfterEach
  void cleanup(TestNamespace ns) {
    NamespaceCleanup.deleteRoots(ns.drainTrackedRoots());
    for (UUID id : typeIds) {
      client.relationshipTypes().delete(id.toString(), true);
    }
  }

  @Test
  void removingHealthyInverseNamePreservesThePair(TestNamespace ns) {
    assertHealthyPatchPreservesEdges(
        ns,
        MAPPER
            .createArrayNode()
            .add(MAPPER.createObjectNode().put("op", "remove").put("path", "/inverse/name")));
  }

  @Test
  void idOnlyInversePatchResolvesItsName(TestNamespace ns) {
    assertHealthyPatchPreservesEdges(
        ns,
        inversePatch(
            new EntityReference().withId(inverse.getId()).withType(Entity.RELATIONSHIP_TYPE)));
  }

  @Test
  void inverseIdOverridesAContradictoryFqn(TestNamespace ns) {
    assertHealthyPatchPreservesEdges(
        ns,
        inversePatch(
            new EntityReference()
                .withId(inverse.getId())
                .withType(Entity.RELATIONSHIP_TYPE)
                .withFullyQualifiedName(forward.getFullyQualifiedName())));
  }

  @Test
  void partialReciprocalPatchCreatesAWorkingPair(TestNamespace ns) {
    final CreateRelationshipType backRequest = typeRequest("partialBack" + ns.uniqueShortId());
    final RelationshipType back = client.relationshipTypes().create(backRequest);
    typeIds.add(back.getId());
    final RelationshipType front =
        client
            .relationshipTypes()
            .create(typeRequest("partialFront" + ns.uniqueShortId()).withInverse(back.getName()));
    typeIds.add(front.getId());
    final RelationshipType saved =
        client
            .relationshipTypes()
            .patch(
                back.getId(),
                inversePatch(
                    new EntityReference()
                        .withId(front.getId())
                        .withType(Entity.RELATIONSHIP_TYPE)
                        .withFullyQualifiedName(front.getFullyQualifiedName())));
    assertResolvedReference(saved, front);
    final List<GlossaryTerm> ascending = orderedTerms(ns, "partialAscending");
    final List<GlossaryTerm> descending = orderedTerms(ns, "partialDescending");
    postEdge(ascending.getFirst(), ascending.getLast(), front.getName());
    postEdge(descending.getLast(), descending.getFirst(), front.getName());
    assertPerspective(ascending.getFirst(), ascending.getLast(), front);
    assertPerspective(ascending.getLast(), ascending.getFirst(), back);
    assertPerspective(descending.getLast(), descending.getFirst(), front);
    assertPerspective(descending.getFirst(), descending.getLast(), back);
  }

  @Test
  void selfIdOnlyPatchPreservesItsNameAndEdge(TestNamespace ns) {
    final String name = "selfPatch" + ns.uniqueShortId();
    final RelationshipType self =
        client
            .relationshipTypes()
            .create(
                typeRequest(name)
                    .withInverse(name)
                    .withCharacteristics(Set.of(RelationshipCharacteristic.SYMMETRIC)));
    typeIds.add(self.getId());
    final List<GlossaryTerm> terms = orderedTerms(ns, "selfPatch");
    postEdge(terms.getLast(), terms.getFirst(), name);
    final OntologyRelationshipRow row = storedRow(terms.getFirst(), terms.getLast());
    final RelationshipType saved =
        client
            .relationshipTypes()
            .patch(
                self.getId(),
                inversePatch(
                    new EntityReference().withId(self.getId()).withType(Entity.RELATIONSHIP_TYPE)));
    assertResolvedReference(saved, self);
    assertPerspective(terms.getFirst(), terms.getLast(), self);
    assertPerspective(terms.getLast(), terms.getFirst(), self);
    assertEquals(row, storedRow(terms.getFirst(), terms.getLast()));
  }

  @Test
  void unknownInverseIdCannotFallBackToARegisteredFqn(TestNamespace ns) {
    final List<GlossaryTerm> terms = orderedTerms(ns, "unknownInverse");
    postEdge(terms.getLast(), terms.getFirst(), forward.getName());
    final RelationshipType original = reload(forward);
    final OntologyRelationshipRow row = storedRow(terms.getFirst(), terms.getLast());
    assertThrows(
        InvalidRequestException.class,
        () ->
            client
                .relationshipTypes()
                .patch(
                    forward.getId(),
                    inversePatch(
                        new EntityReference()
                            .withId(UUID.randomUUID())
                            .withType(Entity.RELATIONSHIP_TYPE)
                            .withFullyQualifiedName(inverse.getFullyQualifiedName()))));
    assertResolvedReference(reload(forward), inverse);
    assertEquals(original.getVersion(), reload(forward).getVersion());
    assertEquals(row, storedRow(terms.getFirst(), terms.getLast()));
  }

  @Test
  void unchangedPutPreservesLegacyReferencesAndBothUuidDirections(TestNamespace ns) {
    List<GlossaryTerm> healthy = orderedTerms(ns, "healthy");
    postEdge(healthy.getLast(), healthy.getFirst(), inverse.getName());
    makePairNameless();
    List<GlossaryTerm> ascending = orderedTerms(ns, "ascending");
    List<GlossaryTerm> descending = orderedTerms(ns, "descending");
    postEdge(ascending.getFirst(), ascending.getLast(), forward.getName());
    postEdge(descending.getLast(), descending.getFirst(), forward.getName());
    List<OntologyRelationshipRow> rows =
        List.of(
            storedRow(ascending.getFirst(), ascending.getLast()),
            storedRow(descending.getFirst(), descending.getLast()),
            storedRow(healthy.getFirst(), healthy.getLast()));
    List<EdgeView> before = views(ascending, descending, healthy);

    RelationshipType saved =
        client.relationshipTypes().upsert(forwardRequest.withDescription("An ordinary form edit"));
    assertEquals("An ordinary form edit", saved.getDescription());
    assertNamelessReference(saved, inverse);
    assertNamelessReference(client.relationshipTypes().upsert(inverseRequest), forward);
    assertEquals(before, views(ascending, descending, healthy));
    assertEquals(
        rows,
        List.of(
            storedRow(ascending.getFirst(), ascending.getLast()),
            storedRow(descending.getFirst(), descending.getLast()),
            storedRow(healthy.getFirst(), healthy.getLast())));
  }

  @Test
  void putOmittingInversePreservesTheLegacyReference(TestNamespace ns) {
    makePairNameless();
    List<GlossaryTerm> terms = orderedTerms(ns, "omitted");
    postEdge(terms.getLast(), terms.getFirst(), forward.getName());
    OntologyRelationshipRow before = storedRow(terms.getFirst(), terms.getLast());
    RelationshipType saved = client.relationshipTypes().upsert(forwardRequest.withInverse(null));
    assertNamelessReference(saved, inverse);
    assertEquals(before, storedRow(terms.getFirst(), terms.getLast()));
  }

  @Test
  void unrelatedPatchesPreserveLegacyMetadataAcrossSessionConsolidation(TestNamespace ns) {
    makePairNameless();
    List<GlossaryTerm> terms = orderedTerms(ns, "patch");
    postEdge(terms.getLast(), terms.getFirst(), forward.getName());
    List<EdgeView> before =
        List.of(
            edgeView(terms.getFirst(), terms.getLast()),
            edgeView(terms.getLast(), terms.getFirst()));
    OntologyRelationshipRow row = storedRow(terms.getFirst(), terms.getLast());
    RelationshipType first = patchForward("replace", "/description", "First unrelated edit");
    RelationshipType second = patchForward("replace", "/displayName", "Second unrelated edit");
    assertNamelessReference(first, inverse);
    assertNamelessReference(second, inverse);
    assertEquals("First unrelated edit", second.getDescription());
    assertEquals("Second unrelated edit", second.getDisplayName());
    assertEquals(first.getVersion(), second.getVersion(), "same-session PATCHes must consolidate");
    assertEquals(
        before,
        List.of(
            edgeView(terms.getFirst(), terms.getLast()),
            edgeView(terms.getLast(), terms.getFirst())));
    assertEquals(row, storedRow(terms.getFirst(), terms.getLast()));
  }

  @Test
  void explicitPatchCannotActivateOrRemoveLegacyInverseEvenWithoutEdges() {
    makePairNameless();
    RelationshipType before = reload(forward);
    InvalidRequestException activation =
        assertThrows(
            InvalidRequestException.class,
            () -> patchForward("add", "/inverse/name", inverse.getName()));
    assertTrue(activation.getMessage().contains("legacy inverse"));
    assertThrows(
        InvalidRequestException.class,
        () ->
            client
                .relationshipTypes()
                .patch(
                    forward.getId(),
                    MAPPER
                        .createArrayNode()
                        .add(
                            MAPPER
                                .createObjectNode()
                                .put("op", "remove")
                                .put("path", "/inverse"))));
    assertEquals(before.getVersion(), reload(forward).getVersion());
    assertNamelessReference(reload(forward), inverse);
  }

  @Test
  void inverseRetargetIsRejectedForPutAndPatch(TestNamespace ns) {
    makePairNameless();
    List<GlossaryTerm> terms = orderedTerms(ns, "retarget");
    postEdge(terms.getLast(), terms.getFirst(), forward.getName());
    OntologyRelationshipRow before = storedRow(terms.getFirst(), terms.getLast());
    RelationshipType originalDefinition = reload(forward);
    RelationshipType other =
        client.relationshipTypes().create(typeRequest("other" + ns.uniqueShortId()));
    typeIds.add(other.getId());
    assertThrows(
        InvalidRequestException.class,
        () ->
            client
                .relationshipTypes()
                .upsert(
                    forwardRequest
                        .withInverse(other.getName())
                        .withDescription("This rejected edit must not be stored")));
    assertThrows(
        InvalidRequestException.class,
        () ->
            client
                .relationshipTypes()
                .patch(
                    forward.getId(),
                    MAPPER
                        .createArrayNode()
                        .add(
                            MAPPER
                                .createObjectNode()
                                .put("op", "replace")
                                .put("path", "/inverse")
                                .set("value", MAPPER.valueToTree(other.getEntityReference())))));
    assertNamelessReference(reload(forward), inverse);
    assertEquals(originalDefinition.getDescription(), reload(forward).getDescription());
    assertEquals(originalDefinition.getVersion(), reload(forward).getVersion());
    assertEquals(before, storedRow(terms.getFirst(), terms.getLast()));
  }

  @Test
  void forgedSelfIdentityCannotActivateAnotherInverseName() {
    makePairNameless();
    EntityReference forged = forward.getEntityReference().withName(inverse.getName());
    assertThrows(
        InvalidRequestException.class,
        () ->
            client
                .relationshipTypes()
                .patch(
                    forward.getId(),
                    MAPPER
                        .createArrayNode()
                        .add(
                            MAPPER
                                .createObjectNode()
                                .put("op", "replace")
                                .put("path", "/inverse")
                                .set("value", MAPPER.valueToTree(forged)))));
    assertNamelessReference(reload(forward), inverse);
  }

  @Test
  void fqnOnlyLegacyDefinitionAndNameBackedEdgeArePreserved(TestNamespace ns) {
    makePairNameless();
    List<GlossaryTerm> terms = orderedTerms(ns, "legacyColumns");
    postEdge(terms.getLast(), terms.getFirst(), forward.getName());
    RelationshipType stored = reload(forward);
    stored.getInverse().setId(null);
    Entity.getCollectionDAO().relationshipTypeDAO().update(stored);
    EntityRepository.invalidateCacheForEntity(
        Entity.RELATIONSHIP_TYPE, stored.getId(), stored.getFullyQualifiedName());
    Entity.getJdbi()
        .useHandle(
            handle ->
                handle
                    .createUpdate(
                        "UPDATE entity_relationship SET relationshipTypeId = NULL WHERE fromId = :low AND toId = :high AND relation = :relation")
                    .bind("low", terms.getFirst().getId().toString())
                    .bind("high", terms.getLast().getId().toString())
                    .bind("relation", Relationship.RELATED_TO.ordinal())
                    .execute());
    OntologyRelationshipRow row = storedRow(terms.getFirst(), terms.getLast());
    RelationshipType patched = patchForward("replace", "/description", "FQN-only reference edit");
    assertNull(patched.getInverse().getName());
    assertNull(patched.getInverse().getId());
    RelationshipType saved = client.relationshipTypes().upsert(forwardRequest);
    assertNull(saved.getInverse().getName());
    assertNull(saved.getInverse().getId());
    assertEquals(inverse.getFullyQualifiedName(), saved.getInverse().getFullyQualifiedName());
    assertEquals(row, storedRow(terms.getFirst(), terms.getLast()));
  }

  @Test
  void selfInverseHydrationPreservesBothPerspectives(TestNamespace ns) {
    String name = "self" + ns.uniqueShortId();
    CreateRelationshipType request =
        typeRequest(name)
            .withInverse(name)
            .withCharacteristics(Set.of(RelationshipCharacteristic.SYMMETRIC));
    RelationshipType self = client.relationshipTypes().create(request);
    typeIds.add(self.getId());
    seedNamelessInverse(self);
    List<GlossaryTerm> terms = orderedTerms(ns, "self");
    postEdge(terms.getLast(), terms.getFirst(), self.getName());
    OntologyRelationshipRow before = storedRow(terms.getFirst(), terms.getLast());
    RelationshipType saved = client.relationshipTypes().upsert(request);
    assertEquals(name, saved.getInverse().getName());
    assertPerspective(terms.getFirst(), terms.getLast(), self);
    assertPerspective(terms.getLast(), terms.getFirst(), self);
    assertEquals(before, storedRow(terms.getFirst(), terms.getLast()));
  }

  @SafeVarargs
  private final List<EdgeView> views(List<GlossaryTerm>... pairs) {
    List<EdgeView> views = new ArrayList<>();
    for (List<GlossaryTerm> pair : pairs) {
      views.add(edgeView(pair.getFirst(), pair.getLast()));
      views.add(edgeView(pair.getLast(), pair.getFirst()));
    }
    return views;
  }

  private void assertHealthyPatchPreservesEdges(TestNamespace ns, JsonNode patch) {
    final List<GlossaryTerm> ascending = orderedTerms(ns, "healthyAscending");
    final List<GlossaryTerm> descending = orderedTerms(ns, "healthyDescending");
    postEdge(ascending.getFirst(), ascending.getLast(), forward.getName());
    postEdge(descending.getLast(), descending.getFirst(), forward.getName());
    final List<EdgeView> before = views(ascending, descending);
    final List<OntologyRelationshipRow> rows =
        List.of(
            storedRow(ascending.getFirst(), ascending.getLast()),
            storedRow(descending.getFirst(), descending.getLast()));
    assertResolvedReference(client.relationshipTypes().patch(forward.getId(), patch), inverse);
    assertResolvedReference(patchForward("add", "/inverse/name", inverse.getName()), inverse);
    assertResolvedReference(client.relationshipTypes().upsert(forwardRequest), inverse);
    assertEquals(before, views(ascending, descending));
    assertEquals(
        rows,
        List.of(
            storedRow(ascending.getFirst(), ascending.getLast()),
            storedRow(descending.getFirst(), descending.getLast())));
    final List<GlossaryTerm> next = orderedTerms(ns, "afterHealthyPatch");
    postEdge(next.getLast(), next.getFirst(), forward.getName());
    assertPerspective(next.getLast(), next.getFirst(), forward);
    assertPerspective(next.getFirst(), next.getLast(), inverse);
  }

  private static JsonNode inversePatch(EntityReference reference) {
    return MAPPER
        .createArrayNode()
        .add(
            MAPPER
                .createObjectNode()
                .put("op", "add")
                .put("path", "/inverse")
                .set("value", MAPPER.valueToTree(reference)));
  }

  private static void assertResolvedReference(RelationshipType type, RelationshipType expected) {
    assertNotNull(type.getInverse());
    assertEquals(expected.getId(), type.getInverse().getId());
    assertEquals(expected.getName(), type.getInverse().getName());
    assertEquals(expected.getFullyQualifiedName(), type.getInverse().getFullyQualifiedName());
  }

  private record EdgeView(
      UUID id,
      UUID targetId,
      String relationType,
      UUID typeId,
      String typeName,
      String typeFqn,
      RelationProvenance provenance,
      EntityStatus status,
      String createdBy,
      Long createdAt) {}

  private EdgeView edgeView(GlossaryTerm source, GlossaryTerm target) {
    TermRelation edge = edge(source, target);
    EntityReference type = edge.getRelationshipType();
    return new EdgeView(
        edge.getId(),
        edge.getTerm().getId(),
        edge.getRelationType(),
        type.getId(),
        type.getName(),
        type.getFullyQualifiedName(),
        edge.getProvenance(),
        edge.getStatus(),
        edge.getCreatedBy(),
        edge.getCreatedAt());
  }

  private TermRelation edge(GlossaryTerm source, GlossaryTerm target) {
    return client
        .glossaryTerms()
        .get(source.getId().toString(), "relatedTerms")
        .getRelatedTerms()
        .stream()
        .filter(relation -> target.getId().equals(relation.getTerm().getId()))
        .findFirst()
        .orElseThrow();
  }

  private RelationshipType patchForward(String op, String path, String value) {
    return client
        .relationshipTypes()
        .patch(
            forward.getId(),
            MAPPER
                .createArrayNode()
                .add(
                    MAPPER.createObjectNode().put("op", op).put("path", path).put("value", value)));
  }

  private void makePairNameless() {
    for (RelationshipType type : List.of(forward, inverse)) {
      seedNamelessInverse(type);
    }
    assertNamelessReference(reload(forward), inverse);
    assertNamelessReference(reload(inverse), forward);
  }

  private void seedNamelessInverse(final RelationshipType type) {
    // Historical fixtures must bypass the API protection against dropping a resolved name.
    final RelationshipType stored = reload(type);
    stored.getInverse().setName(null);
    Entity.getCollectionDAO().relationshipTypeDAO().update(stored);
    EntityRepository.invalidateCacheForEntity(
        Entity.RELATIONSHIP_TYPE, stored.getId(), stored.getFullyQualifiedName());
  }

  private RelationshipType reload(RelationshipType type) {
    return client.relationshipTypes().get(type.getId().toString());
  }

  private static void assertNamelessReference(RelationshipType type, RelationshipType expected) {
    assertNotNull(type.getInverse());
    assertNull(type.getInverse().getName());
    assertEquals(expected.getId(), type.getInverse().getId());
    assertEquals(expected.getFullyQualifiedName(), type.getInverse().getFullyQualifiedName());
  }

  private List<GlossaryTerm> orderedTerms(TestNamespace ns, String prefix) {
    return List.of(
            GlossaryTermTestFactory.createWithName(ns, glossary, prefix + "A"),
            GlossaryTermTestFactory.createWithName(ns, glossary, prefix + "B"))
        .stream()
        .sorted(Comparator.comparing(GlossaryTerm::getId))
        .toList();
  }

  private void postEdge(GlossaryTerm source, GlossaryTerm target, String type) {
    client
        .getHttpClient()
        .execute(
            HttpMethod.POST,
            "/v1/glossaryTerms/" + source.getId() + "/relations",
            new TermRelation()
                .withTerm(
                    new EntityReference().withId(target.getId()).withType(Entity.GLOSSARY_TERM))
                .withRelationType(type),
            GlossaryTerm.class);
  }

  private TermRelation assertPerspective(
      GlossaryTerm source, GlossaryTerm target, RelationshipType expected) {
    GlossaryTerm reloaded = client.glossaryTerms().get(source.getId().toString(), "relatedTerms");
    TermRelation edge =
        reloaded.getRelatedTerms().stream()
            .filter(relation -> target.getId().equals(relation.getTerm().getId()))
            .findFirst()
            .orElseThrow();
    assertEquals(expected.getName(), edge.getRelationType());
    assertEquals(expected.getId(), edge.getRelationshipType().getId());
    return edge;
  }

  private OntologyRelationshipRow storedRow(GlossaryTerm low, GlossaryTerm high) {
    OntologyRelationshipRow row =
        Entity.getJdbi()
            .withHandle(
                handle ->
                    handle
                        .createQuery(
                            "SELECT fromId, toId, fromEntity, toEntity, relation, relationType, "
                                + "relationshipId, relationshipTypeId, json FROM entity_relationship "
                                + "WHERE fromId = :fromId AND toId = :toId "
                                + "AND fromEntity = :entity AND toEntity = :entity AND relation = :relation")
                        .bind("fromId", low.getId().toString())
                        .bind("toId", high.getId().toString())
                        .bind("entity", Entity.GLOSSARY_TERM)
                        .bind("relation", Relationship.RELATED_TO.ordinal())
                        .map(
                            (result, context) ->
                                new OntologyRelationshipRow(
                                    UUID.fromString(result.getString("fromId")),
                                    UUID.fromString(result.getString("toId")),
                                    result.getString("fromEntity"),
                                    result.getString("toEntity"),
                                    result.getInt("relation"),
                                    result.getString("relationType"),
                                    UUID.fromString(result.getString("relationshipId")),
                                    result.getString("relationshipTypeId") == null
                                        ? null
                                        : UUID.fromString(result.getString("relationshipTypeId")),
                                    result.getString("json")))
                        .one());
    TermRelationMetadata metadata = JsonUtils.readValue(row.json(), TermRelationMetadata.class);
    assertEquals(low.getId(), row.fromId());
    assertEquals(high.getId(), row.toId());
    assertEquals(metadata.getRelationType(), row.relationType());

    assertEquals(metadata.getId(), row.relationshipId());
    LOG.info("HISTORICAL_SQL_ROW {}", row);
    return row;
  }

  private static CreateRelationshipType typeRequest(String name) {
    return new CreateRelationshipType()
        .withName(name)
        .withDisplayName(name)
        .withDescription("Historical inverse-reference verification")
        .withRdfPredicate(URI.create("https://example.org/historical/" + name))
        .withCategory(RelationshipTypeCategory.CUSTOM)
        .withPaletteKey(RelationshipPaletteKey.BLUE);
  }
}
