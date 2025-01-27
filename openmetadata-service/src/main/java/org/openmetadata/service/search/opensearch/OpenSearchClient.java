package org.openmetadata.service.search.opensearch;

import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static javax.ws.rs.core.Response.Status.OK;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.AGGREGATED_COST_ANALYSIS_REPORT_DATA;
import static org.openmetadata.service.Entity.DATA_PRODUCT;
import static org.openmetadata.service.Entity.DOMAIN;
import static org.openmetadata.service.Entity.FIELD_DESCRIPTION;
import static org.openmetadata.service.Entity.FIELD_DISPLAY_NAME;
import static org.openmetadata.service.Entity.GLOSSARY_TERM;
import static org.openmetadata.service.Entity.QUERY;
import static org.openmetadata.service.Entity.RAW_COST_ANALYSIS_REPORT_DATA;
import static org.openmetadata.service.Entity.TABLE;
import static org.openmetadata.service.exception.CatalogGenericExceptionMapper.getResponse;
import static org.openmetadata.service.search.EntityBuilderConstant.API_RESPONSE_SCHEMA_FIELD;
import static org.openmetadata.service.search.EntityBuilderConstant.API_RESPONSE_SCHEMA_FIELD_KEYWORD;
import static org.openmetadata.service.search.EntityBuilderConstant.COLUMNS_NAME_KEYWORD;
import static org.openmetadata.service.search.EntityBuilderConstant.DATA_MODEL_COLUMNS_NAME_KEYWORD;
import static org.openmetadata.service.search.EntityBuilderConstant.DOMAIN_DISPLAY_NAME_KEYWORD;
import static org.openmetadata.service.search.EntityBuilderConstant.ES_MESSAGE_SCHEMA_FIELD_KEYWORD;
import static org.openmetadata.service.search.EntityBuilderConstant.ES_TAG_FQN_FIELD;
import static org.openmetadata.service.search.EntityBuilderConstant.FIELD_COLUMN_NAMES;
import static org.openmetadata.service.search.EntityBuilderConstant.FIELD_DISPLAY_NAME_NGRAM;
import static org.openmetadata.service.search.EntityBuilderConstant.MAX_AGGREGATE_SIZE;
import static org.openmetadata.service.search.EntityBuilderConstant.MAX_ANALYZED_OFFSET;
import static org.openmetadata.service.search.EntityBuilderConstant.MAX_RESULT_HITS;
import static org.openmetadata.service.search.EntityBuilderConstant.OWNER_DISPLAY_NAME_KEYWORD;
import static org.openmetadata.service.search.EntityBuilderConstant.POST_TAG;
import static org.openmetadata.service.search.EntityBuilderConstant.PRE_TAG;
import static org.openmetadata.service.search.EntityBuilderConstant.SCHEMA_FIELD_NAMES;
import static org.openmetadata.service.search.EntityBuilderConstant.UNIFIED;
import static org.openmetadata.service.search.UpdateSearchEventsConstant.SENDING_REQUEST_TO_ELASTIC_SEARCH;
import static org.openmetadata.service.search.opensearch.OpenSearchEntitiesProcessor.getUpdateRequest;
import static org.openmetadata.service.util.FullyQualifiedName.getParentFQN;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import javax.json.JsonObject;
import javax.net.ssl.SSLContext;
import javax.ws.rs.core.Response;
import lombok.Getter;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.WordUtils;
import org.apache.commons.lang3.StringUtils;
import org.apache.commons.lang3.tuple.Pair;
import org.apache.http.HttpHost;
import org.apache.http.auth.AuthScope;
import org.apache.http.auth.UsernamePasswordCredentials;
import org.apache.http.client.CredentialsProvider;
import org.apache.http.impl.client.BasicCredentialsProvider;
import org.jetbrains.annotations.NotNull;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.dataInsight.DataInsightChartResult;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChartResultList;
import org.openmetadata.schema.dataInsight.custom.FormulaHolder;
import org.openmetadata.schema.entity.data.EntityHierarchy;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.tests.DataQualityReport;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.sdk.exception.SearchException;
import org.openmetadata.sdk.exception.SearchIndexNotFoundException;
import org.openmetadata.service.Entity;
import org.openmetadata.service.dataInsight.DataInsightAggregatorInterface;
import org.openmetadata.service.jdbi3.DataInsightChartRepository;
import org.openmetadata.service.jdbi3.DataInsightSystemChartRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.jdbi3.TestCaseResultRepository;
import org.openmetadata.service.search.SearchAggregation;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.SearchRequest;
import org.openmetadata.service.search.SearchSortFilter;
import org.openmetadata.service.search.indexes.APIEndpointIndex;
import org.openmetadata.service.search.indexes.ContainerIndex;
import org.openmetadata.service.search.indexes.DashboardDataModelIndex;
import org.openmetadata.service.search.indexes.DashboardIndex;
import org.openmetadata.service.search.indexes.DataProductIndex;
import org.openmetadata.service.search.indexes.DomainIndex;
import org.openmetadata.service.search.indexes.GlossaryTermIndex;
import org.openmetadata.service.search.indexes.MlModelIndex;
import org.openmetadata.service.search.indexes.PipelineIndex;
import org.openmetadata.service.search.indexes.QueryIndex;
import org.openmetadata.service.search.indexes.SearchEntityIndex;
import org.openmetadata.service.search.indexes.SearchIndex;
import org.openmetadata.service.search.indexes.StoredProcedureIndex;
import org.openmetadata.service.search.indexes.TableIndex;
import org.openmetadata.service.search.indexes.TagIndex;
import org.openmetadata.service.search.indexes.TestCaseIndex;
import org.openmetadata.service.search.indexes.TestCaseResolutionStatusIndex;
import org.openmetadata.service.search.indexes.TestCaseResultIndex;
import org.openmetadata.service.search.indexes.TopicIndex;
import org.openmetadata.service.search.indexes.UserIndex;
import org.openmetadata.service.search.models.IndexMapping;
import org.openmetadata.service.search.opensearch.aggregations.OpenAggregations;
import org.openmetadata.service.search.opensearch.aggregations.OpenAggregationsBuilder;
import org.openmetadata.service.search.opensearch.dataInsightAggregator.OpenSearchAggregatedUnusedAssetsCountAggregator;
import org.openmetadata.service.search.opensearch.dataInsightAggregator.OpenSearchAggregatedUnusedAssetsSizeAggregator;
import org.openmetadata.service.search.opensearch.dataInsightAggregator.OpenSearchAggregatedUsedvsUnusedAssetsCountAggregator;
import org.openmetadata.service.search.opensearch.dataInsightAggregator.OpenSearchAggregatedUsedvsUnusedAssetsSizeAggregator;
import org.openmetadata.service.search.opensearch.dataInsightAggregator.OpenSearchDailyActiveUsersAggregator;
import org.openmetadata.service.search.opensearch.dataInsightAggregator.OpenSearchDynamicChartAggregatorFactory;
import org.openmetadata.service.search.opensearch.dataInsightAggregator.OpenSearchDynamicChartAggregatorInterface;
import org.openmetadata.service.search.opensearch.dataInsightAggregator.OpenSearchLineChartAggregator;
import org.openmetadata.service.search.opensearch.dataInsightAggregator.OpenSearchMostActiveUsersAggregator;
import org.openmetadata.service.search.opensearch.dataInsightAggregator.OpenSearchMostViewedEntitiesAggregator;
import org.openmetadata.service.search.opensearch.dataInsightAggregator.OpenSearchPageViewsByEntitiesAggregator;
import org.openmetadata.service.search.opensearch.dataInsightAggregator.OpenSearchUnusedAssetsAggregator;
import org.openmetadata.service.search.opensearch.queries.OpenSearchQueryBuilder;
import org.openmetadata.service.search.opensearch.queries.OpenSearchQueryBuilderFactory;
import org.openmetadata.service.search.queries.OMQueryBuilder;
import org.openmetadata.service.search.queries.QueryBuilderFactory;
import org.openmetadata.service.search.security.RBACConditionEvaluator;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.workflows.searchIndex.ReindexingUtil;
import os.org.opensearch.OpenSearchException;
import os.org.opensearch.OpenSearchStatusException;
import os.org.opensearch.action.ActionListener;
import os.org.opensearch.action.admin.indices.alias.IndicesAliasesRequest;
import os.org.opensearch.action.admin.indices.delete.DeleteIndexRequest;
import os.org.opensearch.action.bulk.BulkRequest;
import os.org.opensearch.action.bulk.BulkResponse;
import os.org.opensearch.action.delete.DeleteRequest;
import os.org.opensearch.action.get.GetRequest;
import os.org.opensearch.action.get.GetResponse;
import os.org.opensearch.action.search.SearchResponse;
import os.org.opensearch.action.support.WriteRequest;
import os.org.opensearch.action.support.master.AcknowledgedResponse;
import os.org.opensearch.action.update.UpdateRequest;
import os.org.opensearch.client.RequestOptions;
import os.org.opensearch.client.RestClient;
import os.org.opensearch.client.RestClientBuilder;
import os.org.opensearch.client.RestHighLevelClient;
import os.org.opensearch.client.indices.CreateIndexRequest;
import os.org.opensearch.client.indices.CreateIndexResponse;
import os.org.opensearch.client.indices.GetIndexRequest;
import os.org.opensearch.client.indices.GetMappingsRequest;
import os.org.opensearch.client.indices.GetMappingsResponse;
import os.org.opensearch.client.indices.PutMappingRequest;
import os.org.opensearch.cluster.metadata.MappingMetadata;
import os.org.opensearch.common.lucene.search.function.CombineFunction;
import os.org.opensearch.common.lucene.search.function.FieldValueFactorFunction;
import os.org.opensearch.common.lucene.search.function.FunctionScoreQuery;
import os.org.opensearch.common.settings.Settings;
import os.org.opensearch.common.unit.Fuzziness;
import os.org.opensearch.common.unit.TimeValue;
import os.org.opensearch.common.xcontent.LoggingDeprecationHandler;
import os.org.opensearch.common.xcontent.NamedXContentRegistry;
import os.org.opensearch.common.xcontent.XContentParser;
import os.org.opensearch.common.xcontent.XContentType;
import os.org.opensearch.index.IndexNotFoundException;
import os.org.opensearch.index.query.BoolQueryBuilder;
import os.org.opensearch.index.query.MatchQueryBuilder;
import os.org.opensearch.index.query.MultiMatchQueryBuilder;
import os.org.opensearch.index.query.Operator;
import os.org.opensearch.index.query.PrefixQueryBuilder;
import os.org.opensearch.index.query.QueryBuilder;
import os.org.opensearch.index.query.QueryBuilders;
import os.org.opensearch.index.query.QueryStringQueryBuilder;
import os.org.opensearch.index.query.RangeQueryBuilder;
import os.org.opensearch.index.query.ScriptQueryBuilder;
import os.org.opensearch.index.query.TermQueryBuilder;
import os.org.opensearch.index.query.functionscore.FunctionScoreQueryBuilder;
import os.org.opensearch.index.query.functionscore.ScoreFunctionBuilders;
import os.org.opensearch.index.reindex.DeleteByQueryRequest;
import os.org.opensearch.index.reindex.UpdateByQueryRequest;
import os.org.opensearch.rest.RestStatus;
import os.org.opensearch.script.Script;
import os.org.opensearch.script.ScriptType;
import os.org.opensearch.search.SearchHit;
import os.org.opensearch.search.SearchHits;
import os.org.opensearch.search.SearchModule;
import os.org.opensearch.search.aggregations.AggregationBuilder;
import os.org.opensearch.search.aggregations.AggregationBuilders;
import os.org.opensearch.search.aggregations.BucketOrder;
import os.org.opensearch.search.aggregations.bucket.histogram.DateHistogramAggregationBuilder;
import os.org.opensearch.search.aggregations.bucket.histogram.DateHistogramInterval;
import os.org.opensearch.search.aggregations.bucket.terms.IncludeExclude;
import os.org.opensearch.search.aggregations.bucket.terms.Terms;
import os.org.opensearch.search.aggregations.bucket.terms.TermsAggregationBuilder;
import os.org.opensearch.search.aggregations.metrics.MaxAggregationBuilder;
import os.org.opensearch.search.aggregations.metrics.SumAggregationBuilder;
import os.org.opensearch.search.builder.SearchSourceBuilder;
import os.org.opensearch.search.fetch.subphase.FetchSourceContext;
import os.org.opensearch.search.fetch.subphase.highlight.HighlightBuilder;
import os.org.opensearch.search.sort.FieldSortBuilder;
import os.org.opensearch.search.sort.NestedSortBuilder;
import os.org.opensearch.search.sort.SortBuilders;
import os.org.opensearch.search.sort.SortMode;
import os.org.opensearch.search.sort.SortOrder;
import os.org.opensearch.search.suggest.Suggest;
import os.org.opensearch.search.suggest.SuggestBuilder;
import os.org.opensearch.search.suggest.SuggestBuilders;
import os.org.opensearch.search.suggest.completion.CompletionSuggestionBuilder;
import os.org.opensearch.search.suggest.completion.context.CategoryQueryContext;

@Slf4j
// Not tagged with Repository annotation as it is programmatically initialized
public class OpenSearchClient implements SearchClient {
  @Getter protected final RestHighLevelClient client;
  public static final NamedXContentRegistry X_CONTENT_REGISTRY;
  private final boolean isClientAvailable;
  private final RBACConditionEvaluator rbacConditionEvaluator;
  private final QueryBuilderFactory queryBuilderFactory;

  private final String clusterAlias;

  private static final Set<String> FIELDS_TO_REMOVE =
      Set.of(
          "suggest",
          "service_suggest",
          "column_suggest",
          "schema_suggest",
          "database_suggest",
          "lifeCycle",
          "fqnParts",
          "chart_suggest",
          "field_suggest");

  private static final List<String> SOURCE_FIELDS_TO_EXCLUDE =
      Stream.concat(FIELDS_TO_REMOVE.stream(), Stream.of("schemaDefinition", "customMetrics"))
          .toList();

  static {
    SearchModule searchModule = new SearchModule(Settings.EMPTY, List.of());
    X_CONTENT_REGISTRY = new NamedXContentRegistry(searchModule.getNamedXContents());
  }

  public OpenSearchClient(ElasticSearchConfiguration config) {
    client = createOpenSearchClient(config);
    clusterAlias = config != null ? config.getClusterAlias() : "";
    isClientAvailable = client != null;
    queryBuilderFactory = new OpenSearchQueryBuilderFactory();
    rbacConditionEvaluator = new RBACConditionEvaluator(queryBuilderFactory);
  }

  @Override
  public boolean isClientAvailable() {
    return isClientAvailable;
  }

  @Override
  public boolean indexExists(String indexName) {
    try {
      GetIndexRequest gRequest = new GetIndexRequest(indexName);
      gRequest.local(false);
      return client.indices().exists(gRequest, RequestOptions.DEFAULT);
    } catch (Exception e) {
      LOG.error(String.format("Failed to check if index %s exists due to", indexName), e);
      return false;
    }
  }

  @Override
  public void createIndex(IndexMapping indexMapping, String indexMappingContent) {
    if (Boolean.TRUE.equals(isClientAvailable)) {
      try {
        CreateIndexRequest request =
            new CreateIndexRequest(indexMapping.getIndexName(clusterAlias));
        request.source(indexMappingContent, XContentType.JSON);
        CreateIndexResponse createIndexResponse =
            client.indices().create(request, RequestOptions.DEFAULT);
        LOG.debug(
            "{} Created {}",
            indexMapping.getIndexName(clusterAlias),
            createIndexResponse.isAcknowledged());
        // creating alias for indexes
        createAliases(indexMapping);
      } catch (Exception e) {
        LOG.error("Failed to create Open Search indexes due to", e);
      }
    } else {
      LOG.error(
          "Failed to create Open Search index as client is not property configured, Please check your OpenMetadata configuration");
    }
  }

