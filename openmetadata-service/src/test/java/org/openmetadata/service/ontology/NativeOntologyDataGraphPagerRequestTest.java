package org.openmetadata.service.ontology;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.macasaet.fernet.Key;
import java.net.URI;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.NativeOntologyAssetCluster;
import org.openmetadata.schema.api.data.NativeOntologyDataGraphPage;
import org.openmetadata.schema.api.data.NativeOntologyDataGraphPageRequest;
import org.openmetadata.schema.api.data.NativeOntologyGraphPageSelection;
import org.openmetadata.schema.api.data.NativeOntologyGraphPageSelection.Kind;
import org.openmetadata.schema.api.data.NativeOntologyLoadedPrefix;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.type.Edge;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.OntologyConceptBindingDAO.ConceptAssetCount;
import org.openmetadata.service.jdbi3.OntologyConceptBindingDAO.LiveAsset;
import org.openmetadata.service.jdbi3.OntologyConceptBindingStore;
import org.openmetadata.service.jdbi3.OntologyDAO;
import org.openmetadata.service.jdbi3.OntologyDAO.LineagePosition;
import org.openmetadata.service.jdbi3.OntologyDAO.PrefixLineageRow;
import org.openmetadata.service.jdbi3.OntologyReferenceDAO;
import org.openmetadata.service.jdbi3.OntologyReferenceDAO.AxiomPosition;
import org.openmetadata.service.jdbi3.OntologyReferenceDAO.EdgeAxiomRow;
import org.openmetadata.service.ontology.NativeOntologyDataGraphPager.Cursor;
import org.openmetadata.service.ontology.NativeOntologyDataGraphService.Cluster;
import org.openmetadata.service.ontology.OntologyConceptBindingService.Access;

/** Whole requests through the pager, with the database and authorization reads stubbed. */
class NativeOntologyDataGraphPagerRequestTest {
  private static final NativeOntologyTopologyCursorCodec CODEC =
      new NativeOntologyTopologyCursorCodec(List.of(Key.generateKey()));
  private static final Access READER = new Access(null, null);
  private static final UUID ONTOLOGY = new UUID(0, 1000);
  private static final UUID HIDDEN_AXIOM = new UUID(0, 2000);
  private final NativeOntologyDataGraphService graph = mock(NativeOntologyDataGraphService.class);
  private final CollectionDAO dao = mock(CollectionDAO.class);
  private final OntologyReferenceDAO axioms = mock(OntologyReferenceDAO.class);
  private final OntologyDAO lineage = mock(OntologyDAO.class);
  private final OntologyConceptBindingStore store = mock(OntologyConceptBindingStore.class);

  NativeOntologyDataGraphPagerRequestTest() {
    when(dao.ontologyReferenceDAO()).thenReturn(axioms);
    when(dao.ontologyDAO()).thenReturn(lineage);
    when(store.revisions(anyCollection())).thenAnswer(call -> revisions(call.getArgument(0)));
  }

  @Test
  void aForgedCursorNamingAHiddenAxiomGetsTheSameRefusalAsRandomBytes() {
    final var loaded = List.of(prefix(1, null));
    givenVisible(1, 1);
    when(axioms.findPropertyEdgeAxiomPosition(eq(ONTOLOGY), anyList(), eq(HIDDEN_AXIOM)))
        .thenReturn(new EdgeAxiomRow("confidentialAxiom", HIDDEN_AXIOM, "{}"));
    final String random = refusal(pager(), loaded, randomToken());
    for (final String forged : forgedTokens(digest(loaded))) {
      assertEquals(random, refusal(pager(), loaded, forged));
    }
  }

  @Test
  void aRefusedCursorIsAnsweredBeforeAnyRead() {
    final var pager =
        new NativeOntologyDataGraphPager(
            unread(NativeOntologyDataGraphService.class),
            unread(CollectionDAO.class),
            unread(OntologyConceptBindingStore.class),
            unread(OntologyConceptBindingService.class),
            CODEC);
    final var loaded = List.of(prefix(1, null));
    final var foreign = CODEC.encode(semanticAt(digest(new UUID(0, 9), loaded), HIDDEN_AXIOM));
    final var tokens = Stream.concat(forgedTokens(digest(loaded)).stream(), Stream.of(foreign));
    tokens.forEach(token -> refusal(pager, loaded, token));
  }

