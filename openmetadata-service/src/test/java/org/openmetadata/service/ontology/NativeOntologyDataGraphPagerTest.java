package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.macasaet.fernet.Key;
import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.NativeOntologyAssetCluster;
import org.openmetadata.schema.api.data.NativeOntologyDataGraphPageRequest;
import org.openmetadata.schema.api.data.NativeOntologyGraphPageSelection;
import org.openmetadata.schema.api.data.NativeOntologyGraphPageSelection.Kind;
import org.openmetadata.schema.api.data.NativeOntologyLoadedPrefix;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyExpressionKind;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.jdbi3.OntologyDAO.LineagePosition;
import org.openmetadata.service.jdbi3.OntologyReferenceDAO.EdgeAxiomRow;
import org.openmetadata.service.ontology.NativeOntologyDataGraphPager.Cursor;
import org.openmetadata.service.ontology.NativeOntologyDataGraphService.Cluster;
import org.openmetadata.service.util.RestUtil;

class NativeOntologyDataGraphPagerTest {
  private static final NativeOntologyTopologyCursorCodec CODEC =
      new NativeOntologyTopologyCursorCodec(List.of(Key.generateKey()));

  @Test
  void contextDigestIsOrderIndependentAndIncludesScopeRevisionAndScanTail() {
    final UUID ontology = UUID.randomUUID();
    final var first = prefix(1, 3, 4);
    final var second = prefix(2, 5, 6);
    final String digest = NativeOntologyDataGraphPager.digest(ontology, List.of(first, second));
    assertEquals(digest, NativeOntologyDataGraphPager.digest(ontology, List.of(second, first)));
    assertNotEquals(
        digest, NativeOntologyDataGraphPager.digest(UUID.randomUUID(), List.of(first, second)));
    assertNotEquals(
        digest, NativeOntologyDataGraphPager.digest(ontology, List.of(prefix(1, 4, 4), second)));
    assertNotEquals(
        digest, NativeOntologyDataGraphPager.digest(ontology, List.of(prefix(1, 3, 5), second)));
  }

  @Test
  void pageSelectionRejectsMixedKindsDuplicatePrefixesAndOverLimitContext() {
    final var selection =
        new NativeOntologyGraphPageSelection().withKind(Kind.CLUSTERS).withOffset(0).withLimit(12);
    final var request =
        new NativeOntologyDataGraphPageRequest().withLoaded(List.of()).withPage(selection);
    NativeOntologyDataGraphPager.validate(request);
    assertThrows(
        BadRequestException.class,
        () ->
            NativeOntologyDataGraphPager.validate(request.withPage(selection.withAfter("cursor"))));
    selection.withAfter(null).withLimit(13);
    assertThrows(BadRequestException.class, () -> NativeOntologyDataGraphPager.validate(request));
    selection.withLimit(1);
    request.withLoaded(List.of(prefix(1, 0, 1), prefix(1, 0, 2)));
    assertThrows(BadRequestException.class, () -> NativeOntologyDataGraphPager.validate(request));
    request.withLoaded(IntStream.range(0, 61).mapToObj(i -> prefix(i, 0, 1)).toList());
    assertThrows(BadRequestException.class, () -> NativeOntologyDataGraphPager.validate(request));
  }

  @Test
  void anEmptyBindingPageAdvancesItsHiddenScanTailAndExhaustionRetainsThePrefix() {
    final UUID previous = new UUID(0, 4);
    final UUID hiddenTail = new UUID(0, 20);
    assertEquals(
        hiddenTail,
        NativeOntologyDataGraphPager.through(
            previous, RestUtil.encodeCursor(hiddenTail.toString()), List.of()));
    assertEquals(previous, NativeOntologyDataGraphPager.through(previous, null, List.of()));
    assertEquals(
        new UUID(0, 30),
        NativeOntologyDataGraphPager.through(previous, null, List.of(new UUID(0, 30))));
  }

