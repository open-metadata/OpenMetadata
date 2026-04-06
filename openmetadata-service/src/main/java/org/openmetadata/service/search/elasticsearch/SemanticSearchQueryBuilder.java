package org.openmetadata.service.search.elasticsearch;

import es.co.elastic.clients.elasticsearch._types.Script;
import es.co.elastic.clients.elasticsearch._types.ScriptLanguage;
import es.co.elastic.clients.elasticsearch._types.query_dsl.FunctionBoostMode;
import es.co.elastic.clients.elasticsearch._types.query_dsl.FunctionScoreMode;
import es.co.elastic.clients.elasticsearch._types.query_dsl.Query;
import es.co.elastic.clients.elasticsearch._types.query_dsl.TextQueryType;
import es.co.elastic.clients.json.JsonData;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.rdf.semantic.EmbeddingService;

/**
 * Builds semantic search queries for Elasticsearch that combine:
 * 1. Vector similarity search using k-NN (dense_vector)
 * 2. Traditional text search with BM25
 * 3. RDF context boosting
 */
@Slf4j
public class SemanticSearchQueryBuilder {

  private static final String KNN_FIELD = "embedding";
  private static final String RDF_CONTEXT_FIELD = "rdfContext";

  private final EmbeddingService embeddingService;

  public SemanticSearchQueryBuilder() {
    this.embeddingService = EmbeddingService.getInstance();
  }

  public Query buildSemanticQuery(SearchRequest request) {
    String queryText = request.getQuery();
    if (!isSemanticSearchEnabled(request)) {
      return null;
    }
    float[] queryEmbedding = embeddingService.generateEmbedding(queryText);

    Query knnQuery = buildKnnQuery(queryEmbedding);
    Query textQuery = buildTextQuery(queryText, request);

    Query hybridQuery =
        Query.of(
            q ->
                q.bool(
                    b ->
                        b.should(s -> s.constantScore(cs -> cs.filter(knnQuery).boost(0.7f)))
                            .should(s -> s.constantScore(cs -> cs.filter(textQuery).boost(0.3f)))));

    return Query.of(
        q ->
            q.functionScore(
                fs ->
                    fs.query(hybridQuery)
                        .functions(f -> f.scriptScore(ss -> ss.script(buildRdfBoostScript())))
                        .scoreMode(FunctionScoreMode.Sum)
                        .boostMode(FunctionBoostMode.Multiply)));
  }

  private Query buildKnnQuery(float[] queryEmbedding) {
    Map<String, Object> params = new HashMap<>();
    List<Double> vectorList = new ArrayList<>();
    for (float v : queryEmbedding) {
      vectorList.add((double) v);
    }
    params.put("query_vector", vectorList);

    return Query.of(
        q ->
            q.scriptScore(
                ss ->
                    ss.query(mq -> mq.matchAll(m -> m))
                        .script(
                            Script.of(
                                s ->
                                    s.source(
                                            src ->
                                                src.scriptString(
                                                    "cosineSimilarity(params.query_vector, '"
                                                        + KNN_FIELD
                                                        + "') + 1.0"))
                                        .lang(ScriptLanguage.Painless)
                                        .params(convertToJsonDataMap(params))))));
  }

  private Query buildTextQuery(String queryText, SearchRequest request) {
    List<String> fields = new ArrayList<>();
    fields.add("name^5");
    fields.add("displayName^4");
    fields.add("description^2");
    fields.add("tags.tagFQN^3");

    if ("table".equalsIgnoreCase(request.getIndex())) {
      fields.add("columns.name^3");
      fields.add("columns.description");
    }

    return Query.of(
        q ->
            q.multiMatch(
                m ->
                    m.query(queryText)
                        .fields(fields)
                        .type(TextQueryType.BestFields)
                        .fuzziness("AUTO")));
  }

  private Script buildRdfBoostScript() {
    String scriptSource =
        """
        double boost = 1.0;

        if (doc.containsKey('rdfContext.upstreamCount')) {
          int upstreamCount = doc['rdfContext.upstreamCount'].value;
          boost += Math.min(upstreamCount * 0.01, 0.2);
        }

        if (doc.containsKey('rdfContext.downstreamCount')) {
          int downstreamCount = doc['rdfContext.downstreamCount'].value;
          boost += Math.min(downstreamCount * 0.02, 0.3);
        }

        if (doc.containsKey('rdfContext.semanticTypes')) {
          int typeCount = doc['rdfContext.semanticTypes'].size();
          boost += Math.min(typeCount * 0.05, 0.2);
        }

        return boost;
        """;

    return Script.of(
        s ->
            s.source(src -> src.scriptString(scriptSource))
                .lang(ScriptLanguage.Painless)
                .params(Map.of()));
  }

  private boolean isSemanticSearchEnabled(SearchRequest request) {
    return request.getSemanticSearch() != null && request.getSemanticSearch();
  }

  private Map<String, JsonData> convertToJsonDataMap(Map<String, Object> map) {
    return JsonUtils.getMap(map).entrySet().stream()
        .filter(entry -> entry.getValue() != null)
        .collect(Collectors.toMap(Map.Entry::getKey, entry -> JsonData.of(entry.getValue())));
  }
}