  @Test
  void anIssuedCursorWhoseAxiomNoLongerQualifiesAsksForARefresh() {
    final var loaded = List.of(prefix(1, null));
    givenVisible(1, 1);
    final var issued = CODEC.encode(semanticAt(digest(loaded), new UUID(0, 2001)));
    assertThrows(
        PreconditionFailedException.class,
        () -> pager().page(READER, ONTOLOGY, request(loaded, topology(issued))));
  }

  @Test
  void anIssuedCursorWhoseLastScannedLineagePairIsHiddenShowsNeitherAsset() {
    final var loaded = List.of(prefix(1, new UUID(0, 999)));
    givenVisible(1, 1);
    final UUID from = new UUID(0, 11);
    final UUID to = new UUID(0, 12);
    givenLineageEndingWithHiddenPair(from, to, new UUID(0, 21), new UUID(0, 22));
    final var page =
        pager()
            .page(READER, ONTOLOGY, request(loaded, topology(CODEC.encode(lineageOnly(loaded)))));
    assertEquals(
        List.of(new Edge().withFromEntity(from).withToEntity(to)),
        page.getTopology().getLineageEdges());
    final String decoded = base64Decoded(page.getTopology().getAfter());
    assertFalse(decoded.contains(new UUID(0, 21).toString()));
    assertFalse(decoded.contains(new UUID(0, 22).toString()));
    assertThrows(JsonParsingException.class, () -> JsonUtils.readTree(decoded));
  }

  @Test
  void aClampedClusterPageAdvertisesTheOffsetAfterItsClampedRanks() {
    final var loaded = IntStream.rangeClosed(1, 55).mapToObj(id -> prefix(id, null)).toList();
    givenVisible(1, 60);
    final var ranked =
        IntStream.rangeClosed(56, 60).mapToObj(id -> new ConceptAssetCount(id(id), 1)).toList();
    when(store.boundConcepts(ONTOLOGY, 5, 48)).thenReturn(ranked);
    when(store.countBoundConcepts(ONTOLOGY)).thenReturn(100);
    when(graph.clusters(any(), eq(ranked), eq(4)))
        .thenReturn(IntStream.rangeClosed(56, 59).mapToObj(id -> cluster(concept(id))).toList());
    final NativeOntologyDataGraphPage page =
        pager().page(READER, ONTOLOGY, request(loaded, clusters(48, 12)));
    assertEquals(59, page.getLoaded().size());
    assertEquals(53, page.getNextClusterOffset());
  }

  private NativeOntologyDataGraphPager pager() {
    return new NativeOntologyDataGraphPager(
        graph, dao, store, mock(OntologyConceptBindingService.class), CODEC);
  }

  private void givenVisible(final int first, final int last) {
    final Map<UUID, OntologyConcept> concepts =
        IntStream.rangeClosed(first, last)
            .mapToObj(NativeOntologyDataGraphPagerRequestTest::concept)
            .collect(Collectors.toMap(OntologyConcept::getId, Function.identity()));
    when(graph.visibleConcepts(any(), anyList()))
        .thenAnswer(call -> present(concepts, call.getArgument(1)));
  }

  private void givenLineageEndingWithHiddenPair(
      final UUID from, final UUID to, final UUID hiddenFrom, final UUID hiddenTo) {
    final var rows =
        Stream.concat(
                IntStream.range(0, 499).mapToObj(index -> lineageRow(from, to, "seen" + index)),
                Stream.of(lineageRow(hiddenFrom, hiddenTo, "hiddenRelation")))
            .toList();
    when(lineage.listLineageForPrefixes(anyString(), anyString(), anyMap(), any()))
        .thenReturn(rows);
    when(graph.visibleAssets(any(), anyList()))
        .thenReturn(Map.of(from, new LiveAsset(from, "Mysql"), to, new LiveAsset(to, "Mysql")));
  }

  private static List<String> forgedTokens(final String digest) {
    final var otherKey = new NativeOntologyTopologyCursorCodec(List.of(Key.generateKey()));
    return List.of(
        NativeOntologyTopologyCursorCodecTest.unsigned(semanticAt(digest, HIDDEN_AXIOM)),
        NativeOntologyTopologyCursorCodecTest.unsigned(semanticAt(digest, new UUID(0, 2001))),
        otherKey.encode(semanticAt(digest, HIDDEN_AXIOM)),
        tampered(CODEC.encode(semanticAt(digest, HIDDEN_AXIOM))));
  }