  @Test
  void aSingleAxiomCanContinueAcrossTheFiveHundredEdgeBoundary() {
    final UUID concept = UUID.randomUUID();
    final UUID target = UUID.randomUUID();
    final UUID axiomId = UUID.randomUUID();
    final var expressions =
        IntStream.range(0, 501)
            .mapToObj(
                index ->
                    new OntologyExpression()
                        .withKind(OntologyExpressionKind.RESTRICTION)
                        .withPropertyIri(URI.create("urn:property:" + index))
                        .withFiller(
                            new OntologyExpression()
                                .withKind(OntologyExpressionKind.NAMED_CLASS)
                                .withClassIri(URI.create("urn:target"))))
            .toList();
    final var axiom =
        new OntologyAxiom()
            .withId(axiomId)
            .withName("manyTargets")
            .withSubjectIri(URI.create("urn:source"))
            .withAxiomType(OntologyAxiomType.SUBCLASS_OF)
            .withExpressions(expressions);
    final var rows = List.of(new EdgeAxiomRow("manyTargets", axiomId, JsonUtils.pojoToJson(axiom)));
    final var concepts = Map.of("urn:source", concept, "urn:target", target);
    final var first =
        NativeOntologyDataGraphPager.semanticPage(
            rows, Set.of(axiomId), concepts, Cursor.first("context"), 500);
    assertEquals(500, first.links().size());
    assertEquals(500, first.targetOffset());
    final var continuation =
        new Cursor(
            1, "context", first.after(), first.targetOffset(), LineagePosition.FIRST, false, true);
    final var second =
        NativeOntologyDataGraphPager.semanticPage(
            rows, Set.of(axiomId), concepts, continuation, 499);
    assertEquals(1, second.links().size());
    assertEquals(URI.create("urn:property:500"), second.links().iterator().next().propertyIri());
    assertEquals(true, second.done());
  }

  @Test
  void aFullyDeniedCandidateBatchContinuesWithoutExposingAnyAxiomName() {
    final var axiom =
        new OntologyAxiom()
            .withSubjectIri(URI.create("urn:source"))
            .withTargetIri(URI.create("urn:target"))
            .withPropertyIri(URI.create("urn:property"))
            .withAxiomType(OntologyAxiomType.OBJECT_PROPERTY_ASSERTION);
    final var rows =
        IntStream.range(0, 500)
            .mapToObj(
                index ->
                    new EdgeAxiomRow(
                        "confidential-axiom-" + index,
                        UUID.randomUUID(),
                        JsonUtils.pojoToJson(axiom)))
            .toList();
    final var concepts = Map.of("urn:source", UUID.randomUUID(), "urn:target", UUID.randomUUID());
    final var page =
        NativeOntologyDataGraphPager.semanticPage(
            rows, Set.of(), concepts, Cursor.first("context"), 500);
    assertEquals(Set.of(), page.links());
    assertFalse(page.done());
    final var cursor =
        new Cursor(
            1,
            "context",
            page.after(),
            page.targetOffset(),
            LineagePosition.FIRST,
            page.done(),
            true);
    final var decoded = RestUtil.decodeCursor(CODEC.encode(cursor));
    assertFalse(decoded.contains("confidential-axiom-"));
    assertFalse(decoded.contains("semanticAfter\""));
    assertEquals(
        rows.getLast().id().toString(),
        CODEC.decode(CODEC.encode(cursor), "context").semanticAfter().id());
    final var visible = new EdgeAxiomRow("visible", UUID.randomUUID(), JsonUtils.pojoToJson(axiom));
    final var next =
        NativeOntologyDataGraphPager.semanticPage(
            List.of(visible),
            Set.of(visible.id()),
            concepts,
            CODEC.decode(CODEC.encode(cursor), "context"),
            499);
    assertEquals(1, next.links().size());
    assertEquals(true, next.done());
  }

