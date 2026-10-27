package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.openmetadata.schema.api.data.NativeOntologyDataGraphPage;
import org.openmetadata.schema.api.data.NativeOntologyDataGraphPageRequest;
import org.openmetadata.schema.api.data.NativeOntologyGraphPageSelection;
import org.openmetadata.schema.api.data.NativeOntologyLoadedPrefix;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;

/** Requests for {@code POST /v1/ontologies/{id}/dataGraph/pages}. */
final class NativeOntologyPageFixtures {
  private static final int MAX_CLUSTER_PAGES = 6;

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
}