  @Override
  public void addIndexAlias(IndexMapping indexMapping, String... aliasName) {
    try {
      IndicesAliasesRequest.AliasActions aliasAction =
          IndicesAliasesRequest.AliasActions.add()
              .index(indexMapping.getIndexName(clusterAlias))
              .aliases(aliasName);
      IndicesAliasesRequest aliasesRequest = new IndicesAliasesRequest();
      aliasesRequest.addAliasAction(aliasAction);
      client.indices().updateAliases(aliasesRequest, RequestOptions.DEFAULT);
    } catch (Exception e) {
      LOG.error(
          String.format(
              "Failed to create alias for %s due to", indexMapping.getAlias(clusterAlias)),
          e);
    }
  }

  @Override
  public void createAliases(IndexMapping indexMapping) {
    try {
      Set<String> aliases = new HashSet<>(indexMapping.getParentAliases(clusterAlias));
      aliases.add(indexMapping.getAlias(clusterAlias));
      addIndexAlias(indexMapping, aliases.toArray(new String[0]));
    } catch (Exception e) {
      LOG.error(
          String.format(
              "Failed to create alias for %s due to", indexMapping.getIndexName(clusterAlias)),
          e);
    }
  }

  @Override
  public void updateIndex(IndexMapping indexMapping, String indexMappingContent) {
    try {
      PutMappingRequest request = new PutMappingRequest(indexMapping.getIndexName(clusterAlias));
      JsonNode readProperties = JsonUtils.readTree(indexMappingContent).get("mappings");
      request.source(JsonUtils.getMap(readProperties));
      AcknowledgedResponse putMappingResponse =
          client.indices().putMapping(request, RequestOptions.DEFAULT);
      LOG.debug(
          "{} Updated {}", indexMapping.getIndexMappingFile(), putMappingResponse.isAcknowledged());
    } catch (Exception e) {
      LOG.warn(
          String.format(
              "Failed to Update Open Search index %s", indexMapping.getIndexName(clusterAlias)));
    }
  }

  @Override
  public void deleteIndex(IndexMapping indexMapping) {
    try {
      DeleteIndexRequest request = new DeleteIndexRequest(indexMapping.getIndexName(clusterAlias));
      AcknowledgedResponse deleteIndexResponse =
          client.indices().delete(request, RequestOptions.DEFAULT);
      LOG.debug(
          "{} Deleted {}",
          indexMapping.getIndexName(clusterAlias),
          deleteIndexResponse.isAcknowledged());
    } catch (Exception e) {
      LOG.error("Failed to delete Open Search indexes due to", e);
    }
  }

  @Override
  public Response search(SearchRequest request, SubjectContext subjectContext) throws IOException {
    SearchSourceBuilder searchSourceBuilder =
        getSearchSourceBuilder(
            request.getIndex(), request.getQuery(), request.getFrom(), request.getSize());

    buildSearchRBACQuery(subjectContext, searchSourceBuilder);

    // Add Query Filter
    buildSearchSourceFilter(request.getQueryFilter(), searchSourceBuilder);

    if (!nullOrEmpty(request.getPostFilter())) {
      try {
        XContentParser filterParser =
            XContentType.JSON
                .xContent()
                .createParser(
                    X_CONTENT_REGISTRY,
                    LoggingDeprecationHandler.INSTANCE,
                    request.getPostFilter());
        QueryBuilder filter = SearchSourceBuilder.fromXContent(filterParser).query();
        searchSourceBuilder.postFilter(filter);
      } catch (Exception ex) {
        LOG.warn("Error parsing post_filter from query parameters, ignoring filter", ex);
      }
    }

    if (!nullOrEmpty(request.getSearchAfter())) {
      searchSourceBuilder.searchAfter(request.getSearchAfter());
    }

    /* For backward-compatibility we continue supporting the deleted argument, this should be removed in future versions */
    if (request
            .getIndex()
            .equalsIgnoreCase(Entity.getSearchRepository().getIndexOrAliasName(GLOBAL_SEARCH_ALIAS))
        || request
            .getIndex()
            .equalsIgnoreCase(Entity.getSearchRepository().getIndexOrAliasName("dataAsset"))) {
      BoolQueryBuilder boolQueryBuilder = QueryBuilders.boolQuery();
      boolQueryBuilder.should(
          QueryBuilders.boolQuery()
              .must(searchSourceBuilder.query())
              .must(QueryBuilders.existsQuery("deleted"))
              .must(QueryBuilders.termQuery("deleted", request.isDeleted())));
      boolQueryBuilder.should(
          QueryBuilders.boolQuery()
              .must(searchSourceBuilder.query())
              .mustNot(QueryBuilders.existsQuery("deleted")));
      searchSourceBuilder.query(boolQueryBuilder);
    } else if (request
            .getIndex()
            .equalsIgnoreCase(
                Entity.getSearchRepository().getIndexMapping(DOMAIN).getIndexName(clusterAlias))
        || request
            .getIndex()
            .equalsIgnoreCase(
                Entity.getSearchRepository()
                    .getIndexMapping(DATA_PRODUCT)
                    .getIndexName(clusterAlias))
        || request
            .getIndex()
            .equalsIgnoreCase(
                Entity.getSearchRepository().getIndexMapping(QUERY).getIndexName(clusterAlias))
        || request
            .getIndex()
            .equalsIgnoreCase(
                Entity.getSearchRepository().getIndexOrAliasName("knowledge_page_search_index"))
        || request
            .getIndex()
            .equalsIgnoreCase(
                Entity.getSearchRepository()
                    .getIndexMapping(RAW_COST_ANALYSIS_REPORT_DATA)
                    .getIndexName(clusterAlias))
        || request
            .getIndex()
            .equalsIgnoreCase(
                Entity.getSearchRepository()
                    .getIndexMapping(AGGREGATED_COST_ANALYSIS_REPORT_DATA)
                    .getIndexName(clusterAlias))) {
      searchSourceBuilder.query(QueryBuilders.boolQuery().must(searchSourceBuilder.query()));
    } else {
      searchSourceBuilder.query(
          QueryBuilders.boolQuery()
              .must(searchSourceBuilder.query())
              .must(QueryBuilders.termQuery("deleted", request.isDeleted())));
    }

    if (!nullOrEmpty(request.getSortFieldParam()) && !request.isGetHierarchy()) {
      FieldSortBuilder fieldSortBuilder =
          new FieldSortBuilder(request.getSortFieldParam())
              .order(SortOrder.fromString(request.getSortOrder()));
      // Score is an internal ES Field
      if (!request.getSortFieldParam().equalsIgnoreCase("_score")) {
        fieldSortBuilder.unmappedType("integer");
      }
      searchSourceBuilder.sort(fieldSortBuilder);
    }

    if (request
        .getIndex()
        .equalsIgnoreCase(
            Entity.getSearchRepository()
                .getIndexMapping(GLOSSARY_TERM)
                .getIndexName(clusterAlias))) {
      searchSourceBuilder.query(QueryBuilders.boolQuery().must(searchSourceBuilder.query()));
    }

    buildHierarchyQuery(request, searchSourceBuilder, client);

    /* for performance reasons OpenSearch doesn't provide accurate hits
    if we enable trackTotalHits parameter it will try to match every result, count and return hits
    however in most cases for search results an approximate value is good enough.
    we are displaying total entity counts in landing page and explore page where we need the total count
    https://github.com/Open/Opensearch/issues/33028 */
    searchSourceBuilder.fetchSource(
        new FetchSourceContext(
            request.isFetchSource(),
            request.getIncludeSourceFields().toArray(String[]::new),
            new String[] {}));

    if (request.isTrackTotalHits()) {
      searchSourceBuilder.trackTotalHits(true);
    } else {
      searchSourceBuilder.trackTotalHitsUpTo(MAX_RESULT_HITS);
    }

    searchSourceBuilder.timeout(new TimeValue(30, TimeUnit.SECONDS));
    if (request.isExplain()) {
      searchSourceBuilder.explain(true);
    }
    try {
      SearchResponse searchResponse =
          client.search(
              new os.org.opensearch.action.search.SearchRequest(request.getIndex())
                  .source(searchSourceBuilder),
              RequestOptions.DEFAULT);
      if (!request.isGetHierarchy()) {
        return Response.status(OK).entity(searchResponse.toString()).build();
      } else {
        // Build the nested hierarchy from elastic search response
        List<?> response = buildSearchHierarchy(request, searchResponse);
        return Response.status(OK).entity(response).build();
      }
    } catch (IndexNotFoundException e) {
      throw new SearchIndexNotFoundException(
          String.format("Failed to to find index %s", request.getIndex()));
    }
  }

  @Override
  public Response getDocByID(String indexName, String entityId) throws IOException {
    try {
      GetRequest request =
          new GetRequest(Entity.getSearchRepository().getIndexOrAliasName(indexName), entityId);
      GetResponse response = client.get(request, RequestOptions.DEFAULT);

      if (response.isExists()) {
        return Response.status(OK).entity(response.toString()).build();
      }

    } catch (OpenSearchException e) {
      if (e.status() == RestStatus.NOT_FOUND) {
        throw new SearchIndexNotFoundException(
            String.format("Failed to to find doc with id %s", entityId));
      } else {
        throw new SearchException(String.format("Search failed due to %s", e.getMessage()));
      }
    }
    return getResponse(NOT_FOUND, "Document not found.");
  }

  private void buildHierarchyQuery(
      SearchRequest request, SearchSourceBuilder searchSourceBuilder, RestHighLevelClient client)
      throws IOException {

    if (!request.isGetHierarchy()) {
      return;
    }

    String indexName = request.getIndex();
    String glossaryTermIndex =
        Entity.getSearchRepository().getIndexMapping(GLOSSARY_TERM).getIndexName(clusterAlias);
    String domainIndex =
        Entity.getSearchRepository().getIndexMapping(DOMAIN).getIndexName(clusterAlias);

    BoolQueryBuilder baseQuery =
        QueryBuilders.boolQuery()
            .should(searchSourceBuilder.query())
            .should(QueryBuilders.matchPhraseQuery("fullyQualifiedName", request.getQuery()))
            .should(QueryBuilders.matchPhraseQuery("name", request.getQuery()))
            .should(QueryBuilders.matchPhraseQuery("displayName", request.getQuery()));

    if (indexName.equalsIgnoreCase(glossaryTermIndex)) {
      baseQuery
          .should(QueryBuilders.matchPhraseQuery("glossary.fullyQualifiedName", request.getQuery()))
          .should(QueryBuilders.matchPhraseQuery("glossary.displayName", request.getQuery()))
          .must(QueryBuilders.matchQuery("status", "Approved"));
    } else if (indexName.equalsIgnoreCase(domainIndex)) {
      baseQuery
          .should(QueryBuilders.matchPhraseQuery("parent.fullyQualifiedName", request.getQuery()))
          .should(QueryBuilders.matchPhraseQuery("parent.displayName", request.getQuery()));
    }

    baseQuery.minimumShouldMatch(1);
    searchSourceBuilder.query(baseQuery);

    SearchResponse searchResponse =
        client.search(
            new os.org.opensearch.action.search.SearchRequest(request.getIndex())
                .source(searchSourceBuilder),
            RequestOptions.DEFAULT);

    Terms parentTerms = searchResponse.getAggregations().get("fqnParts_agg");

    // Build  es query to get parent terms for the user input query , to build correct hierarchy
    // In case of default search , no need to get parent terms they are already present in the
    // response
    if (parentTerms != null
        && !parentTerms.getBuckets().isEmpty()
        && !request.getQuery().equals("*")) {
      BoolQueryBuilder parentTermQueryBuilder = QueryBuilders.boolQuery();

      parentTerms.getBuckets().stream()
          .map(Terms.Bucket::getKeyAsString)
          .forEach(
              parentTerm ->
                  parentTermQueryBuilder.should(
                      QueryBuilders.matchQuery("fullyQualifiedName", parentTerm)));
      if (indexName.equalsIgnoreCase(glossaryTermIndex)) {
        parentTermQueryBuilder
            .minimumShouldMatch(1)
            .must(QueryBuilders.matchQuery("status", "Approved"));
      } else {
        parentTermQueryBuilder.minimumShouldMatch(1);
      }
      searchSourceBuilder.query(parentTermQueryBuilder);
    }

    searchSourceBuilder.sort(SortBuilders.fieldSort("fullyQualifiedName").order(SortOrder.ASC));
  }

  public List<?> buildSearchHierarchy(SearchRequest request, SearchResponse searchResponse) {
    List<?> response = new ArrayList<>();
    String indexName = request.getIndex();
    String glossaryTermIndex =
        Entity.getSearchRepository().getIndexMapping(GLOSSARY_TERM).getIndexName(clusterAlias);
    String domainIndex =
        Entity.getSearchRepository().getIndexMapping(DOMAIN).getIndexName(clusterAlias);

    if (indexName.equalsIgnoreCase(glossaryTermIndex)) {
      response = buildGlossaryTermSearchHierarchy(searchResponse);
    } else if (indexName.equalsIgnoreCase(domainIndex)) {
      response = buildDomainSearchHierarchy(searchResponse);
    }
    return response;
  }

  public List<EntityHierarchy> buildGlossaryTermSearchHierarchy(SearchResponse searchResponse) {
    Map<String, EntityHierarchy> termMap =
        new LinkedHashMap<>(); // termMap represent glossary terms
    Map<String, EntityHierarchy> rootTerms =
        new LinkedHashMap<>(); // rootTerms represent glossaries

    for (var hit : searchResponse.getHits().getHits()) {
      String jsonSource = hit.getSourceAsString();

      EntityHierarchy term = JsonUtils.readValue(jsonSource, EntityHierarchy.class);
      EntityHierarchy glossaryInfo =
          JsonUtils.readTree(jsonSource).path("glossary").isMissingNode()
              ? null
              : JsonUtils.convertValue(
                  JsonUtils.readTree(jsonSource).path("glossary"), EntityHierarchy.class);

      if (glossaryInfo != null) {
        rootTerms.putIfAbsent(glossaryInfo.getFullyQualifiedName(), glossaryInfo);
      }

      term.setChildren(new ArrayList<>());
      termMap.putIfAbsent(term.getFullyQualifiedName(), term);
    }

    termMap.putAll(rootTerms);

    termMap
        .values()
        .forEach(
            term -> {
              String parentFQN = getParentFQN(term.getFullyQualifiedName());
              String termFQN = term.getFullyQualifiedName();

              if (parentFQN != null && termMap.containsKey(parentFQN)) {
                EntityHierarchy parentTerm = termMap.get(parentFQN);
                List<EntityHierarchy> children = parentTerm.getChildren();
                children.removeIf(
                    child -> child.getFullyQualifiedName().equals(term.getFullyQualifiedName()));
                children.add(term);
                parentTerm.setChildren(children);
              } else {
                if (rootTerms.containsKey(termFQN)) {
                  EntityHierarchy rootTerm = rootTerms.get(termFQN);
                  rootTerm.setChildren(term.getChildren());
                }
              }
            });

    return new ArrayList<>(rootTerms.values());
  }

  public List<EntityHierarchy> buildDomainSearchHierarchy(SearchResponse searchResponse) {
    Map<String, EntityHierarchy> entityHierarchyMap =
        Arrays.stream(searchResponse.getHits().getHits())
            .map(hit -> JsonUtils.readValue(hit.getSourceAsString(), EntityHierarchy.class))
            .collect(
                Collectors.toMap(
                    EntityHierarchy::getFullyQualifiedName,
                    entity -> {
                      entity.setChildren(new ArrayList<>());
                      return entity;
                    },
                    (existing, replacement) -> existing,
                    LinkedHashMap::new));

    List<EntityHierarchy> rootDomains = new ArrayList<>();

    entityHierarchyMap
        .values()
        .forEach(
            entity -> {
              String parentFqn = getParentFQN(entity.getFullyQualifiedName());
              EntityHierarchy parentEntity = entityHierarchyMap.get(parentFqn);
              if (parentEntity != null) {
                parentEntity.getChildren().add(entity);
              } else {
                rootDomains.add(entity);
              }
            });

    return rootDomains;
  }

