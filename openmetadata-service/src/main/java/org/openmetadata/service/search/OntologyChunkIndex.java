package org.openmetadata.service.search;

import java.io.IOException;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.indexes.OntologyTermIndex;
import org.openmetadata.service.search.opensearch.OpenSearchClient;
import os.org.opensearch.client.json.JsonData;
import os.org.opensearch.client.opensearch._types.FieldValue;
import os.org.opensearch.client.opensearch._types.Refresh;
import os.org.opensearch.client.opensearch._types.aggregations.CompositeAggregate;
import os.org.opensearch.client.opensearch._types.aggregations.CompositeAggregationSource;
import os.org.opensearch.client.opensearch._types.query_dsl.Query;

public final class OntologyChunkIndex {
  private static final String BASE_NAME = "ontology_embeddings_chunks";
  private static final String PARENT_ID = "parentId";

  private OntologyChunkIndex() {}

  public static String name() {
    final var search = Entity.getSearchRepository();
    return name(search == null ? null : search.getClusterAlias());
  }

  private static String name(String clusterAlias) {
    return clusterAlias == null || clusterAlias.isEmpty()
        ? BASE_NAME
        : clusterAlias.toLowerCase(Locale.ROOT) + "_" + BASE_NAME;
  }

  static void reconcile(
      SearchClient client,
      String clusterAlias,
      List<EntityReference> terms,
      Map<UUID, OntologyTermIndex> active)
      throws IOException {
    if (client instanceof OpenSearchClient openSearch) {
      final var index = name(clusterAlias);
      // Disabling embeddings can leave chunks from an earlier configuration.
      if (Entity.getSearchRepository().isVectorEmbeddingEnabled()
          || openSearch.getNewClient().indices().exists(r -> r.index(index)).value()) {
        refresh(openSearch, index);
        deleteStaleChunks(openSearch, index, terms, active);
      }
    }
  }

  static void sweep(SearchClient client, String clusterAlias, String entityType)
      throws IOException {
    if (!(client instanceof OpenSearchClient openSearch)) {
      return;
    }
    final var index = name(clusterAlias);
    refresh(openSearch, index);
    Map<String, FieldValue> after = Map.of();
    do {
      final var page = parentPage(openSearch, index, entityType, after);
      if (page == null || page.buckets().array().isEmpty()) {
        return;
      }
      final var parents =
          page.buckets().array().stream()
              .map(
                  bucket ->
                      new EntityReference()
                          .withType(entityType)
                          .withId(UUID.fromString(bucket.key().get(PARENT_ID).stringValue())))
              .toList();
      OntologyTermSearch.withLockedIndexes(
          parents,
          active -> {
            deleteStaleChunks(openSearch, index, parents, active);
            return null;
          });
      after = page.afterKey();
    } while (after != null && !after.isEmpty());
  }

  private static void refresh(OpenSearchClient client, String index) throws IOException {
    final var response =
        client.getNewClient().indices().refresh(r -> r.index(index).ignoreUnavailable(true));
    if (response.shards().failed() > 0) {
      throw new IOException("Incomplete ontology chunk refresh for " + index);
    }
  }

  private static CompositeAggregate parentPage(
      OpenSearchClient client, String index, String entityType, Map<String, FieldValue> after)
      throws IOException {
    final var source = CompositeAggregationSource.of(s -> s.terms(t -> t.field(PARENT_ID)));
    final var response =
        client
            .getNewClient()
            .search(
                r ->
                    r.index(index)
                        .ignoreUnavailable(true)
                        .size(0)
                        .query(
                            q ->
                                q.term(t -> t.field("entityType").value(FieldValue.of(entityType))))
                        .aggregations(
                            PARENT_ID,
                            a ->
                                a.composite(
                                    c -> {
                                      c.size(OntologyTermSearch.PAGE_SIZE)
                                          .sources(List.of(Map.of(PARENT_ID, source)));
                                      if (!after.isEmpty()) {
                                        c.after(after);
                                      }
                                      return c;
                                    })),
                JsonData.class);
    if (response.timedOut() || response.shards().failed() > 0) {
      throw new IOException("Incomplete ontology chunk listing for " + index);
    }
    final var aggregate = response.aggregations().get(PARENT_ID);
    return aggregate == null ? null : aggregate.composite();
  }

  private static void deleteStaleChunks(
      OpenSearchClient client,
      String index,
      List<EntityReference> references,
      Map<UUID, OntologyTermIndex> active)
      throws IOException {
    final var ids = references.stream().map(ref -> FieldValue.of(ref.getId().toString())).toList();
    final var parents = Query.of(q -> q.terms(t -> t.field(PARENT_ID).terms(v -> v.value(ids))));
    final var current =
        active.entrySet().stream()
            .map(
                entry ->
                    currentChunks(
                        entry.getKey(), OntologyTermSearch.embeddingFingerprint(entry.getValue())))
            .toList();
    final var query = Query.of(q -> q.bool(b -> b.filter(parents).mustNot(current)));
    final var response =
        client
            .getNewClient()
            .deleteByQuery(
                d -> d.index(index).ignoreUnavailable(true).query(query).refresh(Refresh.True));
    if (Boolean.TRUE.equals(response.timedOut())
        || !response.failures().isEmpty()
        || Objects.requireNonNullElse(response.versionConflicts(), 0L) > 0) {
      throw new IOException("Incomplete ontology chunk deletion for " + index);
    }
  }

  private static Query currentChunks(UUID parentId, String fingerprint) {
    final var parent =
        Query.of(q -> q.term(t -> t.field(PARENT_ID).value(FieldValue.of(parentId.toString()))));
    final var content =
        Query.of(q -> q.term(t -> t.field("fingerprint").value(FieldValue.of(fingerprint))));
    return Query.of(q -> q.bool(b -> b.filter(parent, content)));
  }
}
