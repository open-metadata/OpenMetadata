package org.openmetadata.service.search;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.google.common.collect.Lists;
import es.co.elastic.clients.elasticsearch._types.ScriptLanguage;
import es.co.elastic.clients.elasticsearch.core.bulk.BulkOperation;
import es.co.elastic.clients.json.JsonData;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.search.elasticsearch.ElasticSearchClient;
import org.openmetadata.service.search.indexes.OntologyTermIndex;
import org.openmetadata.service.search.vector.StoredEmbeddingReuse;
import org.openmetadata.service.search.vector.VectorDocBuilder;
import org.openmetadata.service.search.vector.VectorIndexService;
import org.openmetadata.service.search.vector.client.EmbeddingModel;
import os.org.opensearch.client.opensearch._types.BuiltinScriptLanguage;
import os.org.opensearch.client.opensearch._types.Script;

final class OntologyTermBulkWrite {
  private static final String REPLACE =
      """
      def previous = ctx._source;
      ctx._source = new HashMap(params.document);
      if (params.expectedFingerprint.equals(previous.fingerprint)) {
        for (field in params.embeddingFields) {
          if (previous.containsKey(field)) {
            ctx._source.put(field, previous[field]);
          }
        }
      }
      """;
  // The script keeps a term's own vector across a rewrite of the same text. Whether that vector's
  // model is current is decided by the embedding refresh that follows every write.
  private static final List<String> EMBEDDING_FIELDS = VectorDocBuilder.EMBEDDING_SOURCE_FIELDS;

  private OntologyTermBulkWrite() {}

  static List<EntityReference> refresh(
      SearchClient client,
      String clusterAlias,
      List<EntityReference> references,
      Function<EntityReference, List<String>> targets,
      VectorIndexService vectorService,
      String embeddingSource)
      throws IOException {
    final List<EntityReference> indexed = new ArrayList<>();
    for (var batch : Lists.partition(references, OntologyTermSearch.PAGE_SIZE)) {
      OntologyTermSearch.withLockedIndexes(
          batch,
          active -> {
            final var embeddings = cachedEmbeddings(vectorService, embeddingSource, active);
            write(client, batch, active, targets, embeddings);
            OntologyChunkIndex.reconcile(client, clusterAlias, batch, active);
            batch.stream().filter(ref -> active.containsKey(ref.getId())).forEach(indexed::add);
            return null;
          });
    }
    return indexed;
  }

  private static Map<String, JsonNode> cachedEmbeddings(
      VectorIndexService vectorService, String source, Map<UUID, OntologyTermIndex> active) {
    if (vectorService == null || source == null || active.isEmpty()) {
      return Map.of();
    }
    final Map<String, Supplier<String>> fingerprints = new HashMap<>();
    active.forEach(
        (id, index) ->
            fingerprints.put(id.toString(), () -> OntologyTermSearch.embeddingFingerprint(index)));
    final var client = vectorService.getEmbeddingClient();
    final Map<String, JsonNode> cached =
        client == null ? Map.of() : vectorService.getExistingEmbeddingsBatch(source, fingerprints);
    return cached.entrySet().stream()
        .filter(
            entry -> StoredEmbeddingReuse.isSpliceable(entry.getValue(), EmbeddingModel.of(client)))
        .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
  }

  private static void write(
      SearchClient client,
      List<EntityReference> references,
      Map<UUID, OntologyTermIndex> active,
      Function<EntityReference, List<String>> targets,
      Map<String, JsonNode> embeddings)
      throws IOException {
    final var writes = new ArrayList<Write>();
    for (var reference : references) {
      final var index = active.get(reference.getId());
      final String id = reference.getId().toString();
      final var params =
          index == null ? Map.<String, Object>of() : replacementParams(index, embeddings.get(id));
      for (var target : targets.apply(reference)) {
        writes.add(new Write(target, id, params));
      }
    }
    if (client instanceof ElasticSearchClient) {
      writeElastic(client, writes);
    } else {
      writeOpenSearch(client, writes);
    }
  }

  private static Map<String, Object> replacementParams(
      OntologyTermIndex index, JsonNode embedding) {
    final var document = new HashMap<>(index.buildSearchIndexDoc());
    if (embedding != null) {
      document.putAll(
          JsonUtils.convertValue(embedding, new TypeReference<Map<String, Object>>() {}));
    }
    return Map.of(
        "document", document,
        "embeddingFields", EMBEDDING_FIELDS,
        "expectedFingerprint", OntologyTermSearch.embeddingFingerprint(index));
  }

  private static void writeElastic(SearchClient client, List<Write> writes) throws IOException {
    final var response = client.bulkElasticSearch(writes.stream().map(Write::elastic).toList());
    for (var item : response.items()) {
      if (item.error() != null) {
        throw new IOException("Ontology term bulk write failed: " + item.error().reason());
      }
    }
  }

  private static void writeOpenSearch(SearchClient client, List<Write> writes) throws IOException {
    final var response = client.bulkOpenSearch(writes.stream().map(Write::openSearch).toList());
    for (var item : response.items()) {
      if (item.error() != null) {
        throw new IOException("Ontology term bulk write failed: " + item.error().reason());
      }
    }
  }

  private record Write(String index, String id, Map<String, Object> params) {
    BulkOperation elastic() {
      if (params.isEmpty()) {
        return BulkOperation.of(op -> op.delete(delete -> delete.index(index).id(id)));
      }
      final var values = scriptParams(JsonData::of);
      return BulkOperation.of(
          op ->
              op.update(
                  update ->
                      update
                          .index(index)
                          .id(id)
                          .retryOnConflict(3)
                          .action(
                              action ->
                                  action
                                      .scriptedUpsert(true)
                                      .upsert(Map.of())
                                      .script(
                                          script ->
                                              script
                                                  .source(source -> source.scriptString(REPLACE))
                                                  .lang(ScriptLanguage.Painless)
                                                  .params(values)))));
    }

    os.org.opensearch.client.opensearch.core.bulk.BulkOperation openSearch() {
      if (params.isEmpty()) {
        return os.org.opensearch.client.opensearch.core.bulk.BulkOperation.of(
            op -> op.delete(delete -> delete.index(index).id(id)));
      }
      final var values = scriptParams(os.org.opensearch.client.json.JsonData::of);
      final var script =
          Script.of(
              builder ->
                  builder.inline(
                      inline ->
                          inline
                              .source(REPLACE)
                              .lang(lang -> lang.builtin(BuiltinScriptLanguage.Painless))
                              .params(values)));
      return os.org.opensearch.client.opensearch.core.bulk.BulkOperation.of(
          op ->
              op.update(
                  update ->
                      update
                          .index(index)
                          .id(id)
                          .retryOnConflict(3)
                          .scriptedUpsert(true)
                          .upsert(Map.of())
                          .script(script)));
    }

    private <T> Map<String, T> scriptParams(Function<Object, T> encode) {
      return params.entrySet().stream()
          .collect(Collectors.toMap(Map.Entry::getKey, entry -> encode.apply(entry.getValue())));
    }
  }
}