  @Override
  public SearchResultListMapper listWithOffset(
      String filter,
      int limit,
      int offset,
      String index,
      SearchSortFilter searchSortFilter,
      String q)
      throws IOException {
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    if (!nullOrEmpty(q)) {
      searchSourceBuilder = getSearchSourceBuilder(index, q, offset, limit);
    }

    List<Map<String, Object>> results = new ArrayList<>();
    getSearchFilter(filter, searchSourceBuilder, !nullOrEmpty(q));

    searchSourceBuilder.timeout(new TimeValue(30, TimeUnit.SECONDS));
    searchSourceBuilder.from(offset);
    searchSourceBuilder.size(limit);
    if (searchSortFilter.isSorted()) {
      FieldSortBuilder fieldSortBuilder =
          SortBuilders.fieldSort(searchSortFilter.getSortField())
              .order(SortOrder.fromString(searchSortFilter.getSortType()));
      if (searchSortFilter.isNested()) {
        NestedSortBuilder nestedSortBuilder =
            new NestedSortBuilder(searchSortFilter.getSortNestedPath());
        fieldSortBuilder.setNestedSort(nestedSortBuilder);
        fieldSortBuilder.sortMode(
            SortMode.valueOf(searchSortFilter.getSortNestedMode().toUpperCase()));
      }
      searchSourceBuilder.sort(fieldSortBuilder);
    }
    try {
      SearchResponse response =
          client.search(
              new os.org.opensearch.action.search.SearchRequest(index).source(searchSourceBuilder),
              RequestOptions.DEFAULT);
      SearchHits searchHits = response.getHits();
      SearchHit[] hits = searchHits.getHits();
      Arrays.stream(hits).forEach(hit -> results.add(hit.getSourceAsMap()));
      return new SearchResultListMapper(results, searchHits.getTotalHits().value);
    } catch (OpenSearchStatusException e) {
      if (e.status() == RestStatus.NOT_FOUND) {
        throw new SearchIndexNotFoundException(String.format("Failed to to find index %s", index));
      } else {
        throw new SearchException(String.format("Search failed due to %s", e.getDetailedMessage()));
      }
    }
  }

  @Override
  public SearchResultListMapper listWithDeepPagination(
      String index,
      String query,
      String filter,
      String[] fields,
      SearchSortFilter searchSortFilter,
      int size,
      Object[] searchAfter)
      throws IOException {
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    if (!nullOrEmpty(query)) {
      searchSourceBuilder = getSearchSourceBuilder(index, query, 0, size);
    }
    if (!nullOrEmpty(fields)) {
      searchSourceBuilder.fetchSource(fields, null);
    }

    List<Map<String, Object>> results = new ArrayList<>();

    if (Optional.ofNullable(filter).isPresent()) {
      getSearchFilter(filter, searchSourceBuilder, !nullOrEmpty(query));
    }

    searchSourceBuilder.timeout(new TimeValue(30, TimeUnit.SECONDS));
    searchSourceBuilder.from(0);
    searchSourceBuilder.size(size);

    if (Optional.ofNullable(searchAfter).isPresent()) {
      searchSourceBuilder.searchAfter(searchAfter);
    }

    if (searchSortFilter.isSorted()) {
      FieldSortBuilder fieldSortBuilder =
          SortBuilders.fieldSort(searchSortFilter.getSortField())
              .order(SortOrder.fromString(searchSortFilter.getSortType()));
      if (searchSortFilter.isNested()) {
        NestedSortBuilder nestedSortBuilder =
            new NestedSortBuilder(searchSortFilter.getSortNestedPath());
        fieldSortBuilder.setNestedSort(nestedSortBuilder);
        fieldSortBuilder.sortMode(
            SortMode.valueOf(searchSortFilter.getSortNestedMode().toUpperCase()));
      }
      searchSourceBuilder.sort(fieldSortBuilder);
    }
    try {
      SearchResponse response =
          client.search(
              new os.org.opensearch.action.search.SearchRequest(index).source(searchSourceBuilder),
              RequestOptions.DEFAULT);
      SearchHits searchHits = response.getHits();
      List<SearchHit> hits = List.of(searchHits.getHits());
      Object[] lastHitSortValues = null;

      if (!hits.isEmpty()) {
        lastHitSortValues = hits.get(hits.size() - 1).getSortValues();
      }

      hits.forEach(hit -> results.add(hit.getSourceAsMap()));
      return new SearchResultListMapper(
          results, searchHits.getTotalHits().value, lastHitSortValues);
    } catch (OpenSearchStatusException e) {
      if (e.status() == RestStatus.NOT_FOUND) {
        throw new SearchIndexNotFoundException(String.format("Failed to to find index %s", index));
      } else {
        throw new SearchException(String.format("Search failed due to %s", e.getDetailedMessage()));
      }
    }
  }

  @Override
  public Response searchBySourceUrl(String sourceUrl) throws IOException {
    os.org.opensearch.action.search.SearchRequest searchRequest =
        new os.org.opensearch.action.search.SearchRequest(
            Entity.getSearchRepository().getIndexOrAliasName(GLOBAL_SEARCH_ALIAS));
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    searchSourceBuilder.query(
        QueryBuilders.boolQuery().must(QueryBuilders.termQuery("sourceUrl", sourceUrl)));
    searchRequest.source(searchSourceBuilder);
    String response = client.search(searchRequest, RequestOptions.DEFAULT).toString();
    return Response.status(OK).entity(response).build();
  }

  public Map<String, Object> searchLineageInternal(
      String fqn,
      int upstreamDepth,
      int downstreamDepth,
      String queryFilter,
      boolean deleted,
      String entityType)
      throws IOException {
    if (entityType.equalsIgnoreCase(Entity.PIPELINE)
        || entityType.equalsIgnoreCase(Entity.STORED_PROCEDURE)) {
      return searchPipelineLineage(fqn, upstreamDepth, downstreamDepth, queryFilter, deleted);
    }
    Map<String, Object> responseMap = new HashMap<>();
    Set<Map<String, Object>> edges = new HashSet<>();
    Set<Map<String, Object>> nodes = new HashSet<>();
    os.org.opensearch.action.search.SearchRequest searchRequest =
        new os.org.opensearch.action.search.SearchRequest(
            Entity.getSearchRepository().getIndexOrAliasName(GLOBAL_SEARCH_ALIAS));
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    List<String> sourceFieldsToExcludeCopy = new ArrayList<>(SOURCE_FIELDS_TO_EXCLUDE);
    searchSourceBuilder.fetchSource(null, sourceFieldsToExcludeCopy.toArray(String[]::new));
    searchSourceBuilder.query(
        QueryBuilders.boolQuery().must(QueryBuilders.termQuery("fullyQualifiedName", fqn)));
    searchRequest.source(searchSourceBuilder.size(1000));
    SearchResponse searchResponse = client.search(searchRequest, RequestOptions.DEFAULT);
    for (var hit : searchResponse.getHits().getHits()) {
      HashMap<String, Object> tempMap = new HashMap<>(JsonUtils.getMap(hit.getSourceAsMap()));
      tempMap.keySet().removeAll(FIELDS_TO_REMOVE);
      responseMap.put("entity", tempMap);
    }
    getLineage(
        fqn,
        downstreamDepth,
        edges,
        nodes,
        queryFilter,
        "lineage.fromEntity.fqnHash.keyword",
        deleted);
    getLineage(
        fqn, upstreamDepth, edges, nodes, queryFilter, "lineage.toEntity.fqnHash.keyword", deleted);
    responseMap.put("edges", edges);
    responseMap.put("nodes", nodes);
    return responseMap;
  }

  @Override
  public Response searchLineage(
      String fqn,
      int upstreamDepth,
      int downstreamDepth,
      String queryFilter,
      boolean deleted,
      String entityType)
      throws IOException {
    Map<String, Object> responseMap =
        searchLineageInternal(
            fqn, upstreamDepth, downstreamDepth, queryFilter, deleted, entityType);
    return Response.status(OK).entity(responseMap).build();
  }

  private void getEntityRelationship(
      String fqn,
      int depth,
      Set<Map<String, Object>> edges,
      Set<Map<String, Object>> nodes,
      String queryFilter,
      String direction,
      boolean deleted)
      throws IOException {
    if (depth <= 0) {
      return;
    }
    os.org.opensearch.action.search.SearchRequest searchRequest =
        new os.org.opensearch.action.search.SearchRequest(
            Entity.getSearchRepository().getIndexOrAliasName(GLOBAL_SEARCH_ALIAS));
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    searchSourceBuilder.query(
        QueryBuilders.boolQuery()
            .must(QueryBuilders.termQuery(direction, FullyQualifiedName.buildHash(fqn))));
    if (CommonUtil.nullOrEmpty(deleted)) {
      searchSourceBuilder.query(
          QueryBuilders.boolQuery()
              .must(QueryBuilders.termQuery(direction, FullyQualifiedName.buildHash(fqn)))
              .must(QueryBuilders.termQuery("deleted", deleted)));
    }
    if (!nullOrEmpty(queryFilter) && !queryFilter.equals("{}")) {
      try {
        XContentParser filterParser =
            XContentType.JSON
                .xContent()
                .createParser(X_CONTENT_REGISTRY, LoggingDeprecationHandler.INSTANCE, queryFilter);
        QueryBuilder filter = SearchSourceBuilder.fromXContent(filterParser).query();
        BoolQueryBuilder newQuery =
            QueryBuilders.boolQuery().must(searchSourceBuilder.query()).filter(filter);
        searchSourceBuilder.query(newQuery);
      } catch (Exception ex) {
        LOG.warn("Error parsing query_filter from query parameters, ignoring filter", ex);
      }
    }
    searchRequest.source(searchSourceBuilder.size(1000));
    os.org.opensearch.action.search.SearchResponse searchResponse =
        client.search(searchRequest, RequestOptions.DEFAULT);
    for (var hit : searchResponse.getHits().getHits()) {
      List<Map<String, Object>> entityRelationship =
          (List<Map<String, Object>>) hit.getSourceAsMap().get("entityRelationship");
      HashMap<String, Object> tempMap = new HashMap<>(JsonUtils.getMap(hit.getSourceAsMap()));
      tempMap.keySet().removeAll(FIELDS_TO_REMOVE_ENTITY_RELATIONSHIP);
      nodes.add(tempMap);
      for (Map<String, Object> er : entityRelationship) {
        Map<String, String> entity = (HashMap<String, String>) er.get("entity");
        Map<String, String> relatedEntity = (HashMap<String, String>) er.get("relatedEntity");
        if (direction.equalsIgnoreCase(ENTITY_RELATIONSHIP_DIRECTION_ENTITY)) {
          if (!edges.contains(er) && entity.get("fqn").equals(fqn)) {
            edges.add(er);
            getEntityRelationship(
                relatedEntity.get("fqn"), depth - 1, edges, nodes, queryFilter, direction, deleted);
          }
        } else {
          if (!edges.contains(er) && relatedEntity.get("fqn").equals(fqn)) {
            edges.add(er);
            getEntityRelationship(
                entity.get("fqn"), depth - 1, edges, nodes, queryFilter, direction, deleted);
          }
        }
      }
    }
  }

  public Map<String, Object> searchEntityRelationshipInternal(
      String fqn, int upstreamDepth, int downstreamDepth, String queryFilter, boolean deleted)
      throws IOException {
    Map<String, Object> responseMap = new HashMap<>();
    Set<Map<String, Object>> edges = new HashSet<>();
    Set<Map<String, Object>> nodes = new HashSet<>();
    os.org.opensearch.action.search.SearchRequest searchRequest =
        new os.org.opensearch.action.search.SearchRequest(
            Entity.getSearchRepository().getIndexOrAliasName(GLOBAL_SEARCH_ALIAS));
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    searchSourceBuilder.query(
        QueryBuilders.boolQuery().must(QueryBuilders.termQuery("fullyQualifiedName", fqn)));
    searchRequest.source(searchSourceBuilder.size(1000));
    SearchResponse searchResponse = client.search(searchRequest, RequestOptions.DEFAULT);
    for (var hit : searchResponse.getHits().getHits()) {
      HashMap<String, Object> tempMap = new HashMap<>(JsonUtils.getMap(hit.getSourceAsMap()));
      tempMap.keySet().removeAll(FIELDS_TO_REMOVE);
      responseMap.put("entity", tempMap);
    }
    getEntityRelationship(
        fqn,
        downstreamDepth,
        edges,
        nodes,
        queryFilter,
        ENTITY_RELATIONSHIP_DIRECTION_ENTITY,
        deleted);
    getEntityRelationship(
        fqn,
        upstreamDepth,
        edges,
        nodes,
        queryFilter,
        ENTITY_RELATIONSHIP_DIRECTION_RELATED_ENTITY,
        deleted);
    responseMap.put("edges", edges);
    responseMap.put("nodes", nodes);
    return responseMap;
  }

  @Override
  public Response searchEntityRelationship(
      String fqn, int upstreamDepth, int downstreamDepth, String queryFilter, boolean deleted)
      throws IOException {
    Map<String, Object> responseMap =
        searchEntityRelationshipInternal(fqn, upstreamDepth, downstreamDepth, queryFilter, deleted);
    return Response.status(OK).entity(responseMap).build();
  }

  @Override
  public Response searchDataQualityLineage(
      String fqn, int upstreamDepth, String queryFilter, boolean deleted) throws IOException {
    Map<String, Object> responseMap = new HashMap<>();
    Set<Map<String, Object>> edges = new HashSet<>();
    Set<Map<String, Object>> nodes = new HashSet<>();
    searchDataQualityLineage(fqn, upstreamDepth, queryFilter, deleted, edges, nodes);
    responseMap.put("edges", edges);
    responseMap.put("nodes", nodes);
    return Response.status(OK).entity(responseMap).build();
  }

  public Map<String, Object> searchSchemaEntityRelationshipInternal(
      String fqn, int upstreamDepth, int downstreamDepth, String queryFilter, boolean deleted)
      throws IOException {
    Map<String, Object> responseMap = new HashMap<>();
    Set<Map<String, Object>> edges = new HashSet<>();
    Set<Map<String, Object>> nodes = new HashSet<>();
    os.org.opensearch.action.search.SearchRequest searchRequest =
        new os.org.opensearch.action.search.SearchRequest(
            Entity.getSearchRepository().getIndexOrAliasName(GLOBAL_SEARCH_ALIAS));
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    searchSourceBuilder.query(
        QueryBuilders.boolQuery().must(QueryBuilders.termQuery("fullyQualifiedName", fqn)));
    searchRequest.source(searchSourceBuilder.size(1000));
    SearchResponse searchResponse = client.search(searchRequest, RequestOptions.DEFAULT);
    for (var hit : searchResponse.getHits().getHits()) {
      HashMap<String, Object> tempMap = new HashMap<>(JsonUtils.getMap(hit.getSourceAsMap()));
      tempMap.keySet().removeAll(FIELDS_TO_REMOVE);
      responseMap.put("entity", tempMap);
    }
    TableRepository repository = (TableRepository) Entity.getEntityRepository(TABLE);
    ListFilter filter = new ListFilter(Include.NON_DELETED).addQueryParam("databaseSchema", fqn);
    List<Table> tables =
        repository.listAll(repository.getFields("tableConstraints, displayName, owners"), filter);
    for (Table table : tables) {
      getEntityRelationship(
          table.getFullyQualifiedName(),
          downstreamDepth,
          edges,
          nodes,
          queryFilter,
          ENTITY_RELATIONSHIP_DIRECTION_ENTITY,
          deleted);
      getEntityRelationship(
          table.getFullyQualifiedName(),
          upstreamDepth,
          edges,
          nodes,
          queryFilter,
          ENTITY_RELATIONSHIP_DIRECTION_RELATED_ENTITY,
          deleted);
    }
    // Add the remaining tables from the list into the nodes
    // These will the one's that do not have any entity relationship
    for (Table table : tables) {
      boolean tablePresent = false;
      for (Map<String, Object> node : nodes) {
        if (table.getId().toString().equals(node.get("id"))) {
          tablePresent = true;
          break;
        }
      }
      if (!tablePresent) {
        HashMap<String, Object> tableMap = new HashMap<>(JsonUtils.getMap(table));
        tableMap.keySet().removeAll(FIELDS_TO_REMOVE_ENTITY_RELATIONSHIP);
        tableMap.put("entityType", "table");
        nodes.add(tableMap);
      }
    }
    responseMap.put("edges", edges);
    responseMap.put("nodes", nodes);
    return responseMap;
  }