  private static String refusal(
      final NativeOntologyDataGraphPager pager,
      final List<NativeOntologyLoadedPrefix> loaded,
      final String token) {
    return assertThrows(
            BadRequestException.class,
            () -> pager.page(READER, ONTOLOGY, request(loaded, topology(token))))
        .getMessage();
  }

  private static <T> T unread(final Class<T> type) {
    return mock(
        type,
        call -> {
          throw new AssertionError("read " + call.getMethod().getName() + " before refusing");
        });
  }

  private static Map<UUID, OntologyConcept> present(
      final Map<UUID, OntologyConcept> concepts, final List<UUID> ids) {
    final Map<UUID, OntologyConcept> visible = new LinkedHashMap<>();
    ids.stream().filter(concepts::containsKey).forEach(id -> visible.put(id, concepts.get(id)));
    return visible;
  }

  private static Map<UUID, Long> revisions(final Collection<UUID> ids) {
    return ids.stream().distinct().collect(Collectors.toMap(Function.identity(), id -> 0L));
  }

  private static Cursor semanticAt(final String digest, final UUID axiom) {
    return new Cursor(
        1, digest, new AxiomPosition("", axiom.toString()), 0, LineagePosition.FIRST, false, true);
  }

  private static Cursor lineageOnly(final List<NativeOntologyLoadedPrefix> loaded) {
    return new Cursor(
        1, digest(loaded), AxiomPosition.FIRST, 0, LineagePosition.FIRST, true, false);
  }

  private static String digest(final List<NativeOntologyLoadedPrefix> loaded) {
    return digest(ONTOLOGY, loaded);
  }

  private static String digest(final UUID ontology, final List<NativeOntologyLoadedPrefix> loaded) {
    return NativeOntologyDataGraphPager.digest(ontology, loaded);
  }

  private static String randomToken() {
    final byte[] bytes = new byte[96];
    new SecureRandom().nextBytes(bytes);
    return Base64.getUrlEncoder().encodeToString(bytes);
  }

  private static String tampered(final String token) {
    final byte[] bytes = Base64.getUrlDecoder().decode(token);
    bytes[bytes.length / 2] ^= 1;
    return Base64.getUrlEncoder().encodeToString(bytes);
  }

  private static String base64Decoded(final String token) {
    return new String(Base64.getUrlDecoder().decode(token), UTF_8);
  }

  private static NativeOntologyDataGraphPageRequest request(
      final List<NativeOntologyLoadedPrefix> loaded, final NativeOntologyGraphPageSelection page) {
    return new NativeOntologyDataGraphPageRequest().withLoaded(loaded).withPage(page);
  }

  private static NativeOntologyGraphPageSelection topology(final String after) {
    return new NativeOntologyGraphPageSelection().withKind(Kind.TOPOLOGY).withAfter(after);
  }

  private static NativeOntologyGraphPageSelection clusters(final int offset, final int limit) {
    return new NativeOntologyGraphPageSelection()
        .withKind(Kind.CLUSTERS)
        .withOffset(offset)
        .withLimit(limit);
  }

  private static PrefixLineageRow lineageRow(final UUID from, final UUID to, final String type) {
    return new PrefixLineageRow(from.toString(), to.toString(), "table", "table", type);
  }

  private static Cluster cluster(final OntologyConcept concept) {
    return new Cluster(
        concept, new NativeOntologyAssetCluster().withAssetCount(1).withAssets(List.of()));
  }

  private static NativeOntologyLoadedPrefix prefix(final long concept, final UUID through) {
    return new NativeOntologyLoadedPrefix()
        .withConceptId(id(concept))
        .withBindingRevision(0L)
        .withThroughAssetId(through);
  }

  private static OntologyConcept concept(final long concept) {
    return new OntologyConcept()
        .withId(id(concept))
        .withIri(URI.create("urn:concept:" + concept))
        .withOntology(new EntityReference().withId(ONTOLOGY).withType("ontology"));
  }

  private static UUID id(final long concept) {
    return new UUID(0, concept);
  }
}
