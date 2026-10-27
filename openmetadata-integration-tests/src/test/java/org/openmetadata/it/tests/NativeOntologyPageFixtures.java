package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.tests.OntologyBindingFixtures.client;
import static org.openmetadata.it.tests.OntologyBindingFixtures.tables;

import com.macasaet.fernet.Key;
import com.macasaet.fernet.Token;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.openmetadata.it.util.RdfAccessFixtures;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.NativeOntologyDataGraphPage;
import org.openmetadata.schema.api.data.NativeOntologyDataGraphPageRequest;
import org.openmetadata.schema.api.data.NativeOntologyGraphPageSelection;
import org.openmetadata.schema.api.data.NativeOntologyLoadedPrefix;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Edge;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.util.RestUtil;

/** Requests for {@code POST /v1/ontologies/{id}/dataGraph/pages} and the values they carry. */
final class NativeOntologyPageFixtures {
  private static final int MAX_CLUSTER_PAGES = 6;
  private static final SecureRandom RANDOM = new SecureRandom();

  private NativeOntologyPageFixtures() {}

  static NativeOntologyDataGraphPage graphPage(
      final OpenMetadataClient client,
      final Ontology ontology,
      final List<NativeOntologyLoadedPrefix> loaded,
      final NativeOntologyGraphPageSelection selection) {
    return client
        .getHttpClient()
        .execute(
            HttpMethod.POST,
            "/v1/ontologies/" + ontology.getId() + "/dataGraph/pages",
            new NativeOntologyDataGraphPageRequest().withLoaded(loaded).withPage(selection),
            NativeOntologyDataGraphPage.class);
  }

  static NativeOntologyGraphPageSelection clusterPage(final int offset, final int limit) {
    return new NativeOntologyGraphPageSelection()
        .withKind(NativeOntologyGraphPageSelection.Kind.CLUSTERS)
        .withOffset(offset)
        .withLimit(limit);
  }

  static NativeOntologyGraphPageSelection bindingsPage(
      final NativeOntologyLoadedPrefix prefix, final int limit, final String after) {
    return new NativeOntologyGraphPageSelection()
        .withKind(NativeOntologyGraphPageSelection.Kind.BINDINGS)
        .withConceptId(prefix.getConceptId())
        .withLimit(limit)
        .withAfter(after);
  }

  static NativeOntologyGraphPageSelection topologyPage(final String after) {
    return new NativeOntologyGraphPageSelection()
        .withKind(NativeOntologyGraphPageSelection.Kind.TOPOLOGY)
        .withAfter(after);
  }

  /** Follows nextClusterOffset until the server stops advertising one. */
  static List<NativeOntologyLoadedPrefix> loadAllClusters(
      final OpenMetadataClient client, final Ontology ontology) {
    List<NativeOntologyLoadedPrefix> loaded = List.of();
    Integer offset = 0;
    int pages = 0;
    do {
      assertTrue(++pages <= MAX_CLUSTER_PAGES);
      final var response = graphPage(client, ontology, loaded, clusterPage(offset, 12));
      loaded = response.getLoaded();
      offset = response.getNextClusterOffset();
    } while (offset != null);
    return loaded;
  }

  /** The status and message of the refusal a topology page with {@code after} receives. */
  static String refusal(
      final OpenMetadataClient client,
      final Ontology ontology,
      final List<NativeOntologyLoadedPrefix> loaded,
      final String after) {
    final var refused =
        assertThrows(
            OpenMetadataException.class,
            () -> graphPage(client, ontology, loaded, topologyPage(after)));
    return refused.getStatusCode() + " " + refused.getMessage();
  }

  /** A cursor in the unsigned Base64 JSON format, naming {@code axiom} for the given context. */
  static String unsignedCursor(final String contextDigest, final UUID axiom) {
    return RestUtil.encodeCursor(cursorJson(contextDigest, axiom));
  }

  static String cursorSealedWithAnotherKey(final String contextDigest, final UUID axiom) {
    return Token.generate(Key.generateKey(), cursorJson(contextDigest, axiom)).serialise();
  }

  static String randomCursor() {
    final byte[] bytes = new byte[96];
    RANDOM.nextBytes(bytes);
    return Base64.getUrlEncoder().encodeToString(bytes);
  }

  static String tampered(final String cursor) {
    final byte[] bytes = Base64.getUrlDecoder().decode(cursor);
    bytes[bytes.length / 2] ^= 1;
    return Base64.getUrlEncoder().encodeToString(bytes);
  }

  static OpenMetadataClient deniedReader(
      final RdfAccessFixtures fixtures, final String name, final String entityType) {
    final var denied = fixtures.denyRole(MetadataOperation.VIEW_ALL, entityType);
    return client(fixtures.userToken(name, List.of(denied.getId())));
  }

  static List<String> conceptEdges(final NativeOntologyDataGraphPage page) {
    return page.getTopology().getEdges().stream()
        .map(edge -> edge.getFromConceptId() + ">" + edge.getToConceptId())
        .toList();
  }

  static List<UUID> conceptIds(final List<NativeOntologyLoadedPrefix> loaded) {
    return loaded.stream().map(NativeOntologyLoadedPrefix::getConceptId).toList();
  }

  static NativeOntologyLoadedPrefix prefix(
      final OntologyConcept concept, final long revision, final UUID throughAssetId) {
    return new NativeOntologyLoadedPrefix()
        .withConceptId(concept.getId())
        .withBindingRevision(revision)
        .withThroughAssetId(throughAssetId);
  }

  static Edge edge(final Table from, final Table to) {
    return new Edge().withFromEntity(from.getId()).withToEntity(to.getId());
  }

  static List<Table> sortedTables(final TestNamespace ns, final String schema, final int count) {
    return tables(ns, schema, count).stream()
        .sorted(Comparator.comparing(table -> table.getId().toString()))
        .toList();
  }

  private static String cursorJson(final String contextDigest, final UUID axiom) {
    return """
        {"version":1,"contextDigest":"%s","semanticAfterId":"%s","targetOffset":0,\
        "lineageAfter":{"fromId":"","toId":"","relationType":""},\
        "semanticDone":false,"lineageDone":true}"""
        .formatted(contextDigest, axiom);
  }
}