  public Response searchSchemaEntityRelationship(
      String fqn, int upstreamDepth, int downstreamDepth, String queryFilter, boolean deleted)
      throws IOException {
    Map<String, Object> responseMap =
        searchSchemaEntityRelationshipInternal(
            fqn, upstreamDepth, downstreamDepth, queryFilter, deleted);
    return Response.status(OK).entity(responseMap).build();
  }

  private void getLineage(
      String fqn,
      int depth,
      Set<Map<String, Object>> edges,
      Set<Map<String, Object>> nodes,
      String queryFilter,
      String direction,
      boolean deleted)
      throws IOException {
    if (depth <= 0) {
      return;
    }
    os.org.opensearch.action.search.SearchRequest searchRequest =
        new os.org.opensearch.action.search.SearchRequest(
            Entity.getSearchRepository().getIndexOrAliasName(GLOBAL_SEARCH_ALIAS));
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    searchSourceBuilder.fetchSource(null, SOURCE_FIELDS_TO_EXCLUDE.toArray(String[]::new));
    searchSourceBuilder.query(
        QueryBuilders.boolQuery()
            .must(QueryBuilders.termQuery(direction, FullyQualifiedName.buildHash(fqn))));
    if (CommonUtil.nullOrEmpty(deleted)) {
      searchSourceBuilder.query(
          QueryBuilders.boolQuery()
              .must(QueryBuilders.termQuery(direction, FullyQualifiedName.buildHash(fqn)))
              .must(QueryBuilders.termQuery("deleted", deleted)));
    }
    buildSearchSourceFilter(queryFilter, searchSourceBuilder);

    searchRequest.source(searchSourceBuilder.size(1000));
    os.org.opensearch.action.search.SearchResponse searchResponse =
        client.search(searchRequest, RequestOptions.DEFAULT);
    for (var hit : searchResponse.getHits().getHits()) {
      List<Map<String, Object>> lineage =
          (List<Map<String, Object>>) hit.getSourceAsMap().get("lineage");
      HashMap<String, Object> tempMap = new HashMap<>(JsonUtils.getMap(hit.getSourceAsMap()));
      nodes.add(tempMap);
      for (Map<String, Object> lin : lineage) {
        HashMap<String, String> fromEntity = (HashMap<String, String>) lin.get("fromEntity");
        HashMap<String, String> toEntity = (HashMap<String, String>) lin.get("toEntity");
        if (direction.equalsIgnoreCase("lineage.fromEntity.fqnHash.keyword")) {
          if (!edges.contains(lin) && fromEntity.get("fqn").equals(fqn)) {
            edges.add(lin);
            getLineage(
                toEntity.get("fqn"), depth - 1, edges, nodes, queryFilter, direction, deleted);
          }
        } else {
          if (!edges.contains(lin) && toEntity.get("fqn").equals(fqn)) {
            edges.add(lin);
            getLineage(
                fromEntity.get("fqn"), depth - 1, edges, nodes, queryFilter, direction, deleted);
          }
        }
      }
    }
  }

  private void searchDataQualityLineage(
      String fqn,
      int upstreamDepth,
      String queryFilter,
      boolean deleted,
      Set<Map<String, Object>> edges,
      Set<Map<String, Object>> nodes)
      throws IOException {
    Map<String, Map<String, Object>> allNodes = new HashMap<>();
    Map<String, List<Map<String, Object>>> allEdges = new HashMap<>();
    Set<String> nodesWithFailures = new HashSet<>();

    collectNodesAndEdges(
        fqn,
        upstreamDepth,
        queryFilter,
        deleted,
        allEdges,
        allNodes,
        nodesWithFailures,
        new HashSet<>());
    for (String nodeWithFailure : nodesWithFailures) {
      traceBackDQLineage(
          nodeWithFailure, nodesWithFailures, allEdges, allNodes, nodes, edges, new HashSet<>());
    }
  }

  private void collectNodesAndEdges(
      String fqn,
      int upstreamDepth,
      String queryFilter,
      boolean deleted,
      Map<String, List<Map<String, Object>>> allEdges,
      Map<String, Map<String, Object>> allNodes,
      Set<String> nodesWithFailure,
      Set<String> processedNode)
      throws IOException {
    TestCaseResultRepository testCaseResultRepository = new TestCaseResultRepository();
    if (upstreamDepth <= 0 || processedNode.contains(fqn)) {
      return;
    }
    processedNode.add(fqn);
    SearchResponse searchResponse = performLineageSearch(fqn, queryFilter, deleted);
    Optional<List> optionalDocs =
        JsonUtils.readJsonAtPath(searchResponse.toString(), "$.hits.hits[*]._source", List.class);

    if (optionalDocs.isPresent()) {
      List<Map<String, Object>> docs = (List<Map<String, Object>>) optionalDocs.get();
      for (Map<String, Object> doc : docs) {
        String nodeId = doc.get("id").toString();
        allNodes.put(nodeId, doc);
        if (testCaseResultRepository.hasTestCaseFailure(doc.get("fullyQualifiedName").toString())) {
          nodesWithFailure.add(nodeId);
        }
        Optional<List> optionalLineageList =
            JsonUtils.readJsonAtPath(JsonUtils.pojoToJson(doc), "$.lineage", List.class);
        if (optionalLineageList.isPresent()) {
          List<Map<String, Object>> lineageList =
              (List<Map<String, Object>>) optionalLineageList.get();
          for (Map<String, Object> lineage : lineageList) {
            Map<String, String> fromEntity = (Map<String, String>) lineage.get("fromEntity");
            String fromEntityId = fromEntity.get("id");
            allEdges.computeIfAbsent(fromEntityId, k -> new ArrayList<>()).add(lineage);
            collectNodesAndEdges(
                fromEntity.get("fqn"),
                upstreamDepth - 1,
                queryFilter,
                deleted,
                allEdges,
                allNodes,
                nodesWithFailure,
                processedNode);
          }
        }
      }
    }
  }

  private void traceBackDQLineage(
      String nodeFailureId,
      Set<String> nodesWithFailures,
      Map<String, List<Map<String, Object>>> allEdges,
      Map<String, Map<String, Object>> allNodes,
      Set<Map<String, Object>> nodes,
      Set<Map<String, Object>> edges,
      Set<String> processedNodes) {
    if (processedNodes.contains(nodeFailureId)) {
      return;
    }

    processedNodes.add(nodeFailureId);
    if (nodesWithFailures.contains(nodeFailureId)) {
      Map<String, Object> node = allNodes.get(nodeFailureId);
      if (node != null) {
        node.keySet().removeAll(FIELDS_TO_REMOVE);
        node.remove("lineage");
        nodes.add(node);
      }
    }
    List<Map<String, Object>> edgesForNode = allEdges.get(nodeFailureId);
    if (edgesForNode != null) {
      for (Map<String, Object> edge : edgesForNode) {
        Map<String, String> fromEntity = (Map<String, String>) edge.get("fromEntity");
        String fromEntityId = fromEntity.get("id");
        if (!fromEntityId.equals(nodeFailureId)) continue; // skip if the edge is from the node
        Map<String, String> toEntity = (Map<String, String>) edge.get("toEntity");
        edges.add(edge);
        traceBackDQLineage(
            toEntity.get("id"),
            nodesWithFailures,
            allEdges,
            allNodes,
            nodes,
            edges,
            processedNodes);
      }
    }
  }

  private SearchResponse performLineageSearch(String fqn, String queryFilter, boolean deleted)
      throws IOException {
    os.org.opensearch.action.search.SearchRequest searchRequest =
        new os.org.opensearch.action.search.SearchRequest(
            Entity.getSearchRepository().getIndexOrAliasName(GLOBAL_SEARCH_ALIAS));
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    searchSourceBuilder.query(
        QueryBuilders.boolQuery()
            .must(
                QueryBuilders.termQuery(
                    "lineage.fromEntity.fqnHash.keyword", FullyQualifiedName.buildHash(fqn)))
            .must(QueryBuilders.termQuery("deleted", !nullOrEmpty(deleted) && deleted)));

    buildSearchSourceFilter(queryFilter, searchSourceBuilder);
    searchRequest.source(searchSourceBuilder.size(1000));
    return client.search(searchRequest, RequestOptions.DEFAULT);
  }

  private Map<String, Object> searchPipelineLineage(
      String fqn, int upstreamDepth, int downstreamDepth, String queryFilter, boolean deleted)
      throws IOException {
    Map<String, Object> responseMap = new HashMap<>();
    Set<Map<String, Object>> edges = new HashSet<>();
    Set<Map<String, Object>> nodes = new HashSet<>();
    responseMap.put("entity", null);
    Object[] searchAfter = null;
    long processedRecords = 0;
    long totalRecords = -1;
    while (totalRecords != processedRecords) {
      os.org.opensearch.action.search.SearchRequest searchRequest =
          new os.org.opensearch.action.search.SearchRequest(
              Entity.getSearchRepository().getIndexOrAliasName(GLOBAL_SEARCH_ALIAS));
      BoolQueryBuilder boolQueryBuilder = QueryBuilders.boolQuery();
      boolQueryBuilder.should(
          QueryBuilders.boolQuery()
              .must(QueryBuilders.termQuery("lineage.pipeline.fullyQualifiedName.keyword", fqn)));
      SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
      searchSourceBuilder.fetchSource(null, SOURCE_FIELDS_TO_EXCLUDE.toArray(String[]::new));
      FieldSortBuilder sortBuilder = SortBuilders.fieldSort("fullyQualifiedName");
      searchSourceBuilder.sort(sortBuilder);
      searchSourceBuilder.query(boolQueryBuilder);
      if (searchAfter != null) {
        searchSourceBuilder.searchAfter(searchAfter);
      }
      if (CommonUtil.nullOrEmpty(deleted)) {
        searchSourceBuilder.query(
            QueryBuilders.boolQuery()
                .must(boolQueryBuilder)
                .must(QueryBuilders.termQuery("deleted", deleted)));
      }
      buildSearchSourceFilter(queryFilter, searchSourceBuilder);

      searchRequest.source(searchSourceBuilder);
      SearchResponse searchResponse = client.search(searchRequest, RequestOptions.DEFAULT);
      for (var hit : searchResponse.getHits().getHits()) {
        List<Map<String, Object>> lineage =
            (List<Map<String, Object>>) hit.getSourceAsMap().get("lineage");
        HashMap<String, Object> tempMap = new HashMap<>(JsonUtils.getMap(hit.getSourceAsMap()));
        nodes.add(tempMap);
        for (Map<String, Object> lin : lineage) {
          HashMap<String, String> fromEntity = (HashMap<String, String>) lin.get("fromEntity");
          HashMap<String, String> toEntity = (HashMap<String, String>) lin.get("toEntity");
          HashMap<String, String> pipeline = (HashMap<String, String>) lin.get("pipeline");
          if (pipeline != null && pipeline.get("fullyQualifiedName").equalsIgnoreCase(fqn)) {
            edges.add(lin);
            getLineage(
                fromEntity.get("fqn"),
                upstreamDepth,
                edges,
                nodes,
                queryFilter,
                "lineage.toEntity.fqn.keyword",
                deleted);
            getLineage(
                toEntity.get("fqn"),
                downstreamDepth,
                edges,
                nodes,
                queryFilter,
                "lineage.fromEntity.fqn.keyword",
                deleted);
          }
        }
      }
      totalRecords = searchResponse.getHits().getTotalHits().value;
      int currentHits = searchResponse.getHits().getHits().length;
      processedRecords += currentHits;
      if (currentHits > 0) {
        searchAfter = searchResponse.getHits().getHits()[currentHits - 1].getSortValues();
      } else {
        searchAfter = null;
      }
    }
    getLineage(
        fqn, downstreamDepth, edges, nodes, queryFilter, "lineage.fromEntity.fqn.keyword", deleted);
    getLineage(
        fqn, upstreamDepth, edges, nodes, queryFilter, "lineage.toEntity.fqn.keyword", deleted);

    if (edges.isEmpty()) {
      os.org.opensearch.action.search.SearchRequest searchRequestForEntity =
          new os.org.opensearch.action.search.SearchRequest(
              Entity.getSearchRepository().getIndexOrAliasName(GLOBAL_SEARCH_ALIAS));
      SearchSourceBuilder searchSourceBuilderForEntity = new SearchSourceBuilder();
      searchSourceBuilderForEntity.query(
          QueryBuilders.boolQuery().must(QueryBuilders.termQuery("fullyQualifiedName", fqn)));
      searchRequestForEntity.source(searchSourceBuilderForEntity.size(1000));
      SearchResponse searchResponseForEntity =
          client.search(searchRequestForEntity, RequestOptions.DEFAULT);
      for (var hit : searchResponseForEntity.getHits().getHits()) {
        HashMap<String, Object> tempMap = new HashMap<>(JsonUtils.getMap(hit.getSourceAsMap()));
        tempMap.keySet().removeAll(FIELDS_TO_REMOVE);
        responseMap.put("entity", tempMap);
      }
    }
    responseMap.put("edges", edges);
    responseMap.put("nodes", nodes);
    return responseMap;
  }

  private static FunctionScoreQueryBuilder boostScore(QueryStringQueryBuilder queryBuilder) {
    FunctionScoreQueryBuilder.FilterFunctionBuilder tier1Boost =
        new FunctionScoreQueryBuilder.FilterFunctionBuilder(
            QueryBuilders.termQuery("tier.tagFQN", "Tier1"),
            ScoreFunctionBuilders.weightFactorFunction(50.0f));

    FunctionScoreQueryBuilder.FilterFunctionBuilder tier2Boost =
        new FunctionScoreQueryBuilder.FilterFunctionBuilder(
            QueryBuilders.termQuery("tier.tagFQN", "Tier2"),
            ScoreFunctionBuilders.weightFactorFunction(30.0f));

    FunctionScoreQueryBuilder.FilterFunctionBuilder tier3Boost =
        new FunctionScoreQueryBuilder.FilterFunctionBuilder(
            QueryBuilders.termQuery("tier.tagFQN", "Tier3"),
            ScoreFunctionBuilders.weightFactorFunction(15.0f));

    FunctionScoreQueryBuilder.FilterFunctionBuilder weeklyStatsBoost =
        new FunctionScoreQueryBuilder.FilterFunctionBuilder(
            QueryBuilders.rangeQuery("usageSummary.weeklyStats.count").gt(0),
            ScoreFunctionBuilders.fieldValueFactorFunction("usageSummary.weeklyStats.count")
                .factor(4.0f)
                .modifier(FieldValueFactorFunction.Modifier.SQRT)
                .missing(1));

    FunctionScoreQueryBuilder.FilterFunctionBuilder totalVotesBoost =
        new FunctionScoreQueryBuilder.FilterFunctionBuilder(
            QueryBuilders.rangeQuery("totalVotes").gt(0),
            ScoreFunctionBuilders.fieldValueFactorFunction("totalVotes")
                .factor(3.0f)
                .modifier(FieldValueFactorFunction.Modifier.LN1P)
                .missing(0));

    // FunctionScoreQueryBuilder with an array of score functions
    return QueryBuilders.functionScoreQuery(
            queryBuilder,
            new FunctionScoreQueryBuilder.FilterFunctionBuilder[] {
              tier1Boost, tier2Boost, tier3Boost, weeklyStatsBoost, totalVotesBoost
            })
        .scoreMode(FunctionScoreQuery.ScoreMode.SUM)
        .boostMode(CombineFunction.MULTIPLY);
  }

  private static HighlightBuilder buildHighlights(List<String> fields) {
    List<String> defaultFields =
        List.of(FIELD_DISPLAY_NAME, FIELD_DESCRIPTION, FIELD_DISPLAY_NAME_NGRAM);
    defaultFields = Stream.concat(defaultFields.stream(), fields.stream()).toList();
    HighlightBuilder hb = new HighlightBuilder();
    for (String field : defaultFields) {
      HighlightBuilder.Field highlightField = new HighlightBuilder.Field(field);
      highlightField.highlighterType(UNIFIED);
      hb.field(highlightField);
    }
    hb.preTags(PRE_TAG);
    hb.postTags(POST_TAG);
    hb.maxAnalyzerOffset(MAX_ANALYZED_OFFSET);
    return hb;
  }

