package org.openmetadata.service.search.elasticsearch;

import es.org.elasticsearch.common.lucene.search.function.CombineFunction;
import es.org.elasticsearch.common.lucene.search.function.FieldValueFactorFunction;
import es.org.elasticsearch.common.lucene.search.function.FunctionScoreQuery;
import es.org.elasticsearch.index.query.BoolQueryBuilder;
import es.org.elasticsearch.index.query.Operator;
import es.org.elasticsearch.index.query.QueryBuilders;
import es.org.elasticsearch.index.query.QueryBuilder;
import es.org.elasticsearch.index.query.RangeQueryBuilder;
import es.org.elasticsearch.index.query.functionscore.FunctionScoreQueryBuilder;
import es.org.elasticsearch.index.query.functionscore.ScoreFunctionBuilder;
import es.org.elasticsearch.index.query.functionscore.ScoreFunctionBuilders;
import es.org.elasticsearch.search.aggregations.AggregationBuilder;
import es.org.elasticsearch.search.aggregations.AggregationBuilders;
import es.org.elasticsearch.search.builder.SearchSourceBuilder;
import es.org.elasticsearch.search.fetch.subphase.highlight.HighlightBuilder;
import es.org.elasticsearch.search.sort.SortBuilders;
import es.org.elasticsearch.search.sort.SortOrder;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.openmetadata.schema.api.search.Aggregation;
import org.openmetadata.schema.api.search.FieldValueBoost;
import org.openmetadata.schema.api.search.Range;
import org.openmetadata.schema.api.search.TagBoost;
import org.openmetadata.schema.entity.data.EntityHierarchy__1;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.api.search.GlobalSettings;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.search.SearchRequest;
import org.openmetadata.service.search.SearchQueryBuilder;
import org.openmetadata.service.util.JsonUtils;

public class ElasticSearchQueryBuilder implements SearchQueryBuilder {

  @Override
  public SearchSourceBuilder getSearchSourceBuilder(String index, String q, int from, int size) throws IOException {
    // Instead of reading from a JSON file or cached file,
    // we get the SearchSettings directly from SettingsCache.
    SearchSettings searchSettings = SettingsCache.getSetting(SettingsType.SEARCH_SETTINGS, SearchSettings.class);

    String assetType = getAssetTypeFromIndex(index);
    AssetTypeConfiguration config =
        searchSettings.getAssetTypeConfigurations().stream()
            .filter(c -> c.getAssetType().equalsIgnoreCase(assetType))
            .findFirst()
            .orElse(searchSettings.getDefaultConfiguration());
    if (config == null) {
      config = searchSettings.getDefaultConfiguration();
    }

    return buildSearchSourceBuilder(q, from, size, config, searchSettings);
  }

  private SearchSourceBuilder buildSearchSourceBuilder(
      String query, int from, int size, AssetTypeConfiguration config, SearchSettings searchSettings) {

    QueryBuilder finalQuery = buildQuery(query, config, searchSettings);
    HighlightBuilder hb = buildHighlights(config.getHighlightFields(), searchSettings.getGlobalSettings());

    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder()
        .query(finalQuery)
        .from(from)
        .size(size)
        .highlighter(hb);

    // Add asset-type specific aggregations
    if (config.getAggregations() != null) {
      for (Aggregation aggConfig : config.getAggregations()) {
        AggregationBuilder aggBuilder = buildAggregation(aggConfig, searchSettings);
        if (aggBuilder != null) {
          searchSourceBuilder.aggregation(aggBuilder);
        }
      }
    }

    // Add global aggregations
    GlobalSettings globalSettings = searchSettings.getGlobalSettings();
    if (globalSettings != null && globalSettings.getAggregations() != null) {
      for (Aggregation aggConfig : globalSettings.getAggregations()) {
        AggregationBuilder aggBuilder = buildAggregation(aggConfig, searchSettings);
        if (aggBuilder != null) {
          searchSourceBuilder.aggregation(aggBuilder);
        }
      }
    }

    return searchSourceBuilder;
  }

  private QueryBuilder buildQuery(String query, AssetTypeConfiguration config, SearchSettings searchSettings) {
    BoolQueryBuilder boolQuery = QueryBuilders.boolQuery();

    // Must match
    if (config.getMustMatch() != null && !config.getMustMatch().isEmpty()) {
      Map<String, Float> mustFields = new HashMap<>();
      for (String field : config.getMustMatch()) {
        mustFields.put(field, config.getFields().getAdditionalProperties().getOrDefault(field, 1.0).floatValue());
      }
      if (!mustFields.isEmpty()) {
        QueryBuilder mustQuery = QueryBuilders.queryStringQuery(query)
            .fields(mustFields)
            .defaultOperator(Operator.AND);
        boolQuery.must(mustQuery);
      }
    }

    // Should match
    if (config.getShouldMatch() != null && !config.getShouldMatch().isEmpty()) {
      Map<String, Float> shouldFields = new HashMap<>();
      for (String field : config.getShouldMatch()) {
        shouldFields.put(field, config.getFields().getAdditionalProperties().getOrDefault(field, 1.0).floatValue());
      }
      if (!shouldFields.isEmpty()) {
        QueryBuilder shouldQuery = QueryBuilders.queryStringQuery(query)
            .fields(shouldFields)
            .defaultOperator(Operator.OR);
        boolQuery.should(shouldQuery);
      }
    }

    // Apply tier boosts, usage boosts, etc. if needed
    return applyBoosts(boolQuery, searchSettings);
  }