  @Test
  void aCursorOffsetPastAShrunkVisibleAxiomAsksForARefreshAndAHiddenOneIsSkipped() {
    final var axiom =
        new OntologyAxiom()
            .withSubjectIri(URI.create("urn:source"))
            .withTargetIri(URI.create("urn:target"))
            .withPropertyIri(URI.create("urn:property"))
            .withAxiomType(OntologyAxiomType.OBJECT_PROPERTY_ASSERTION);
    final var row = new EdgeAxiomRow("shrunk", UUID.randomUUID(), JsonUtils.pojoToJson(axiom));
    final var stale =
        new Cursor(1, "context", row.position(), 2, LineagePosition.FIRST, false, true);
    final var concepts = Map.of("urn:source", UUID.randomUUID(), "urn:target", UUID.randomUUID());
    assertThrows(
        PreconditionFailedException.class,
        () ->
            NativeOntologyDataGraphPager.semanticPage(
                List.of(row), Set.of(row.id()), concepts, stale, 500));
    final var hidden =
        NativeOntologyDataGraphPager.semanticPage(List.of(row), Set.of(), concepts, stale, 500);
    assertEquals(Set.of(), hidden.links());
    assertEquals(row.position(), hidden.after());
  }

  @Test
  void aFullContextStopsAdvertisingClusterOffsets() {
    assertEquals(12, NativeOntologyDataGraphPager.nextClusterOffset(0, 12, 61, 12));
    assertEquals(60, NativeOntologyDataGraphPager.nextClusterOffset(48, 12, 62, 59));
    assertNull(NativeOntologyDataGraphPager.nextClusterOffset(48, 12, 61, 60));
    assertNull(NativeOntologyDataGraphPager.nextClusterOffset(0, 12, 12, 12));
  }

  @Test
  void aClusterPageNeverRequestsMoreConceptsThanTheContextCanHold() {
    assertEquals(12, NativeOntologyDataGraphPager.clusterLimit(12, 0));
    assertEquals(12, NativeOntologyDataGraphPager.clusterLimit(12, 48));
    assertEquals(5, NativeOntologyDataGraphPager.clusterLimit(12, 55));
    assertEquals(0, NativeOntologyDataGraphPager.clusterLimit(12, 60));
  }

  @Test
  void aClusterAlreadyLoadedIsNotReturnedAgain() {
    final var kept = cluster(1);
    final var repeated = cluster(2);
    assertEquals(
        List.of(kept),
        NativeOntologyDataGraphPager.unloaded(
            List.of(kept, repeated), List.of(prefix(2, 0, 1), prefix(3, 0, 1))));
  }

  @Test
  void aMissingOrHiddenLoadedConceptAsksTheClientToRefresh() {
    final UUID ontology = UUID.randomUUID();
    final var present = concept(1, ontology);
    final var ids = List.of(present.getId(), new UUID(0, 2));
    assertThrows(
        PreconditionFailedException.class,
        () ->
            NativeOntologyDataGraphPager.requireLoadedConcepts(
                ids, Map.of(present.getId(), present), ontology));
    assertThrows(
        BadRequestException.class,
        () ->
            NativeOntologyDataGraphPager.requireLoadedConcepts(
                List.of(present.getId()), Map.of(present.getId(), present), UUID.randomUUID()));
    NativeOntologyDataGraphPager.requireLoadedConcepts(
        List.of(present.getId()), Map.of(present.getId(), present), ontology);
  }

  @Test
  void aCursorAxiomThatNoLongerQualifiesAsksTheClientToRefresh() {
    assertThrows(
        PreconditionFailedException.class,
        () -> NativeOntologyDataGraphPager.requirePosition(null));
    final var row = new EdgeAxiomRow("name", UUID.randomUUID(), "{}");
    assertEquals(row.position(), NativeOntologyDataGraphPager.requirePosition(row));
  }

  private static Cluster cluster(final long concept) {
    return new Cluster(
        concept(concept, UUID.randomUUID()), new NativeOntologyAssetCluster().withAssetCount(1));
  }

  private static OntologyConcept concept(final long id, final UUID ontology) {
    return new OntologyConcept()
        .withId(new UUID(0, id))
        .withOntology(new EntityReference().withId(ontology).withType("ontology"));
  }

  private static NativeOntologyLoadedPrefix prefix(
      final long concept, final long revision, final long asset) {
    return new NativeOntologyLoadedPrefix()
        .withConceptId(new UUID(0, concept))
        .withBindingRevision(revision)
        .withThroughAssetId(new UUID(0, asset));
  }
}