  @Override
  public Response searchByField(String fieldName, String fieldValue, String index)
      throws IOException {
    os.org.opensearch.action.search.SearchRequest searchRequest =
        new os.org.opensearch.action.search.SearchRequest(
            Entity.getSearchRepository().getIndexOrAliasName(index));
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    searchSourceBuilder.query(QueryBuilders.wildcardQuery(fieldName, fieldValue));
    searchRequest.source(searchSourceBuilder);
    String response = client.search(searchRequest, RequestOptions.DEFAULT).toString();
    return Response.status(OK).entity(response).build();
  }

  public Response aggregate(String index, String fieldName, String value, String query)
      throws IOException {
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    XContentParser filterParser =
        XContentType.JSON
            .xContent()
            .createParser(X_CONTENT_REGISTRY, LoggingDeprecationHandler.INSTANCE, query);
    QueryBuilder filter = SearchSourceBuilder.fromXContent(filterParser).query();

    BoolQueryBuilder boolQueryBuilder = QueryBuilders.boolQuery().must(filter);
    searchSourceBuilder
        .aggregation(
            AggregationBuilders.terms(fieldName)
                .field(fieldName)
                .size(MAX_AGGREGATE_SIZE)
                .includeExclude(new IncludeExclude(value.toLowerCase(), null))
                .order(BucketOrder.key(true)))
        .query(boolQueryBuilder)
        .size(0);
    searchSourceBuilder.timeout(new TimeValue(30, TimeUnit.SECONDS));
    String response =
        client
            .search(
                new os.org.opensearch.action.search.SearchRequest(
                        Entity.getSearchRepository().getIndexOrAliasName(index))
                    .source(searchSourceBuilder),
                RequestOptions.DEFAULT)
            .toString();
    return Response.status(OK).entity(response).build();
  }

  @Override
  public DataQualityReport genericAggregation(
      String query, String index, SearchAggregation aggregationMetadata) throws IOException {
    List<OpenAggregations> aggregationBuilder =
        OpenAggregationsBuilder.buildAggregation(
            aggregationMetadata.getAggregationTree(), null, new ArrayList<>());

    // Create search request
    os.org.opensearch.action.search.SearchRequest searchRequest =
        new os.org.opensearch.action.search.SearchRequest(
            Entity.getSearchRepository().getIndexOrAliasName(index));

    // Create search source builder
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    if (query != null) {
      XContentParser queryParser =
          XContentType.JSON
              .xContent()
              .createParser(X_CONTENT_REGISTRY, LoggingDeprecationHandler.INSTANCE, query);
      QueryBuilder parsedQuery = SearchSourceBuilder.fromXContent(queryParser).query();
      BoolQueryBuilder boolQueryBuilder = QueryBuilders.boolQuery().must(parsedQuery);
      searchSourceBuilder.query(boolQueryBuilder);
    }
    searchSourceBuilder.size(0).timeout(new TimeValue(30, TimeUnit.SECONDS));

    for (OpenAggregations aggregation : aggregationBuilder) {
      if (!aggregation.isPipelineAggregation()) {
        searchSourceBuilder.aggregation(aggregation.getElasticAggregationBuilder());
      } else {
        searchSourceBuilder.aggregation(aggregation.getElasticPipelineAggregationBuilder());
      }
    }

    searchRequest.source(searchSourceBuilder);
    String response = client.search(searchRequest, RequestOptions.DEFAULT).toString();
    JsonObject jsonResponse = JsonUtils.readJson(response).asJsonObject();
    Optional<JsonObject> aggregationResults =
        Optional.ofNullable(jsonResponse.getJsonObject("aggregations"));
    return SearchIndexUtils.parseAggregationResults(
        aggregationResults, aggregationMetadata.getAggregationMetadata());
  }

  @Override
  public JsonObject aggregate(
      String query, String index, SearchAggregation searchAggregation, String filter)
      throws IOException {
    if (searchAggregation == null) {
      return null;
    }

    List<OpenAggregations> aggregationBuilder =
        OpenAggregationsBuilder.buildAggregation(
            searchAggregation.getAggregationTree(), null, new ArrayList<>());
    os.org.opensearch.action.search.SearchRequest searchRequest =
        new os.org.opensearch.action.search.SearchRequest(
            Entity.getSearchRepository().getIndexOrAliasName(index));
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    if (query != null) {
      XContentParser queryParser =
          XContentType.JSON
              .xContent()
              .createParser(X_CONTENT_REGISTRY, LoggingDeprecationHandler.INSTANCE, query);
      QueryBuilder parsedQuery = SearchSourceBuilder.fromXContent(queryParser).query();
      BoolQueryBuilder boolQueryBuilder = QueryBuilders.boolQuery().must(parsedQuery);
      searchSourceBuilder.query(boolQueryBuilder);
    }
    getSearchFilter(filter, searchSourceBuilder, !nullOrEmpty(query));

    searchSourceBuilder.size(0).timeout(new TimeValue(30, TimeUnit.SECONDS));

    for (OpenAggregations aggregation : aggregationBuilder) {
      if (!aggregation.isPipelineAggregation()) {
        searchSourceBuilder.aggregation(aggregation.getElasticAggregationBuilder());
      } else {
        searchSourceBuilder.aggregation(aggregation.getElasticPipelineAggregationBuilder());
      }
    }

    searchRequest.source(searchSourceBuilder);

    String response = client.search(searchRequest, RequestOptions.DEFAULT).toString();
    JsonObject jsonResponse = JsonUtils.readJson(response).asJsonObject();
    return jsonResponse.getJsonObject("aggregations");
  }

  @SneakyThrows
  public void updateSearch(UpdateRequest updateRequest) {
    if (updateRequest != null) {
      updateRequest.setRefreshPolicy(WriteRequest.RefreshPolicy.IMMEDIATE);
      LOG.debug(SENDING_REQUEST_TO_ELASTIC_SEARCH, updateRequest);
      client.update(updateRequest, RequestOptions.DEFAULT);
    }
  }

  public Response suggest(SearchRequest request) throws IOException {
    String fieldName = request.getFieldName();
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    CompletionSuggestionBuilder suggestionBuilder =
        SuggestBuilders.completionSuggestion(fieldName)
            .prefix(request.getQuery(), Fuzziness.AUTO)
            .size(request.getSize())
            .skipDuplicates(true);
    if (fieldName.equalsIgnoreCase("suggest")) {
      suggestionBuilder.contexts(
          Collections.singletonMap(
              "deleted",
              Collections.singletonList(
                  CategoryQueryContext.builder()
                      .setCategory(String.valueOf(request.isDeleted()))
                      .build())));
    }
    SuggestBuilder suggestBuilder = new SuggestBuilder();
    suggestBuilder.addSuggestion("metadata-suggest", suggestionBuilder);
    searchSourceBuilder
        .suggest(suggestBuilder)
        .timeout(new TimeValue(30, TimeUnit.SECONDS))
        .fetchSource(
            new FetchSourceContext(
                request.isFetchSource(),
                request.getIncludeSourceFields().toArray(String[]::new),
                new String[] {}));
    os.org.opensearch.action.search.SearchRequest searchRequest =
        new os.org.opensearch.action.search.SearchRequest(
                Entity.getSearchRepository().getIndexOrAliasName(request.getIndex()))
            .source(searchSourceBuilder);
    SearchResponse searchResponse = client.search(searchRequest, RequestOptions.DEFAULT);
    Suggest suggest = searchResponse.getSuggest();
    return Response.status(OK).entity(suggest.toString()).build();
  }