  private FunctionScoreQueryBuilder applyBoosts(QueryBuilder baseQuery, SearchSettings searchSettings) {
    List<FunctionScoreQueryBuilder.FilterFunctionBuilder> functions = new ArrayList<>();

    // Apply tagBoosts dynamically
    if (searchSettings.getGlobalSettings() != null && searchSettings.getGlobalSettings().getTagBoosts() != null) {
      for (TagBoost tagBoost : searchSettings.getGlobalSettings().getTagBoosts()) {
        QueryBuilder filterQuery = QueryBuilders.termQuery(tagBoost.getField(), tagBoost.getTagFQN());
        functions.add(new FunctionScoreQueryBuilder.FilterFunctionBuilder(
            filterQuery,
            ScoreFunctionBuilders.weightFactorFunction(tagBoost.getBoost().floatValue())
        ));
      }
    }

    // Apply fieldValueBoosts dynamically using buildRangeQuery
    if (searchSettings.getGlobalSettings() != null && searchSettings.getGlobalSettings().getFieldValueBoosts() != null) {
      for (FieldValueBoost fvb : searchSettings.getGlobalSettings().getFieldValueBoosts()) {
        Range range = fvb.getCondition().getRange(); // returns a Range object
        QueryBuilder filterQuery = buildRangeQuery(fvb.getField(), range);

        FieldValueFactorFunction.Modifier modifier = FieldValueFactorFunction.Modifier.valueOf(fvb.getModifier().value().toUpperCase());
        ScoreFunctionBuilder<?> scoreFunction = ScoreFunctionBuilders.fieldValueFactorFunction(fvb.getField())
            .factor(fvb.getFactor().floatValue())
            .modifier(modifier)
            .missing(fvb.getMissing().floatValue());

        functions.add(new FunctionScoreQueryBuilder.FilterFunctionBuilder(filterQuery, scoreFunction));
      }
    }

    // Combine all boosts
    if (!functions.isEmpty()) {
      return QueryBuilders.functionScoreQuery(
              baseQuery,
              functions.toArray(new FunctionScoreQueryBuilder.FilterFunctionBuilder[0]))
          .scoreMode(FunctionScoreQuery.ScoreMode.SUM)
          .boostMode(CombineFunction.MULTIPLY);
    } else {
      return QueryBuilders.functionScoreQuery(baseQuery);
    }
  }

  private QueryBuilder buildRangeQuery(String field, Range range) {
    RangeQueryBuilder rangeQuery = QueryBuilders.rangeQuery(field);

    if (range != null) {
      if (range.getGt() != null) {
        rangeQuery.gt(range.getGt());
      }
      if (range.getGte() != null) {
        rangeQuery.gte(range.getGte());
      }
      if (range.getLt() != null) {
        rangeQuery.lt(range.getLt());
      }
      if (range.getLte() != null) {
        rangeQuery.lte(range.getLte());
      }
    }

    return rangeQuery;
  }

  private HighlightBuilder buildHighlights(List<String> highlightFields, GlobalSettings globalSettings) {
    HighlightBuilder hb = new HighlightBuilder();
    if (highlightFields != null) {
      for (String field : highlightFields) {
        hb.field(new HighlightBuilder.Field(field).highlighterType("unified"));
      }
    }
    hb.preTags("<em>");
    hb.postTags("</em>");
    if (globalSettings != null) {
      hb.maxAnalyzedOffset(globalSettings.getMaxAnalyzedOffset());
    }
    return hb;
  }

  private AggregationBuilder buildAggregation(Aggregation aggConfig, SearchSettings searchSettings) {
    if ("terms".equals(aggConfig.getType())) {
      es.org.elasticsearch.search.aggregations.bucket.terms.TermsAggregationBuilder termsAgg =
          AggregationBuilders.terms(aggConfig.getName())
              .field(aggConfig.getField());

      if (searchSettings.getGlobalSettings() != null) {
        termsAgg.size(searchSettings.getGlobalSettings().getMaxAggregateSize());
      }

      return termsAgg;
    }
    return null;
  }

