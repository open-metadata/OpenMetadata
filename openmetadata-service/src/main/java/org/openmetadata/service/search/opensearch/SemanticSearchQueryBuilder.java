package org.openmetadata.service.search.opensearch;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.service.rdf.semantic.EmbeddingService;
import os.org.opensearch.common.lucene.search.function.FunctionScoreQuery;
import os.org.opensearch.index.query.BoolQueryBuilder;
import os.org.opensearch.index.query.QueryBuilder;
import os.org.opensearch.index.query.QueryBuilders;
import os.org.opensearch.index.query.functionscore.FunctionScoreQueryBuilder;
import os.org.opensearch.index.query.functionscore.ScoreFunctionBuilders;
import os.org.opensearch.script.Script;
import os.org.opensearch.script.ScriptType;

/**
 * Builds semantic search queries for OpenSearch that combine:
 * 1. Vector similarity search using k-NN
 * 2. Traditional text search with BM25
 * 3. RDF context boosting
 */
@Slf4j
public class SemanticSearchQueryBuilder {

  private static final String KNN_FIELD = "embedding";
  private static final String RDF_CONTEXT_FIELD = "rdfContext";
  private static final int KNN_NUM_CANDIDATES = 100;

  private final EmbeddingService embeddingService;

  public SemanticSearchQueryBuilder() {
    this.embeddingService = EmbeddingService.getInstance();
  }

  public QueryBuilder buildSemanticQuery(SearchRequest request) {
    String queryText = request.getQuery();
    if (!isSemanticSearchEnabled(request)) {
      return null;
    }
    float[] queryEmbedding = embeddingService.generateEmbedding(queryText);
    BoolQueryBuilder hybridQuery = QueryBuilders.boolQuery();

    QueryBuilder knnQuery = buildKnnQuery(queryEmbedding);
    hybridQuery.should(knnQuery).boost(0.7f);

    QueryBuilder textQuery = buildTextQuery(queryText, request);
    hybridQuery.should(textQuery).boost(0.3f);

    FunctionScoreQueryBuilder.FilterFunctionBuilder[] functions =
        new FunctionScoreQueryBuilder.FilterFunctionBuilder[] {
          new FunctionScoreQueryBuilder.FilterFunctionBuilder(
              ScoreFunctionBuilders.scriptFunction(buildRdfBoostScript()))
        };

    return QueryBuilders.functionScoreQuery(hybridQuery, functions)
        .scoreMode(FunctionScoreQuery.ScoreMode.SUM)
        .boostMode(os.org.opensearch.common.lucene.search.function.CombineFunction.MULTIPLY);
  }

  private QueryBuilder buildKnnQuery(float[] queryEmbedding) {
    // OpenSearch k-NN plugin uses a different query structure
    // For now, we'll use a script score query as a fallback
    return QueryBuilders.scriptScoreQuery(
        QueryBuilders.matchAllQuery(),
        new Script(
            ScriptType.INLINE,
            "painless",
            "cosineSimilarity(params.query_vector, '" + KNN_FIELD + "') + 1.0",
            Map.of("query_vector", queryEmbedding)));
  }

  private QueryBuilder buildTextQuery(String queryText, SearchRequest request) {
    List<String> fields = new ArrayList<>();
    fields.add("name^5");
    fields.add("displayName^4");
    fields.add("description^2");
    fields.add("tags.tagFQN^3");

    // Add entity-specific fields
    if ("table".equalsIgnoreCase(request.getIndex())) {
      fields.add("columns.name^3");
      fields.add("columns.description");
    }

    return QueryBuilders.multiMatchQuery(queryText, fields.toArray(new String[0]))
        .type(os.org.opensearch.index.query.MultiMatchQueryBuilder.Type.BEST_FIELDS)
        .fuzziness("AUTO");
  }

  private Script buildRdfBoostScript() {
    String scriptSource =
        """
        double boost = 1.0;

        // Boost based on RDF context
        if (doc.containsKey('rdfContext.upstreamCount')) {
          int upstreamCount = doc['rdfContext.upstreamCount'].value;
          boost += Math.min(upstreamCount * 0.01, 0.2); // Max 20% boost
        }

        if (doc.containsKey('rdfContext.downstreamCount')) {
          int downstreamCount = doc['rdfContext.downstreamCount'].value;
          boost += Math.min(downstreamCount * 0.02, 0.3); // Max 30% boost for high impact
        }

        if (doc.containsKey('rdfContext.semanticTypes')) {
          int typeCount = doc['rdfContext.semanticTypes'].size();
          boost += Math.min(typeCount * 0.05, 0.2); // Max 20% boost for rich semantics
        }

        return boost;
        """;

    return new Script(ScriptType.INLINE, "painless", scriptSource, Map.of());
  }

  private boolean isSemanticSearchEnabled(SearchRequest request) {
    return request.getSemanticSearch() != null && request.getSemanticSearch();
  }
}