  private static SearchSourceBuilder buildPipelineSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryStringBuilder =
        buildSearchQueryBuilder(query, PipelineIndex.getFields());
    FunctionScoreQueryBuilder queryBuilder = boostScore(queryStringBuilder);
    HighlightBuilder hb = buildHighlights(List.of("tasks.name", "tasks.description"));
    SearchSourceBuilder searchSourceBuilder = searchBuilder(queryBuilder, hb, from, size);
    searchSourceBuilder.aggregation(
        AggregationBuilders.terms("tasks.displayName.keyword").field("tasks.displayName.keyword"));
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder buildMlModelSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryStringBuilder =
        buildSearchQueryBuilder(query, MlModelIndex.getFields());
    FunctionScoreQueryBuilder queryBuilder = boostScore(queryStringBuilder);
    HighlightBuilder hb = buildHighlights(List.of("mlFeatures.name", "mlFeatures.description"));
    SearchSourceBuilder searchSourceBuilder = searchBuilder(queryBuilder, hb, from, size);
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder buildTopicSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryStringBuilder =
        buildSearchQueryBuilder(query, TopicIndex.getFields());
    FunctionScoreQueryBuilder queryBuilder = boostScore(queryStringBuilder);
    HighlightBuilder hb =
        buildHighlights(
            List.of(
                "messageSchema.schemaFields.description",
                "messageSchema.schemaFields.children.name"));
    SearchSourceBuilder searchSourceBuilder = searchBuilder(queryBuilder, hb, from, size);
    searchSourceBuilder
        .aggregation(
            AggregationBuilders.terms(ES_MESSAGE_SCHEMA_FIELD_KEYWORD)
                .field(ES_MESSAGE_SCHEMA_FIELD_KEYWORD))
        .aggregation(AggregationBuilders.terms(SCHEMA_FIELD_NAMES).field(SCHEMA_FIELD_NAMES));
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder buildDashboardSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryStringBuilder =
        buildSearchQueryBuilder(query, DashboardIndex.getFields());
    FunctionScoreQueryBuilder queryBuilder = boostScore(queryStringBuilder);
    HighlightBuilder hb = buildHighlights(List.of("charts.name", "charts.description"));
    SearchSourceBuilder searchSourceBuilder = searchBuilder(queryBuilder, hb, from, size);
    searchSourceBuilder
        .aggregation(
            AggregationBuilders.terms("dataModels.displayName.keyword")
                .field("dataModels.displayName.keyword"))
        .aggregation(AggregationBuilders.terms("project.keyword").field("project.keyword"))
        .aggregation(
            AggregationBuilders.terms("charts.displayName.keyword")
                .field("charts.displayName.keyword"));
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder buildSearchAcrossIndexesBuilder(
      String query, int from, int size) {
    QueryStringQueryBuilder queryStringBuilder =
        buildSearchQueryBuilder(query, SearchIndex.getAllFields());
    FunctionScoreQueryBuilder queryBuilder = boostScore(queryStringBuilder);
    queryBuilder.boostMode(CombineFunction.SUM);
    SearchSourceBuilder searchSourceBuilder = searchBuilder(queryBuilder, null, from, size);
    searchSourceBuilder.aggregation(
        AggregationBuilders.terms("database.name.keyword")
            .field("database.name.keyword")
            .size(MAX_AGGREGATE_SIZE));
    searchSourceBuilder.aggregation(
        AggregationBuilders.terms("databaseSchema.name.keyword")
            .field("databaseSchema.name.keyword")
            .size(MAX_AGGREGATE_SIZE));
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder buildDataAssetsSearchBuilder(
      String query, int from, int size) {
    QueryStringQueryBuilder queryStringBuilder =
        buildSearchQueryBuilder(query, SearchIndex.getAllFields());
    FunctionScoreQueryBuilder queryBuilder = boostScore(queryStringBuilder);
    queryBuilder.boostMode(CombineFunction.SUM);
    SearchSourceBuilder searchSourceBuilder = searchBuilder(queryBuilder, null, from, size);
    searchSourceBuilder.aggregation(
        AggregationBuilders.terms("database.name.keyword")
            .field("database.name.keyword")
            .size(MAX_AGGREGATE_SIZE));
    searchSourceBuilder.aggregation(
        AggregationBuilders.terms("databaseSchema.name.keyword")
            .field("databaseSchema.name.keyword")
            .size(MAX_AGGREGATE_SIZE));
    searchSourceBuilder.aggregation(
        AggregationBuilders.terms("database.displayName")
            .field("database.displayName")
            .size(MAX_AGGREGATE_SIZE));
    searchSourceBuilder.aggregation(
        AggregationBuilders.terms("databaseSchema.displayName")
            .field("databaseSchema.displayName")
            .size(MAX_AGGREGATE_SIZE));
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder buildGenericDataAssetSearchBuilder(
      String query, int from, int size) {
    QueryStringQueryBuilder queryStringBuilder =
        buildSearchQueryBuilder(query, SearchIndex.getDefaultFields());
    FunctionScoreQueryBuilder queryBuilder = boostScore(queryStringBuilder);
    HighlightBuilder hb = buildHighlights(new ArrayList<>());
    SearchSourceBuilder searchSourceBuilder = searchBuilder(queryBuilder, hb, from, size);
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder buildTableSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryStringBuilder =
        buildSearchQueryBuilder(query, TableIndex.getFields());

    FunctionScoreQueryBuilder queryBuilder = boostScore(queryStringBuilder);
    HighlightBuilder hb =
        buildHighlights(List.of("columns.name", "columns.description", "columns.children.name"));
    SearchSourceBuilder searchSourceBuilder =
        new SearchSourceBuilder().query(queryBuilder).highlighter(hb).from(from).size(size);
    searchSourceBuilder.aggregation(
        AggregationBuilders.terms("database.displayName.keyword")
            .field("database.displayName.keyword"));
    searchSourceBuilder
        .aggregation(
            AggregationBuilders.terms("databaseSchema.displayName.keyword")
                .field("databaseSchema.displayName.keyword"))
        .aggregation(AggregationBuilders.terms(COLUMNS_NAME_KEYWORD).field(COLUMNS_NAME_KEYWORD))
        .aggregation(AggregationBuilders.terms(FIELD_COLUMN_NAMES).field(FIELD_COLUMN_NAMES))
        .aggregation(AggregationBuilders.terms("tableType").field("tableType"));
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder buildUserOrTeamSearchBuilder(
      String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        QueryBuilders.queryStringQuery(query)
            .fields(UserIndex.getFields())
            .fuzziness(Fuzziness.AUTO);
    return searchBuilder(queryBuilder, null, from, size);
  }

  private static SearchSourceBuilder buildGlossaryTermSearchBuilder(
      String query, int from, int size) {
    QueryStringQueryBuilder queryStringBuilder =
        buildSearchQueryBuilder(query, GlossaryTermIndex.getFields());
    FunctionScoreQueryBuilder queryBuilder = boostScore(queryStringBuilder);
    HighlightBuilder hb = buildHighlights(List.of("synonyms"));
    SearchSourceBuilder searchSourceBuilder =
        new SearchSourceBuilder().query(queryBuilder).highlighter(hb).from(from).size(size);
    searchSourceBuilder.aggregation(
        AggregationBuilders.terms("glossary.name.keyword").field("glossary.name.keyword"));
    searchSourceBuilder.aggregation(
        AggregationBuilders.terms("fqnParts_agg").field("fqnParts").size(1000));
    searchSourceBuilder.aggregation(AggregationBuilders.terms("status").field("status"));
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder buildTagSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryStringBuilder =
        buildSearchQueryBuilder(query, TagIndex.getFields());
    FunctionScoreQueryBuilder queryBuilder = boostScore(queryStringBuilder);
    HighlightBuilder hb = buildHighlights(new ArrayList<>());
    SearchSourceBuilder searchSourceBuilder =
        new SearchSourceBuilder().query(queryBuilder).highlighter(hb).from(from).size(size);
    searchSourceBuilder.aggregation(
        AggregationBuilders.terms("classification.name.keyword")
            .field("classification.name.keyword"));
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder buildContainerSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryStringBuilder =
        buildSearchQueryBuilder(query, ContainerIndex.getFields());
    FunctionScoreQueryBuilder queryBuilder = boostScore(queryStringBuilder);
    HighlightBuilder hb =
        buildHighlights(
            List.of(
                "dataModel.columns.name",
                "dataModel.columns.description",
                "dataModel.columns.name.description"));
    SearchSourceBuilder searchSourceBuilder =
        new SearchSourceBuilder().query(queryBuilder).highlighter(hb).from(from).size(size);
    searchSourceBuilder
        .aggregation(
            AggregationBuilders.terms(DATA_MODEL_COLUMNS_NAME_KEYWORD)
                .field(DATA_MODEL_COLUMNS_NAME_KEYWORD))
        .aggregation(AggregationBuilders.terms(FIELD_COLUMN_NAMES).field(FIELD_COLUMN_NAMES));
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder buildQuerySearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryStringBuilder =
        buildSearchQueryBuilder(query, QueryIndex.getFields());
    FunctionScoreQueryBuilder queryBuilder = boostScore(queryStringBuilder);
    HighlightBuilder hb = buildHighlights(new ArrayList<>());
    return searchBuilder(queryBuilder, hb, from, size);
  }

  private static SearchSourceBuilder buildTestCaseSearch(String query, int from, int size) {
    QueryStringQueryBuilder queryStringBuilder =
        buildSearchQueryBuilder(query, TestCaseIndex.getFields());
    FunctionScoreQueryBuilder queryBuilder = boostScore(queryStringBuilder);
    HighlightBuilder hb = buildHighlights(List.of("testSuite.name", "testSuite.description"));
    return searchBuilder(queryBuilder, hb, from, size);
  }

  private static SearchSourceBuilder buildStoredProcedureSearch(String query, int from, int size) {
    QueryStringQueryBuilder queryStringBuilder =
        buildSearchQueryBuilder(query, StoredProcedureIndex.getFields());
    FunctionScoreQueryBuilder queryBuilder = boostScore(queryStringBuilder);
    HighlightBuilder hb = buildHighlights(new ArrayList<>());
    SearchSourceBuilder searchSourceBuilder =
        new SearchSourceBuilder().query(queryBuilder).highlighter(hb).from(from).size(size);
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder buildDashboardDataModelsSearch(
      String query, int from, int size) {
    QueryStringQueryBuilder queryStringBuilder =
        buildSearchQueryBuilder(query, DashboardDataModelIndex.getFields());
    FunctionScoreQueryBuilder queryBuilder = boostScore(queryStringBuilder);
    HighlightBuilder hb = buildHighlights(new ArrayList<>());
    SearchSourceBuilder searchSourceBuilder =
        new SearchSourceBuilder().query(queryBuilder).highlighter(hb).from(from).size(size);
    searchSourceBuilder
        .aggregation(AggregationBuilders.terms("dataModelType").field("dataModelType"))
        .aggregation(AggregationBuilders.terms(COLUMNS_NAME_KEYWORD).field(COLUMNS_NAME_KEYWORD))
        .aggregation(AggregationBuilders.terms("project.keyword").field("project.keyword"))
        .aggregation(AggregationBuilders.terms(FIELD_COLUMN_NAMES).field(FIELD_COLUMN_NAMES));
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder buildCostAnalysisReportDataSearch(
      String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder = QueryBuilders.queryStringQuery(query);
    return searchBuilder(queryBuilder, null, from, size);
  }

  private static SearchSourceBuilder buildDomainsSearch(String query, int from, int size) {
    QueryStringQueryBuilder queryStringBuilder =
        buildSearchQueryBuilder(query, DomainIndex.getFields());
    FunctionScoreQueryBuilder queryBuilder = boostScore(queryStringBuilder);
    HighlightBuilder hb = buildHighlights(new ArrayList<>());
    return searchBuilder(queryBuilder, hb, from, size);
  }

  private static SearchSourceBuilder buildSearchEntitySearch(String query, int from, int size) {
    QueryStringQueryBuilder queryStringBuilder =
        buildSearchQueryBuilder(query, SearchEntityIndex.getFields());
    FunctionScoreQueryBuilder queryBuilder = boostScore(queryStringBuilder);
    HighlightBuilder hb = buildHighlights(new ArrayList<>());
    SearchSourceBuilder searchSourceBuilder =
        new SearchSourceBuilder().query(queryBuilder).highlighter(hb).from(from).size(size);
    searchSourceBuilder.aggregation(
        AggregationBuilders.terms("fields.name.keyword").field("fields.name.keyword"));
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder buildTestCaseResolutionStatusSearch(
      String query, int from, int size) {
    QueryStringQueryBuilder queryStringBuilder =
        buildSearchQueryBuilder(query, TestCaseResolutionStatusIndex.getFields());
    FunctionScoreQueryBuilder queryBuilder = boostScore(queryStringBuilder);
    HighlightBuilder hb = buildHighlights(new ArrayList<>());
    return searchBuilder(queryBuilder, hb, from, size);
  }

  private static SearchSourceBuilder buildTestCaseResultSearch(String query, int from, int size) {
    QueryStringQueryBuilder queryStringBuilder =
        buildSearchQueryBuilder(query, TestCaseResultIndex.getFields());
    FunctionScoreQueryBuilder queryBuilder = boostScore(queryStringBuilder);
    HighlightBuilder hb = buildHighlights(new ArrayList<>());
    return searchBuilder(queryBuilder, hb, from, size);
  }

  private static QueryStringQueryBuilder buildSearchQueryBuilder(
      String query, Map<String, Float> fields) {
    return QueryBuilders.queryStringQuery(query)
        .fields(fields)
        .type(MultiMatchQueryBuilder.Type.MOST_FIELDS)
        .defaultOperator(Operator.AND)
        .fuzziness(Fuzziness.AUTO)
        .fuzzyPrefixLength(3)
        .tieBreaker(0.5f);
  }

  private static SearchSourceBuilder buildApiEndpointSearch(String query, int from, int size) {
    QueryStringQueryBuilder queryStringBuilder =
        buildSearchQueryBuilder(query, APIEndpointIndex.getFields());
    FunctionScoreQueryBuilder queryBuilder = boostScore(queryStringBuilder);
    HighlightBuilder hb = buildHighlights(new ArrayList<>());
    SearchSourceBuilder searchSourceBuilder = searchBuilder(queryBuilder, hb, from, size);
    searchSourceBuilder
        .aggregation(
            AggregationBuilders.terms(API_RESPONSE_SCHEMA_FIELD)
                .field(API_RESPONSE_SCHEMA_FIELD_KEYWORD))
        .aggregation(AggregationBuilders.terms(SCHEMA_FIELD_NAMES).field(SCHEMA_FIELD_NAMES));
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder buildAggregateSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        QueryBuilders.queryStringQuery(query)
            .fields(SearchIndex.getAllFields())
            .fuzziness(Fuzziness.AUTO);
    SearchSourceBuilder searchSourceBuilder = searchBuilder(queryBuilder, null, from, size);
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder addAggregation(SearchSourceBuilder builder) {
    builder
        .aggregation(
            AggregationBuilders.terms("serviceType").field("serviceType").size(MAX_AGGREGATE_SIZE))
        .aggregation(
            AggregationBuilders.terms("service.displayName.keyword")
                .field("service.displayName.keyword")
                .size(MAX_AGGREGATE_SIZE))
        .aggregation(
            AggregationBuilders.terms("entityType").field("entityType").size(MAX_AGGREGATE_SIZE))
        .aggregation(
            AggregationBuilders.terms("tier.tagFQN").field("tier.tagFQN").size(MAX_AGGREGATE_SIZE))
        .aggregation(
            AggregationBuilders.terms("certification.tagLabel.tagFQN")
                .field("certification.tagLabel.tagFQN")
                .size(MAX_AGGREGATE_SIZE))
        .aggregation(
            AggregationBuilders.terms(OWNER_DISPLAY_NAME_KEYWORD)
                .field(OWNER_DISPLAY_NAME_KEYWORD)
                .size(MAX_AGGREGATE_SIZE))
        .aggregation(
            AggregationBuilders.terms(DOMAIN_DISPLAY_NAME_KEYWORD)
                .field(DOMAIN_DISPLAY_NAME_KEYWORD)
                .size(MAX_AGGREGATE_SIZE))
        .aggregation(AggregationBuilders.terms(ES_TAG_FQN_FIELD).field(ES_TAG_FQN_FIELD))
        .aggregation(
            AggregationBuilders.terms("index_count").field("_index").size(MAX_AGGREGATE_SIZE));
    return builder;
  }

  private static SearchSourceBuilder buildServiceSearchBuilder(String query, int from, int size) {
    QueryStringQueryBuilder queryBuilder =
        buildSearchQueryBuilder(query, SearchIndex.getDefaultFields());
    HighlightBuilder hb = buildHighlights(new ArrayList<>());
    return searchBuilder(queryBuilder, hb, from, size);
  }

  private static SearchSourceBuilder buildDataProductSearch(String query, int from, int size) {
    QueryStringQueryBuilder queryStringBuilder =
        buildSearchQueryBuilder(query, DataProductIndex.getFields());
    FunctionScoreQueryBuilder queryBuilder = boostScore(queryStringBuilder);
    HighlightBuilder hb = buildHighlights(new ArrayList<>());
    SearchSourceBuilder searchSourceBuilder =
        new SearchSourceBuilder().query(queryBuilder).highlighter(hb).from(from).size(size);
    return addAggregation(searchSourceBuilder);
  }

  private static SearchSourceBuilder searchBuilder(
      QueryBuilder queryBuilder, HighlightBuilder hb, int from, int size) {
    SearchSourceBuilder builder =
        new SearchSourceBuilder().query(queryBuilder).from(from).size(size);
    if (hb != null) {
      hb.preTags(PRE_TAG);
      hb.postTags(POST_TAG);
      builder.highlighter(hb);
    }
    return builder;
  }

  @Override
  public ElasticSearchConfiguration.SearchType getSearchType() {
    return ElasticSearchConfiguration.SearchType.OPENSEARCH;
  }

  @Override
  public void createEntity(String indexName, String docId, String doc) {
    if (isClientAvailable) {
      UpdateRequest updateRequest = new UpdateRequest(indexName, docId);
      updateRequest.doc(doc, XContentType.JSON);
      updateRequest.docAsUpsert(true);
      updateSearch(updateRequest);
    }
  }

  @Override
  public void createEntities(String indexName, List<Map<String, String>> docsAndIds)
      throws IOException {
    if (isClientAvailable) {
      BulkRequest bulkRequest = new BulkRequest();
      for (Map<String, String> docAndId : docsAndIds) {
        Map.Entry<String, String> entry = docAndId.entrySet().iterator().next();
        UpdateRequest updateRequest = new UpdateRequest(indexName, entry.getKey());
        updateRequest.doc(entry.getValue(), XContentType.JSON);
        bulkRequest.add(updateRequest);
      }
      bulkRequest.setRefreshPolicy(WriteRequest.RefreshPolicy.IMMEDIATE);
      ActionListener<BulkResponse> listener =
          new ActionListener<BulkResponse>() {
            @Override
            public void onResponse(BulkResponse bulkItemResponses) {
              if (bulkItemResponses.hasFailures()) {
                LOG.error(
                    "Failed to create entities in ElasticSearch: {}",
                    bulkItemResponses.buildFailureMessage());
              } else {
                LOG.debug("Successfully created {} entities in ElasticSearch", docsAndIds.size());
              }
            }

            @Override
            public void onFailure(Exception e) {
              LOG.error("Failed to create entities in ElasticSearch", e);
            }
          };
      client.bulkAsync(bulkRequest, RequestOptions.DEFAULT, listener);
    }
  }

  @Override
  public void createTimeSeriesEntity(String indexName, String docId, String doc) {
    if (isClientAvailable) {
      UpdateRequest updateRequest = new UpdateRequest(indexName, docId);
      updateRequest.doc(doc, XContentType.JSON);
      updateRequest.docAsUpsert(true);
      updateSearch(updateRequest);
    }
  }

  @Override
  public void deleteByScript(String indexName, String scriptTxt, Map<String, Object> params) {
    if (isClientAvailable) {
      Script script = new Script(ScriptType.INLINE, Script.DEFAULT_SCRIPT_LANG, scriptTxt, params);
      ScriptQueryBuilder scriptQuery = new ScriptQueryBuilder(script);
      DeleteByQueryRequest deleteByQueryRequest = new DeleteByQueryRequest(indexName);
      deleteByQueryRequest.setQuery(scriptQuery);
      deleteEntityFromOpenSearchByQuery(deleteByQueryRequest);
    }
  }

  @Override
  public void deleteEntity(String indexName, String docId) {
    if (isClientAvailable) {
      DeleteRequest deleteRequest = new DeleteRequest(indexName, docId);
      deleteEntityFromOpenSearch(deleteRequest);
    }
  }

  @Override
  public void deleteEntityByFQNPrefix(String indexName, String fqnPrefix) {
    if (isClientAvailable) {
      DeleteByQueryRequest deleteByQueryRequest = new DeleteByQueryRequest(indexName);
      deleteByQueryRequest.setQuery(
          new PrefixQueryBuilder("fullyQualifiedName.keyword", fqnPrefix.toLowerCase()));
      deleteEntityFromOpenSearchByQuery(deleteByQueryRequest);
    }
  }

  @Override
  public void deleteEntityByFields(
      List<String> indexName, List<Pair<String, String>> fieldAndValue) {
    if (isClientAvailable) {
      BoolQueryBuilder queryBuilder = new BoolQueryBuilder();
      DeleteByQueryRequest deleteByQueryRequest =
          new DeleteByQueryRequest(indexName.toArray(new String[0]));
      for (Pair<String, String> p : fieldAndValue) {
        queryBuilder.must(new TermQueryBuilder(p.getKey(), p.getValue()));
      }
      deleteByQueryRequest.setQuery(queryBuilder);
      deleteEntityFromOpenSearchByQuery(deleteByQueryRequest);
    }
  }

  @Override
  public void softDeleteOrRestoreEntity(String indexName, String docId, String scriptTxt) {
    if (isClientAvailable) {
      UpdateRequest updateRequest = new UpdateRequest(indexName, docId);
      Script script =
          new Script(ScriptType.INLINE, Script.DEFAULT_SCRIPT_LANG, scriptTxt, new HashMap<>());
      updateRequest.script(script);
      updateSearch(updateRequest);
    }
  }

  @Override
  public void softDeleteOrRestoreChildren(
      List<String> indexName, String scriptTxt, List<Pair<String, String>> fieldAndValue) {
    if (isClientAvailable) {
      UpdateByQueryRequest updateByQueryRequest =
          new UpdateByQueryRequest(indexName.toArray(new String[0]));
      BoolQueryBuilder queryBuilder = new BoolQueryBuilder();
      for (Pair<String, String> p : fieldAndValue) {
        queryBuilder.must(new TermQueryBuilder(p.getKey(), p.getValue()));
      }
      updateByQueryRequest.setQuery(queryBuilder);
      Script script =
          new Script(ScriptType.INLINE, Script.DEFAULT_SCRIPT_LANG, scriptTxt, new HashMap<>());
      updateByQueryRequest.setScript(script);
      updateOpenSearchByQuery(updateByQueryRequest);
    }
  }

  @Override
  public void updateEntity(
      String indexName, String docId, Map<String, Object> doc, String scriptTxt) {
    if (isClientAvailable) {
      UpdateRequest updateRequest = new UpdateRequest(indexName, docId);
      Script script =
          new Script(
              ScriptType.INLINE, Script.DEFAULT_SCRIPT_LANG, scriptTxt, JsonUtils.getMap(doc));
      updateRequest.scriptedUpsert(true);
      updateRequest.script(script);
      updateOpenSearch(updateRequest);
    }
  }

  @Override
  public void reindexAcrossIndices(String matchingKey, EntityReference sourceRef) {
    if (isClientAvailable) {
      getAsyncExecutor()
          .submit(
              () -> {
                try {
                  // Initialize the 'from' parameter to 0
                  int from = 0;
                  boolean hasMoreResults = true;

                  while (hasMoreResults) {
                    List<EntityReference> entities =
                        ReindexingUtil.findReferenceInElasticSearchAcrossAllIndexes(
                            matchingKey,
                            ReindexingUtil.escapeDoubleQuotes(sourceRef.getFullyQualifiedName()),
                            from);

                    // Async Re-index the entities which matched
                    processEntitiesForReindex(entities);

                    // Update from
                    from += entities.size();
                    hasMoreResults = !entities.isEmpty();
                  }
                } catch (Exception ex) {
                  LOG.error("Reindexing Across Entities Failed", ex);
                }
              });
    }
  }

  private void processEntitiesForReindex(List<EntityReference> references) throws IOException {
    if (!references.isEmpty()) {
      // Process entities for reindex
      BulkRequest bulkRequests = new BulkRequest();
      // Build Bulk request
      for (EntityReference entityRef : references) {
        // Reindex entity
        UpdateRequest request =
            getUpdateRequest(entityRef.getType(), Entity.getEntity(entityRef, "*", Include.ALL));
        bulkRequests.add(request);
      }

      if (isClientAvailable) {
        client.bulk(bulkRequests, RequestOptions.DEFAULT);
      }
    }
  }

  private void updateChildren(
      UpdateByQueryRequest updateByQueryRequest,
      Pair<String, String> fieldAndValue,
      Pair<String, Map<String, Object>> updates) {
    updateByQueryRequest.setQuery(
        new MatchQueryBuilder(fieldAndValue.getKey(), fieldAndValue.getValue())
            .operator(Operator.AND));
    Script script =
        new Script(
            ScriptType.INLINE,
            Script.DEFAULT_SCRIPT_LANG,
            updates.getKey(),
            JsonUtils.getMap(updates.getValue() == null ? new HashMap<>() : updates.getValue()));
    updateByQueryRequest.setScript(script);
    updateOpenSearchByQuery(updateByQueryRequest);
  }

  @Override
  public void updateChildren(
      String indexName,
      Pair<String, String> fieldAndValue,
      Pair<String, Map<String, Object>> updates) {
    if (isClientAvailable) {
      UpdateByQueryRequest updateByQueryRequest =
          new UpdateByQueryRequest(Entity.getSearchRepository().getIndexOrAliasName(indexName));
      updateChildren(updateByQueryRequest, fieldAndValue, updates);
    }
  }

  @Override
  public void updateChildren(
      List<String> indexName,
      Pair<String, String> fieldAndValue,
      Pair<String, Map<String, Object>> updates) {
    if (isClientAvailable) {
      UpdateByQueryRequest updateByQueryRequest =
          new UpdateByQueryRequest(indexName.toArray(new String[0]));
      updateChildren(updateByQueryRequest, fieldAndValue, updates);
    }
  }

  @Override
  public void updateByFqnPrefix(String indexName, String oldParentFQN, String newParentFQN) {
    // Match all children documents whose fullyQualifiedName starts with the old parent's FQN
    PrefixQueryBuilder prefixQuery =
        new PrefixQueryBuilder("fullyQualifiedName", oldParentFQN + ".");

    UpdateByQueryRequest updateByQueryRequest = new UpdateByQueryRequest(indexName);
    updateByQueryRequest.setQuery(prefixQuery);

    Map<String, Object> params = new HashMap<>();
    params.put("oldParentFQN", oldParentFQN);
    params.put("newParentFQN", newParentFQN);

    String painlessScript =
        "String updatedFQN = ctx._source.fullyQualifiedName.replace(params.oldParentFQN, params.newParentFQN); "
            + "ctx._source.fullyQualifiedName = updatedFQN; "
            + "ctx._source.fqnDepth = updatedFQN.splitOnToken('.').length; "
            + "if (ctx._source.containsKey('parent')) { "
            + "    if (ctx._source.parent.containsKey('fullyQualifiedName')) { "
            + "        String parentFQN = ctx._source.parent.fullyQualifiedName; "
            + "        ctx._source.parent.fullyQualifiedName = parentFQN.replace(params.oldParentFQN, params.newParentFQN); "
            + "    } "
            + "}";
    Script inlineScript =
        new Script(ScriptType.INLINE, Script.DEFAULT_SCRIPT_LANG, painlessScript, params);

    updateByQueryRequest.setScript(inlineScript);

    try {
      updateOpenSearchByQuery(updateByQueryRequest);
      LOG.info("Successfully propagated FQN updates for parent FQN: {}", oldParentFQN);
    } catch (Exception e) {
      LOG.error("Error while propagating FQN updates: {}", e.getMessage(), e);
    }
  }

  @Override
  public void updateLineage(
      String indexName, Pair<String, String> fieldAndValue, Map<String, Object> lineagaData) {
    if (isClientAvailable) {
      UpdateByQueryRequest updateByQueryRequest = new UpdateByQueryRequest(indexName);
      updateByQueryRequest.setQuery(
          new MatchQueryBuilder(fieldAndValue.getKey(), fieldAndValue.getValue())
              .operator(Operator.AND));
      Map<String, Object> params = Collections.singletonMap("lineageData", lineagaData);
      Script script =
          new Script(ScriptType.INLINE, Script.DEFAULT_SCRIPT_LANG, ADD_UPDATE_LINEAGE, params);
      updateByQueryRequest.setScript(script);
      updateOpenSearchByQuery(updateByQueryRequest);
    }
  }

  @Override
  public void updateEntityRelationship(
      String indexName,
      Pair<String, String> fieldAndValue,
      Map<String, Object> entityRelationshipData) {
    if (isClientAvailable) {
      UpdateByQueryRequest updateByQueryRequest = new UpdateByQueryRequest(indexName);
      updateByQueryRequest.setQuery(
          new MatchQueryBuilder(fieldAndValue.getKey(), fieldAndValue.getValue())
              .operator(Operator.AND));
      Map<String, Object> params =
          Collections.singletonMap("entityRelationshipData", entityRelationshipData);
      Script script =
          new Script(
              ScriptType.INLINE,
              Script.DEFAULT_SCRIPT_LANG,
              ADD_UPDATE_ENTITY_RELATIONSHIP,
              params);
      updateByQueryRequest.setScript(script);
      updateOpenSearchByQuery(updateByQueryRequest);
    }
  }

  @SneakyThrows
  private void updateOpenSearchByQuery(UpdateByQueryRequest updateByQueryRequest) {
    if (updateByQueryRequest != null && isClientAvailable) {
      updateByQueryRequest.setRefresh(true);
      LOG.debug(SENDING_REQUEST_TO_ELASTIC_SEARCH, updateByQueryRequest);
      client.updateByQuery(updateByQueryRequest, RequestOptions.DEFAULT);
    }
  }

  @SneakyThrows
  public void updateOpenSearch(UpdateRequest updateRequest) {
    if (updateRequest != null && isClientAvailable) {
      updateRequest.setRefreshPolicy(WriteRequest.RefreshPolicy.IMMEDIATE);
      LOG.debug(SENDING_REQUEST_TO_ELASTIC_SEARCH, updateRequest);
      client.update(updateRequest, RequestOptions.DEFAULT);
    }
  }

  @SneakyThrows
  public void deleteByQuery(String index, String query) {
    DeleteByQueryRequest deleteRequest = new DeleteByQueryRequest(index);
    // Hack: Due to an issue on how the RangeQueryBuilder.fromXContent works, we're removing the
    // first token from the Parser
    XContentParser parser = createXContentParser(query);
    parser.nextToken();
    deleteRequest.setQuery(RangeQueryBuilder.fromXContent(parser));
    client.deleteByQuery(deleteRequest, RequestOptions.DEFAULT);
  }

  @SneakyThrows
  private void deleteEntityFromOpenSearch(DeleteRequest deleteRequest) {
    if (deleteRequest != null && isClientAvailable) {
      LOG.debug(SENDING_REQUEST_TO_ELASTIC_SEARCH, deleteRequest);
      client.delete(deleteRequest, RequestOptions.DEFAULT);
    }
  }

  @SneakyThrows
  private void deleteEntityFromOpenSearchByQuery(DeleteByQueryRequest deleteRequest) {
    if (deleteRequest != null && isClientAvailable) {
      deleteRequest.setRefresh(true);
      client.deleteByQuery(deleteRequest, RequestOptions.DEFAULT);
    }
  }

  /** */
  @Override
  public void close() {}

  @Override
  public BulkResponse bulk(BulkRequest data, RequestOptions options) throws IOException {
    return client.bulk(data, RequestOptions.DEFAULT);
  }

  @Override
  public Response listDataInsightChartResult(
      Long startTs,
      Long endTs,
      String tier,
      String team,
      DataInsightChartResult.DataInsightChartType dataInsightChartName,
      Integer size,
      Integer from,
      String queryFilter,
      String dataReportIndex)
      throws IOException {
    os.org.opensearch.action.search.SearchRequest searchRequest =
        buildSearchRequest(
            startTs,
            endTs,
            tier,
            team,
            dataInsightChartName,
            size,
            from,
            queryFilter,
            dataReportIndex);
    SearchResponse searchResponse = client.search(searchRequest, RequestOptions.DEFAULT);
    return Response.status(OK)
        .entity(processDataInsightChartResult(searchResponse, dataInsightChartName))
        .build();
  }

  private static DataInsightChartResult processDataInsightChartResult(
      SearchResponse searchResponse,
      DataInsightChartResult.DataInsightChartType dataInsightChartName) {
    DataInsightAggregatorInterface processor =
        createDataAggregator(searchResponse, dataInsightChartName);
    return processor.process(dataInsightChartName);
  }

  private static DataInsightAggregatorInterface createDataAggregator(
      SearchResponse aggregations, DataInsightChartResult.DataInsightChartType dataInsightChartType)
      throws IllegalArgumentException {
    return switch (dataInsightChartType) {
      case DAILY_ACTIVE_USERS -> new OpenSearchDailyActiveUsersAggregator(
          aggregations.getAggregations());
      case PAGE_VIEWS_BY_ENTITIES -> new OpenSearchPageViewsByEntitiesAggregator(
          aggregations.getAggregations());
      case MOST_ACTIVE_USERS -> new OpenSearchMostActiveUsersAggregator(
          aggregations.getAggregations());
      case MOST_VIEWED_ENTITIES -> new OpenSearchMostViewedEntitiesAggregator(
          aggregations.getAggregations());
      case UNUSED_ASSETS -> new OpenSearchUnusedAssetsAggregator(aggregations.getHits());
      case AGGREGATED_UNUSED_ASSETS_SIZE -> new OpenSearchAggregatedUnusedAssetsSizeAggregator(
          aggregations.getAggregations());
      case AGGREGATED_UNUSED_ASSETS_COUNT -> new OpenSearchAggregatedUnusedAssetsCountAggregator(
          aggregations.getAggregations());
      case AGGREGATED_USED_VS_UNUSED_ASSETS_COUNT -> new OpenSearchAggregatedUsedvsUnusedAssetsCountAggregator(
          aggregations.getAggregations());
      case AGGREGATED_USED_VS_UNUSED_ASSETS_SIZE -> new OpenSearchAggregatedUsedvsUnusedAssetsSizeAggregator(
          aggregations.getAggregations());
    };
  }

  private static os.org.opensearch.action.search.SearchRequest buildSearchRequest(
      Long startTs,
      Long endTs,
      String tier,
      String team,
      DataInsightChartResult.DataInsightChartType dataInsightChartName,
      Integer size,
      Integer from,
      String queryFilter,
      String dataReportIndex) {
    SearchSourceBuilder searchSourceBuilder =
        buildQueryFilter(startTs, endTs, tier, team, queryFilter, dataInsightChartName.value());
    if (!dataInsightChartName
        .toString()
        .equalsIgnoreCase(DataInsightChartResult.DataInsightChartType.UNUSED_ASSETS.toString())) {
      AggregationBuilder aggregationBuilder = buildQueryAggregation(dataInsightChartName);
      searchSourceBuilder.aggregation(aggregationBuilder);
      searchSourceBuilder.timeout(new TimeValue(30, TimeUnit.SECONDS));
    } else {
      searchSourceBuilder.fetchSource(true);
      searchSourceBuilder.from(from);
      searchSourceBuilder.size(size);
      searchSourceBuilder.sort("data.lifeCycle.accessed.timestamp", SortOrder.DESC);
    }

    os.org.opensearch.action.search.SearchRequest searchRequest =
        new os.org.opensearch.action.search.SearchRequest(
            Entity.getSearchRepository().getIndexOrAliasName(dataReportIndex));
    searchRequest.source(searchSourceBuilder);
    return searchRequest;
  }

  private static SearchSourceBuilder buildQueryFilter(
      Long startTs,
      Long endTs,
      String tier,
      String team,
      String queryFilter,
      String dataInsightChartName) {

    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    BoolQueryBuilder searchQueryFiler = new BoolQueryBuilder();

    if (team != null
        && DataInsightChartRepository.SUPPORTS_TEAM_FILTER.contains(dataInsightChartName)) {
      List<String> teamArray = Arrays.asList(team.split("\\s*,\\s*"));

      BoolQueryBuilder teamQueryFilter = QueryBuilders.boolQuery();
      teamQueryFilter.should(
          QueryBuilders.termsQuery(DataInsightChartRepository.DATA_TEAM, teamArray));
      searchQueryFiler.must(teamQueryFilter);
    }

    if (tier != null
        && DataInsightChartRepository.SUPPORTS_TIER_FILTER.contains(dataInsightChartName)) {
      List<String> tierArray = Arrays.asList(tier.split("\\s*,\\s*"));

      BoolQueryBuilder tierQueryFilter = QueryBuilders.boolQuery();
      tierQueryFilter.should(
          QueryBuilders.termsQuery(DataInsightChartRepository.DATA_ENTITY_TIER, tierArray));
      searchQueryFiler.must(tierQueryFilter);
    }

    if (!DataInsightChartRepository.SUPPORTS_NULL_DATE_RANGE.contains(dataInsightChartName)) {
      if (startTs == null || endTs == null) {
        throw new IllegalArgumentException(
            String.format(
                "Start and End date are required for chart type %s ", dataInsightChartName));
      }
      RangeQueryBuilder dateQueryFilter =
          QueryBuilders.rangeQuery(DataInsightChartRepository.TIMESTAMP).gte(startTs).lte(endTs);
      searchQueryFiler.must(dateQueryFilter);
    }

    searchSourceBuilder.query(searchQueryFiler).fetchSource(false);

    buildSearchSourceFilter(queryFilter, searchSourceBuilder);

    return searchSourceBuilder;
  }

  @Override
  public List<Map<String, String>> fetchDIChartFields() {
    List<Map<String, String>> fields = new ArrayList<>();
    for (String type : DataInsightSystemChartRepository.dataAssetTypes) {
      // This function is being used for creating custom charts in Data Insights
      try {
        GetMappingsRequest request =
            new GetMappingsRequest()
                .indices(
                    DataInsightSystemChartRepository.DI_SEARCH_INDEX_PREFIX
                        + "-"
                        + type.toLowerCase());

        // Execute request
        GetMappingsResponse response = client.indices().getMapping(request, RequestOptions.DEFAULT);

        // Get mappings for the index
        for (Map.Entry<String, MappingMetadata> entry : response.mappings().entrySet()) {
          // Get fields for the index
          Map<String, Object> indexFields = entry.getValue().sourceAsMap();
          getFieldNames((Map<String, Object>) indexFields.get("properties"), "", fields, type);
        }
      } catch (Exception exception) {
        LOG.error(exception.getMessage());
      }
    }
    return fields;
  }

  void getFieldNames(
      @NotNull Map<String, Object> fields,
      String prefix,
      List<Map<String, String>> fieldList,
      String entityType) {
    for (Map.Entry<String, Object> entry : fields.entrySet()) {
      String postfix = "";
      String type = (String) ((Map<String, Object>) entry.getValue()).get("type");
      if (type != null && type.equals("text")) {
        postfix = ".keyword";
      }

      String fieldName = prefix + entry.getKey() + postfix;
      String fieldNameOriginal = WordUtils.capitalize((prefix + entry.getKey()).replace(".", " "));

      if (entry.getValue() instanceof Map) {
        Map<String, Object> subFields = (Map<String, Object>) entry.getValue();
        if (subFields.containsKey("properties")) {
          getFieldNames(
              (Map<String, Object>) subFields.get("properties"),
              fieldName + ".",
              fieldList,
              entityType);
        } else {
          if (fieldList.stream().noneMatch(e -> e.get("name").equals(fieldName))) {
            Map<String, String> map = new HashMap<>();
            map.put("name", fieldName);
            map.put("displayName", fieldNameOriginal);
            map.put("type", type);
            map.put("entityType", entityType);
            fieldList.add(map);
          }
        }
      }
    }
  }

  public DataInsightCustomChartResultList buildDIChart(
      @NotNull DataInsightCustomChart diChart, long start, long end) throws IOException {
    OpenSearchDynamicChartAggregatorInterface aggregator =
        OpenSearchDynamicChartAggregatorFactory.getAggregator(diChart);
    if (aggregator != null) {
      List<FormulaHolder> formulas = new ArrayList<>();
      Map<String, OpenSearchLineChartAggregator.MetricFormulaHolder> metricFormulaHolder =
          new HashMap<>();
      os.org.opensearch.action.search.SearchRequest searchRequest =
          aggregator.prepareSearchRequest(diChart, start, end, formulas, metricFormulaHolder);
      SearchResponse searchResponse = client.search(searchRequest, RequestOptions.DEFAULT);
      return aggregator.processSearchResponse(
          diChart, searchResponse, formulas, metricFormulaHolder);
    }
    return null;
  }

  private static AggregationBuilder buildQueryAggregation(
      DataInsightChartResult.DataInsightChartType dataInsightChartName)
      throws IllegalArgumentException {
    DateHistogramAggregationBuilder dateHistogramAggregationBuilder =
        AggregationBuilders.dateHistogram(DataInsightChartRepository.TIMESTAMP)
            .field(DataInsightChartRepository.TIMESTAMP)
            .calendarInterval(DateHistogramInterval.DAY);

    TermsAggregationBuilder termsAggregationBuilder;
    SumAggregationBuilder sumAggregationBuilder;
    SumAggregationBuilder sumEntityCountAggregationBuilder =
        AggregationBuilders.sum(DataInsightChartRepository.ENTITY_COUNT)
            .field(DataInsightChartRepository.DATA_ENTITY_COUNT);

    switch (dataInsightChartName) {
      case AGGREGATED_UNUSED_ASSETS_COUNT, AGGREGATED_UNUSED_ASSETS_SIZE:
        boolean isSize =
            dataInsightChartName.equals(
                DataInsightChartResult.DataInsightChartType.AGGREGATED_UNUSED_ASSETS_SIZE);
        String fieldType = isSize ? "size" : "count";
        String totalField = isSize ? "totalSize" : "totalCount";
        SumAggregationBuilder threeDaysAgg =
            AggregationBuilders.sum("threeDays")
                .field(String.format("data.unusedDataAssets.%s.threeDays", fieldType));
        SumAggregationBuilder sevenDaysAgg =
            AggregationBuilders.sum("sevenDays")
                .field(String.format("data.unusedDataAssets.%s.sevenDays", fieldType));
        SumAggregationBuilder fourteenDaysAgg =
            AggregationBuilders.sum("fourteenDays")
                .field(String.format("data.unusedDataAssets.%s.fourteenDays", fieldType));
        SumAggregationBuilder thirtyDaysAgg =
            AggregationBuilders.sum("thirtyDays")
                .field(String.format("data.unusedDataAssets.%s.thirtyDays", fieldType));
        SumAggregationBuilder sixtyDaysAgg =
            AggregationBuilders.sum("sixtyDays")
                .field(String.format("data.unusedDataAssets.%s.sixtyDays", fieldType));
        SumAggregationBuilder totalUnused =
            AggregationBuilders.sum("totalUnused")
                .field(String.format("data.unusedDataAssets.%s", totalField));
        SumAggregationBuilder totalUsed =
            AggregationBuilders.sum("totalUsed")
                .field(String.format("data.unusedDataAssets.%s", totalField));
        return dateHistogramAggregationBuilder
            .subAggregation(threeDaysAgg)
            .subAggregation(sevenDaysAgg)
            .subAggregation(fourteenDaysAgg)
            .subAggregation(thirtyDaysAgg)
            .subAggregation(sixtyDaysAgg)
            .subAggregation(totalUnused)
            .subAggregation(totalUsed);
      case AGGREGATED_USED_VS_UNUSED_ASSETS_SIZE, AGGREGATED_USED_VS_UNUSED_ASSETS_COUNT:
        boolean isSizeReport =
            dataInsightChartName.equals(
                DataInsightChartResult.DataInsightChartType.AGGREGATED_USED_VS_UNUSED_ASSETS_SIZE);
        String totalFieldString = isSizeReport ? "totalSize" : "totalCount";
        SumAggregationBuilder totalUnusedAssets =
            AggregationBuilders.sum("totalUnused")
                .field(String.format("data.unusedDataAssets.%s", totalFieldString));
        SumAggregationBuilder totalUsedAssets =
            AggregationBuilders.sum("totalUsed")
                .field(String.format("data.frequentlyUsedDataAssets.%s", totalFieldString));
        return dateHistogramAggregationBuilder
            .subAggregation(totalUnusedAssets)
            .subAggregation(totalUsedAssets);
      case DAILY_ACTIVE_USERS:
        return dateHistogramAggregationBuilder;
      case PAGE_VIEWS_BY_ENTITIES:
        termsAggregationBuilder =
            AggregationBuilders.terms(DataInsightChartRepository.ENTITY_TYPE)
                .field(DataInsightChartRepository.DATA_ENTITY_TYPE)
                .size(1000);
        SumAggregationBuilder sumPageViewsByEntityTypes =
            AggregationBuilders.sum(DataInsightChartRepository.PAGE_VIEWS)
                .field(DataInsightChartRepository.DATA_VIEWS);
        return dateHistogramAggregationBuilder.subAggregation(
            termsAggregationBuilder.subAggregation(sumPageViewsByEntityTypes));
      case MOST_VIEWED_ENTITIES:
        termsAggregationBuilder =
            AggregationBuilders.terms(DataInsightChartRepository.ENTITY_FQN)
                .field(DataInsightChartRepository.DATA_ENTITY_FQN)
                .size(10)
                .order(BucketOrder.aggregation(DataInsightChartRepository.PAGE_VIEWS, false));

        TermsAggregationBuilder ownerTermsAggregationBuilder =
            AggregationBuilders.terms(DataInsightChartRepository.OWNER)
                .field(DataInsightChartRepository.DATA_OWNER);
        TermsAggregationBuilder entityTypeTermsAggregationBuilder =
            AggregationBuilders.terms(DataInsightChartRepository.ENTITY_TYPE)
                .field(DataInsightChartRepository.DATA_ENTITY_TYPE);
        TermsAggregationBuilder entityHrefAggregationBuilder =
            AggregationBuilders.terms(DataInsightChartRepository.ENTITY_HREF)
                .field(DataInsightChartRepository.DATA_ENTITY_HREF);
        SumAggregationBuilder sumEntityPageViewsAggregationBuilder =
            AggregationBuilders.sum(DataInsightChartRepository.PAGE_VIEWS)
                .field(DataInsightChartRepository.DATA_VIEWS);

        return termsAggregationBuilder
            .subAggregation(sumEntityPageViewsAggregationBuilder)
            .subAggregation(ownerTermsAggregationBuilder)
            .subAggregation(entityTypeTermsAggregationBuilder)
            .subAggregation(entityHrefAggregationBuilder);
      case MOST_ACTIVE_USERS:
        termsAggregationBuilder =
            AggregationBuilders.terms(DataInsightChartRepository.USER_NAME)
                .field(DataInsightChartRepository.DATA_USER_NAME)
                .size(10)
                .order(BucketOrder.aggregation(DataInsightChartRepository.SESSIONS, false));
        TermsAggregationBuilder teamTermsAggregationBuilder =
            AggregationBuilders.terms(DataInsightChartRepository.TEAM)
                .field(DataInsightChartRepository.DATA_TEAM);
        SumAggregationBuilder sumSessionAggregationBuilder =
            AggregationBuilders.sum(DataInsightChartRepository.SESSIONS)
                .field(DataInsightChartRepository.DATA_SESSIONS);
        SumAggregationBuilder sumUserPageViewsAggregationBuilder =
            AggregationBuilders.sum(DataInsightChartRepository.PAGE_VIEWS)
                .field(DataInsightChartRepository.DATA_PAGE_VIEWS);
        MaxAggregationBuilder lastSessionAggregationBuilder =
            AggregationBuilders.max(DataInsightChartRepository.LAST_SESSION)
                .field(DataInsightChartRepository.DATA_LAST_SESSION);
        SumAggregationBuilder sumSessionDurationAggregationBuilder =
            AggregationBuilders.sum(DataInsightChartRepository.SESSION_DURATION)
                .field(DataInsightChartRepository.DATA_TOTAL_SESSION_DURATION);
        return termsAggregationBuilder
            .subAggregation(sumSessionAggregationBuilder)
            .subAggregation(sumUserPageViewsAggregationBuilder)
            .subAggregation(lastSessionAggregationBuilder)
            .subAggregation(sumSessionDurationAggregationBuilder)
            .subAggregation(teamTermsAggregationBuilder);
      default:
        throw new IllegalArgumentException(
            String.format("Invalid dataInsightChartType name %s", dataInsightChartName));
    }
  }

  public RestHighLevelClient createOpenSearchClient(ElasticSearchConfiguration esConfig) {
    if (esConfig != null) {
      try {
        RestClientBuilder restClientBuilder =
            RestClient.builder(
                new HttpHost(esConfig.getHost(), esConfig.getPort(), esConfig.getScheme()));
        if (StringUtils.isNotEmpty(esConfig.getUsername())
            && StringUtils.isNotEmpty(esConfig.getPassword())) {
          CredentialsProvider credentialsProvider = new BasicCredentialsProvider();
          credentialsProvider.setCredentials(
              AuthScope.ANY,
              new UsernamePasswordCredentials(esConfig.getUsername(), esConfig.getPassword()));
          SSLContext sslContext = createElasticSearchSSLContext(esConfig);
          restClientBuilder.setHttpClientConfigCallback(
              httpAsyncClientBuilder -> {
                httpAsyncClientBuilder.setDefaultCredentialsProvider(credentialsProvider);
                if (sslContext != null) {
                  httpAsyncClientBuilder.setSSLContext(sslContext);
                }
                return httpAsyncClientBuilder;
              });
        }
        restClientBuilder.setRequestConfigCallback(
            requestConfigBuilder ->
                requestConfigBuilder
                    .setConnectTimeout(esConfig.getConnectionTimeoutSecs() * 1000)
                    .setSocketTimeout(esConfig.getSocketTimeoutSecs() * 1000));
        restClientBuilder.setCompressionEnabled(true);
        restClientBuilder.setChunkedEnabled(true);
        return new RestHighLevelClient(restClientBuilder);
      } catch (Exception e) {
        LOG.error("Failed to create open search client ", e);
        return null;
      }
    } else {
      return null;
    }
  }

  private static SearchSourceBuilder getSearchSourceBuilder(
      String index, String q, int from, int size) {
    return switch (Entity.getSearchRepository().getIndexNameWithoutAlias(index)) {
      case "topic_search_index", "topic" -> buildTopicSearchBuilder(q, from, size);
      case "dashboard_search_index", "dashboard" -> buildDashboardSearchBuilder(q, from, size);
      case "pipeline_search_index", "pipeline" -> buildPipelineSearchBuilder(q, from, size);
      case "mlmodel_search_index", "mlmodel" -> buildMlModelSearchBuilder(q, from, size);
      case "table_search_index", "table" -> buildTableSearchBuilder(q, from, size);
      case "database_schema_search_index",
          "databaseSchema",
          "database_search_index",
          "database" -> buildGenericDataAssetSearchBuilder(q, from, size);
      case "user_search_index", "user", "team_search_index", "team" -> buildUserOrTeamSearchBuilder(
          q, from, size);
      case "glossary_term_search_index", "glossaryTerm" -> buildGlossaryTermSearchBuilder(
          q, from, size);
      case "tag_search_index", "tag" -> buildTagSearchBuilder(q, from, size);
      case "container_search_index", "container" -> buildContainerSearchBuilder(q, from, size);
      case "query_search_index", "query" -> buildQuerySearchBuilder(q, from, size);
      case "test_case_search_index",
          "testCase",
          "test_suite_search_index",
          "testSuite" -> buildTestCaseSearch(q, from, size);
      case "stored_procedure_search_index", "storedProcedure" -> buildStoredProcedureSearch(
          q, from, size);
      case "dashboard_data_model_search_index",
          "dashboardDataModel" -> buildDashboardDataModelsSearch(q, from, size);
      case "domain_search_index", "domain" -> buildDomainsSearch(q, from, size);
      case "search_entity_search_index", "searchIndex" -> buildSearchEntitySearch(q, from, size);
      case "raw_cost_analysis_report_data_index",
          "aggregated_cost_analysis_report_data_index" -> buildCostAnalysisReportDataSearch(
          q, from, size);
      case "data_product_search_index" -> buildDataProductSearch(q, from, size);
      case "test_case_resolution_status_search_index" -> buildTestCaseResolutionStatusSearch(
          q, from, size);
      case "test_case_result_search_index" -> buildTestCaseResultSearch(q, from, size);
      case "api_endpoint_search_index", "apiEndpoint" -> buildApiEndpointSearch(q, from, size);
      case "api_service_search_index",
          "mlmodel_service_search_index",
          "database_service_search_index",
          "messaging_service_index",
          "dashboard_service_index",
          "pipeline_service_index",
          "storage_service_index",
          "search_service_index",
          "metadata_service_index" -> buildServiceSearchBuilder(q, from, size);
      case "dataAsset" -> buildDataAssetsSearchBuilder(q, from, size);
      case "all" -> buildSearchAcrossIndexesBuilder(q, from, size);
      default -> buildAggregateSearchBuilder(q, from, size);
    };
  }

  private XContentParser createXContentParser(String query) throws IOException {
    try {
      return XContentType.JSON
          .xContent()
          .createParser(X_CONTENT_REGISTRY, LoggingDeprecationHandler.INSTANCE, query);
    } catch (IOException e) {
      LOG.error("Failed to create XContentParser", e);
      throw e;
    }
  }

  private void getSearchFilter(
      String filter, SearchSourceBuilder searchSourceBuilder, boolean hasQuery) throws IOException {
    if (!filter.isEmpty()) {
      try {
        XContentParser queryParser = createXContentParser(filter);
        XContentParser sourceParser = createXContentParser(filter);
        QueryBuilder queryFromXContent = SearchSourceBuilder.fromXContent(queryParser).query();
        FetchSourceContext sourceFromXContent =
            SearchSourceBuilder.fromXContent(sourceParser).fetchSource();
        BoolQueryBuilder boolQuery = QueryBuilders.boolQuery();
        boolQuery =
            !hasQuery
                ? boolQuery.filter(queryFromXContent)
                : boolQuery.must(searchSourceBuilder.query()).filter(queryFromXContent);
        searchSourceBuilder.query(boolQuery);
        searchSourceBuilder.fetchSource(sourceFromXContent);
      } catch (Exception e) {
        throw new IOException("Failed to parse query filter: %s", e);
      }
    }
  }

  public Object getLowLevelClient() {
    return client.getLowLevelClient();
  }

  private void buildSearchRBACQuery(
      SubjectContext subjectContext, SearchSourceBuilder searchSourceBuilder) {
    if (SearchClient.shouldApplyRbacConditions(subjectContext, rbacConditionEvaluator)) {
      OMQueryBuilder rbacQuery = rbacConditionEvaluator.evaluateConditions(subjectContext);
      if (rbacQuery != null) {
        searchSourceBuilder.query(
            QueryBuilders.boolQuery()
                .must(searchSourceBuilder.query())
                .filter(((OpenSearchQueryBuilder) rbacQuery).build()));
      }
    }
  }

  private static void buildSearchSourceFilter(
      String queryFilter, SearchSourceBuilder searchSourceBuilder) {
    if (!nullOrEmpty(queryFilter) && !queryFilter.equals("{}")) {
      try {
        XContentParser filterParser =
            XContentType.JSON
                .xContent()
                .createParser(X_CONTENT_REGISTRY, LoggingDeprecationHandler.INSTANCE, queryFilter);
        QueryBuilder filter = SearchSourceBuilder.fromXContent(filterParser).query();
        BoolQueryBuilder newQuery =
            QueryBuilders.boolQuery().must(searchSourceBuilder.query()).filter(filter);
        searchSourceBuilder.query(newQuery);
      } catch (Exception ex) {
        LOG.warn("Error parsing query_filter from query parameters, ignoring filter", ex);
      }
    }
  }
}