  @Override
  public void applyDeletedLogic(SearchRequest request, SearchSourceBuilder searchSourceBuilder) {
    String index = request.getIndex();
    QueryBuilder currentQuery = searchSourceBuilder.query();

    if (index.equalsIgnoreCase(Entity.getSearchRepository().getIndexOrAliasName("all"))
        || index.equalsIgnoreCase(Entity.getSearchRepository().getIndexOrAliasName("dataAsset"))) {
      BoolQueryBuilder boolQueryBuilder = QueryBuilders.boolQuery();
      boolQueryBuilder.should(
          QueryBuilders.boolQuery()
              .must(currentQuery)
              .must(QueryBuilders.existsQuery("deleted"))
              .must(QueryBuilders.termQuery("deleted", request.isDeleted())));
      boolQueryBuilder.should(
          QueryBuilders.boolQuery()
              .must(currentQuery)
              .mustNot(QueryBuilders.existsQuery("deleted")));
      searchSourceBuilder.query(boolQueryBuilder);
    } else {
      searchSourceBuilder.query(
          QueryBuilders.boolQuery()
              .must(currentQuery)
              .must(QueryBuilders.termQuery("deleted", request.isDeleted())));
    }
  }

  @Override
  public void applyGlossaryHierarchyLogic(SearchRequest request, SearchSourceBuilder searchSourceBuilder)  {
    if (request
        .getIndex()
        .equalsIgnoreCase(Entity.getSearchRepository().getIndexMapping(Entity.GLOSSARY_TERM).getIndexName(""))) {
      searchSourceBuilder.query(QueryBuilders.boolQuery().must(searchSourceBuilder.query()));

      if (request.isGetHierarchy()) {
        BoolQueryBuilder baseQuery =
            QueryBuilders.boolQuery()
                .should(searchSourceBuilder.query())
                .should(QueryBuilders.matchPhraseQuery("fullyQualifiedName", request.getQuery()))
                .should(QueryBuilders.matchPhraseQuery("name", request.getQuery()))
                .should(QueryBuilders.matchPhraseQuery("displayName", request.getQuery()))
                .should(QueryBuilders.matchPhraseQuery("glossary.fullyQualifiedName", request.getQuery()))
                .should(QueryBuilders.matchPhraseQuery("glossary.displayName", request.getQuery()))
                .must(QueryBuilders.matchQuery("status", "Approved"))
                .minimumShouldMatch(1);
        searchSourceBuilder.query(baseQuery);
        searchSourceBuilder.sort(SortBuilders.fieldSort("fullyQualifiedName").order(SortOrder.ASC));
      }
    }
  }

  public  List<?> buildSearchHierarchy(SearchRequest request, es.org.elasticsearch.action.search.SearchResponse searchResponse) {
    if (request
        .getIndex()
        .equalsIgnoreCase(
            Entity.getSearchRepository()
                .getIndexMapping(Entity.GLOSSARY_TERM)
                .getIndexName(""))) {
      return buildGlossaryTermSearchHierarchy(searchResponse);
    }
    return new java.util.ArrayList<>();
  }

  private static List<EntityHierarchy__1> buildGlossaryTermSearchHierarchy(es.org.elasticsearch.action.search.SearchResponse searchResponse) {
    Map<String, EntityHierarchy__1> termMap = new LinkedHashMap<>();
    Map<String, EntityHierarchy__1> rootTerms = new LinkedHashMap<>();

    for (var hit : searchResponse.getHits().getHits()) {
      String jsonSource = hit.getSourceAsString();
      EntityHierarchy__1 term = JsonUtils.readValue(jsonSource, EntityHierarchy__1.class);
      EntityHierarchy__1 glossaryInfo =
          JsonUtils.readTree(jsonSource).path("glossary").isMissingNode()
              ? null
              : JsonUtils.convertValue(
              JsonUtils.readTree(jsonSource).path("glossary"), EntityHierarchy__1.class);

      if (glossaryInfo != null) {
        rootTerms.putIfAbsent(glossaryInfo.getFullyQualifiedName(), glossaryInfo);
      }

      term.setChildren(new java.util.ArrayList<>());
      termMap.putIfAbsent(term.getFullyQualifiedName(), term);
    }

    termMap.putAll(rootTerms);

    for (EntityHierarchy__1 term : termMap.values()) {
      String parentFQN = org.openmetadata.service.util.FullyQualifiedName.getParentFQN(term.getFullyQualifiedName());
      String termFQN = term.getFullyQualifiedName();

      if (parentFQN != null && termMap.containsKey(parentFQN)) {
        EntityHierarchy__1 parentTerm = termMap.get(parentFQN);
        List<EntityHierarchy__1> children = parentTerm.getChildren();
        children.removeIf(child -> child.getFullyQualifiedName().equals(term.getFullyQualifiedName()));
        children.add(term);
        parentTerm.setChildren(children);
      } else {
        if (rootTerms.containsKey(termFQN)) {
          EntityHierarchy__1 rootTerm = rootTerms.get(termFQN);
          rootTerm.setChildren(term.getChildren());
        }
      }
    }

    return new java.util.ArrayList<>(rootTerms.values());
  }
}