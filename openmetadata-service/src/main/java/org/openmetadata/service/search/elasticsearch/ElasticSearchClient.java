package org.openmetadata.service.search.elasticsearch;

import static jakarta.ws.rs.core.Response.Status.OK;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.DOMAIN;
import static org.openmetadata.service.Entity.GLOSSARY_TERM;
import static org.openmetadata.service.Entity.TABLE;
import static org.openmetadata.service.search.EntityBuilderConstant.MAX_RESULT_HITS;
import static org.openmetadata.service.search.SearchUtils.createElasticSearchSSLContext;
import static org.openmetadata.service.search.SearchUtils.getEntityRelationshipDirection;
import static org.openmetadata.service.search.SearchUtils.getRelationshipRef;
import static org.openmetadata.service.search.SearchUtils.shouldApplyRbacConditions;
import static org.openmetadata.service.util.FullyQualifiedName.getParentFQN;

import com.fasterxml.jackson.databind.JsonNode;
import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.elasticsearch.cluster.ClusterStatsResponse;
import es.co.elastic.clients.elasticsearch.cluster.GetClusterSettingsResponse;
import es.co.elastic.clients.elasticsearch.nodes.NodesStatsResponse;
import es.co.elastic.clients.json.jackson.JacksonJsonpMapper;
import es.co.elastic.clients.transport.rest_client.RestClientTransport;
import es.org.elasticsearch.ElasticsearchStatusException;
import es.org.elasticsearch.action.bulk.BulkRequest;
import es.org.elasticsearch.action.bulk.BulkResponse;
import es.org.elasticsearch.action.search.SearchResponse;
import es.org.elasticsearch.client.Request;
import es.org.elasticsearch.client.RequestOptions;
import es.org.elasticsearch.client.RestClient;
import es.org.elasticsearch.client.RestClientBuilder;
import es.org.elasticsearch.client.RestHighLevelClient;
import es.org.elasticsearch.client.RestHighLevelClientBuilder;
import es.org.elasticsearch.common.ParsingException;
import es.org.elasticsearch.common.xcontent.LoggingDeprecationHandler;
import es.org.elasticsearch.core.TimeValue;
import es.org.elasticsearch.index.query.BoolQueryBuilder;
import es.org.elasticsearch.index.query.QueryBuilder;
import es.org.elasticsearch.index.query.QueryBuilders;
import es.org.elasticsearch.index.query.QueryStringQueryBuilder;
import es.org.elasticsearch.rest.RestStatus;
import es.org.elasticsearch.search.SearchHit;
import es.org.elasticsearch.search.SearchHits;
import es.org.elasticsearch.search.aggregations.AggregationBuilders;
import es.org.elasticsearch.search.aggregations.BucketOrder;
import es.org.elasticsearch.search.aggregations.bucket.terms.IncludeExclude;
import es.org.elasticsearch.search.aggregations.bucket.terms.Terms;
import es.org.elasticsearch.search.aggregations.bucket.terms.TermsAggregationBuilder;
import es.org.elasticsearch.search.aggregations.metrics.TopHitsAggregationBuilder;
import es.org.elasticsearch.search.builder.SearchSourceBuilder;
import es.org.elasticsearch.search.fetch.subphase.FetchSourceContext;
import es.org.elasticsearch.search.sort.FieldSortBuilder;
import es.org.elasticsearch.search.sort.NestedSortBuilder;
import es.org.elasticsearch.search.sort.SortBuilders;
import es.org.elasticsearch.search.sort.SortMode;
import es.org.elasticsearch.search.sort.SortOrder;
import es.org.elasticsearch.xcontent.NamedXContentRegistry;
import es.org.elasticsearch.xcontent.XContentLocation;
import es.org.elasticsearch.xcontent.XContentParser;
import es.org.elasticsearch.xcontent.XContentType;
import jakarta.json.JsonObject;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.security.KeyStoreException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import javax.net.ssl.SSLContext;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.apache.commons.lang3.tuple.Pair;
import org.apache.http.Header;
import org.apache.http.HttpHeaders;
import org.apache.http.HttpHost;
import org.apache.http.auth.AuthScope;
import org.apache.http.auth.UsernamePasswordCredentials;
import org.apache.http.client.CredentialsProvider;
import org.apache.http.impl.client.BasicCredentialsProvider;
import org.apache.http.message.BasicHeader;
import org.apache.http.util.EntityUtils;
import org.jetbrains.annotations.NotNull;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.entityRelationship.SearchEntityRelationshipRequest;
import org.openmetadata.schema.api.entityRelationship.SearchEntityRelationshipResult;
import org.openmetadata.schema.api.entityRelationship.SearchSchemaEntityRelationshipResult;
import org.openmetadata.schema.api.lineage.EntityCountLineageRequest;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.api.lineage.LineagePaginationInfo;
import org.openmetadata.schema.api.lineage.SearchLineageRequest;
import org.openmetadata.schema.api.lineage.SearchLineageResult;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.dataInsight.DataInsightChartResult;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChartResultList;
import org.openmetadata.schema.entity.data.EntityHierarchy;
import org.openmetadata.schema.entity.data.QueryCostSearchResult;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.search.AggregationRequest;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.schema.search.TopHits;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.tests.DataQualityReport;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.LayerPaging;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exception.SearchException;
import org.openmetadata.sdk.exception.SearchIndexNotFoundException;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.jdbi3.TestCaseResultRepository;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.search.SearchAggregation;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchHealthStatus;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.SearchResultListMapper;
import org.openmetadata.service.search.SearchSortFilter;
import org.openmetadata.service.search.elasticsearch.aggregations.ElasticAggregations;
import org.openmetadata.service.search.elasticsearch.aggregations.ElasticAggregationsBuilder;
import org.openmetadata.service.search.elasticsearch.queries.ElasticQueryBuilder;
import org.openmetadata.service.search.elasticsearch.queries.ElasticQueryBuilderFactory;
import org.openmetadata.service.search.nlq.NLQService;
import org.openmetadata.service.search.queries.OMQueryBuilder;
import org.openmetadata.service.search.queries.QueryBuilderFactory;
import org.openmetadata.service.search.security.RBACConditionEvaluator;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.workflows.searchIndex.ReindexingUtil;

@Slf4j
public class ElasticSearchClient implements SearchClient<RestHighLevelClient> {

  @SuppressWarnings("deprecated")
  @Getter
  protected final RestHighLevelClient client;

  // New Java API client support for migration
  @Getter protected final ElasticsearchClient newClient;

  private final RBACConditionEvaluator rbacConditionEvaluator;
  private final QueryBuilderFactory queryBuilderFactory;

  private final boolean isClientAvailable;

  private final boolean isNewClientAvailable;

  private final String clusterAlias;

  private final ESLineageGraphBuilder lineageGraphBuilder;
  private final ESEntityRelationshipGraphBuilder entityRelationshipGraphBuilder;
  private final ElasticSearchIndexManager indexManager;
  private final ElasticSearchEntityManager entityManager;
  private final ElasticSearchGenericManager genericManager;
  private final ElasticSearchDataInsightAggregatorManager dataInsightAggregatorManager;

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

  public static final List<String> SOURCE_FIELDS_TO_EXCLUDE =
      Stream.concat(
              FIELDS_TO_REMOVE.stream(),
              Stream.of("schemaDefinition", "customMetrics", "embedding"))
          .toList();

  private static final Header[] defaultHeaders =
      new Header[] {
        new BasicHeader(
            HttpHeaders.ACCEPT, "application/vnd.elasticsearch+json; compatible-with=7"),
        new BasicHeader(
            HttpHeaders.CONTENT_TYPE, "application/vnd.elasticsearch+json; compatible-with=7")
      };

  // Add this field to the class
  private NLQService nlqService;

  public ElasticSearchClient(ElasticSearchConfiguration config) {
    RestClient lowLevelClient = getLowLevelRestClient(config);
    this.client = createElasticSearchLegacyClient(lowLevelClient);
    this.newClient = createElasticSearchNewClient(lowLevelClient);
    clusterAlias = config != null ? config.getClusterAlias() : "";
    isClientAvailable = client != null;
    isNewClientAvailable = newClient != null;
    queryBuilderFactory = new ElasticQueryBuilderFactory();
    rbacConditionEvaluator = new RBACConditionEvaluator(queryBuilderFactory);
    lineageGraphBuilder = new ESLineageGraphBuilder(newClient);
    entityRelationshipGraphBuilder = new ESEntityRelationshipGraphBuilder(newClient);
    indexManager = new ElasticSearchIndexManager(newClient, clusterAlias);
    entityManager = new ElasticSearchEntityManager(newClient);
    genericManager = new ElasticSearchGenericManager(newClient);
    dataInsightAggregatorManager = new ElasticSearchDataInsightAggregatorManager(newClient);
    nlqService = null;
  }

  // Update the constructor to accept NLQService
  public ElasticSearchClient(ElasticSearchConfiguration config, NLQService nlqService) {
    this(config);
    this.nlqService = nlqService;
  }

  private ElasticsearchClient createElasticSearchNewClient(RestClient lowLevelClient) {
    try {
      // Create transport and new client
      RestClientTransport transport =
          new RestClientTransport(lowLevelClient, new JacksonJsonpMapper());
      ElasticsearchClient newClient = new ElasticsearchClient(transport);

      LOG.info("Successfully initialized new Elasticsearch Java API client");
      return newClient;
    } catch (Exception e) {
      LOG.error("Failed to initialize new Elasticsearch client", e);
      return null;
    }
  }

  @Override
  public boolean isClientAvailable() {
    return isClientAvailable;
  }

  @Override
  public boolean isNewClientAvailable() {
    return isNewClientAvailable;
  }

  @Override
  public boolean indexExists(String indexName) {
    return indexManager.indexExists(indexName);
  }

  @Override
  public void createIndex(IndexMapping indexMapping, String indexMappingContent) {
    indexManager.createIndex(indexMapping, indexMappingContent);
  }

  @Override
  public void addIndexAlias(IndexMapping indexMapping, String... aliasNames) {
    indexManager.addIndexAlias(indexMapping, aliasNames);
  }

  @Override
  public void createAliases(IndexMapping indexMapping) {
    indexManager.createAliases(indexMapping);
  }

  @Override
  public void createIndex(String indexName, String indexMappingContent) {
    indexManager.createIndex(indexName, indexMappingContent);
  }

  @Override
  public void deleteIndex(String indexName) {
    indexManager.deleteIndex(indexName);
  }

  @Override
  public Set<String> getAliases(String indexName) {
    return indexManager.getAliases(indexName);
  }

  @Override
  public void addAliases(String indexName, Set<String> aliases) {
    indexManager.addAliases(indexName, aliases);
  }

  @Override
  public void removeAliases(String indexName, Set<String> aliases) {
    indexManager.removeAliases(indexName, aliases);
  }

  @Override
  public Set<String> getIndicesByAlias(String aliasName) {
    return indexManager.getIndicesByAlias(aliasName);
  }

  @Override
  public Set<String> listIndicesByPrefix(String prefix) {
    return indexManager.listIndicesByPrefix(prefix);
  }

  @Override
  public void updateIndex(IndexMapping indexMapping, String indexMappingContent) {
    indexManager.updateIndex(indexMapping, indexMappingContent);
  }

  @Override
  public void deleteIndex(IndexMapping indexMapping) {
    indexManager.deleteIndex(indexMapping);
  }

  @Override
  public Response search(SearchRequest request, SubjectContext subjectContext) throws IOException {
    SearchSettings searchSettings =
        SettingsCache.getSetting(SettingsType.SEARCH_SETTINGS, SearchSettings.class);
    return doSearch(request, subjectContext, searchSettings);
  }

  @Override
  public Response previewSearch(
      SearchRequest request, SubjectContext subjectContext, SearchSettings searchSettings)
      throws IOException {
    return doSearch(request, subjectContext, searchSettings);
  }

  public Response doSearch(
      SearchRequest request, SubjectContext subjectContext, SearchSettings searchSettings)
      throws IOException {
    String indexName = Entity.getSearchRepository().getIndexNameWithoutAlias(request.getIndex());
    ElasticSearchSourceBuilderFactory searchBuilderFactory =
        new ElasticSearchSourceBuilderFactory(searchSettings);
    SearchSourceBuilder searchSourceBuilder =
        searchBuilderFactory.getSearchSourceBuilder(
            request.getIndex(),
            request.getQuery(),
            request.getFrom(),
            request.getSize(),
            request.getExplain());

    buildSearchRBACQuery(subjectContext, searchSourceBuilder);
    // Add Filter
    buildSearchSourceFilter(request.getQueryFilter(), searchSourceBuilder);

    // Log the actual query being sent to Elasticsearch
    LOG.debug(
        "Elasticsearch query for index '{}' with sanitized query '{}': {}",
        request.getIndex(),
        request.getQuery(),
        searchSourceBuilder.toString());

    if (!nullOrEmpty(request.getPostFilter())) {
      try {
        XContentParser filterParser =
            XContentType.JSON
                .xContent()
                .createParser(
                    EsUtils.esXContentRegistry,
                    LoggingDeprecationHandler.INSTANCE,
                    request.getPostFilter());
        QueryBuilder filter = SearchSourceBuilder.fromXContent(filterParser).query();
        searchSourceBuilder.postFilter(filter);
      } catch (Exception ex) {
        LOG.warn("Error parsing post_filter from query parameters, ignoring filter", ex);
      }
    }

    if (!nullOrEmpty(request.getSearchAfter())) {
      searchSourceBuilder.searchAfter(request.getSearchAfter().toArray());
    }

    /* For backward-compatibility we continue supporting the deleted argument, this should be removed in future versions */
    if (!nullOrEmpty(request.getDeleted())) {
      if (indexName.equals(GLOBAL_SEARCH_ALIAS) || indexName.equals(DATA_ASSET_SEARCH_ALIAS)) {
        BoolQueryBuilder boolQueryBuilder = QueryBuilders.boolQuery();

        boolQueryBuilder.should(
            QueryBuilders.boolQuery()
                .must(searchSourceBuilder.query())
                .must(QueryBuilders.existsQuery("deleted"))
                .must(QueryBuilders.termQuery("deleted", request.getDeleted())));
        boolQueryBuilder.should(
            QueryBuilders.boolQuery()
                .must(searchSourceBuilder.query())
                .mustNot(QueryBuilders.existsQuery("deleted")));
        searchSourceBuilder.query(boolQueryBuilder);
      } else {
        searchSourceBuilder.query(
            QueryBuilders.boolQuery()
                .must(searchSourceBuilder.query())
                .must(QueryBuilders.termQuery("deleted", request.getDeleted())));
      }
    }

    if (!nullOrEmpty(request.getSortFieldParam()) && !request.getIsHierarchy()) {
      FieldSortBuilder fieldSortBuilder =
          new FieldSortBuilder(request.getSortFieldParam())
              .order(SortOrder.fromString(request.getSortOrder()));
      // Score is an internal ES Field
      if (!request.getSortFieldParam().equalsIgnoreCase("_score")) {
        fieldSortBuilder.unmappedType("integer");
      }
      searchSourceBuilder.sort(fieldSortBuilder);

      // Add tiebreaker sort for stable pagination when sorting by score
      // This ensures consistent ordering when multiple documents have identical scores
      if (request.getSortFieldParam().equalsIgnoreCase("_score")) {
        searchSourceBuilder.sort(
            SortBuilders.fieldSort("name.keyword").order(SortOrder.ASC).unmappedType("keyword"));
      }
    }

    buildHierarchyQuery(request, searchSourceBuilder, client);

    /* for performance reasons ElasticSearch doesn't provide accurate hits
    if we enable trackTotalHits parameter it will try to match every result, count and return hits
    however in most cases for search results an approximate value is good enough.
    we are displaying total entity counts in landing page and explore page where we need the total count
    https://github.com/elastic/elasticsearch/issues/33028 */
    searchSourceBuilder.fetchSource(
        new FetchSourceContext(
            request.getFetchSource(),
            request.getIncludeSourceFields().toArray(String[]::new),
            request.getExcludeSourceFields().toArray(String[]::new)));

    if (request.getTrackTotalHits()) {
      searchSourceBuilder.trackTotalHits(true);
    } else {
      searchSourceBuilder.trackTotalHitsUpTo(MAX_RESULT_HITS);
    }

    searchSourceBuilder.timeout(new TimeValue(30, TimeUnit.SECONDS));

    LOG.debug("Executing search on index: {}, query: {}", request.getIndex(), request.getQuery());
    LOG.debug("SearchSourceBuilder query: {}", searchSourceBuilder.query());
    LOG.debug("Full SearchSourceBuilder: {}", searchSourceBuilder);

    try {
      io.micrometer.core.instrument.Timer.Sample searchTimerSample =
          org.openmetadata.service.monitoring.RequestLatencyContext.startSearchOperation();

      SearchResponse searchResponse =
          client.search(
              new es.org.elasticsearch.action.search.SearchRequest(request.getIndex())
                  .source(searchSourceBuilder),
              RequestOptions.DEFAULT);

      // End search operation timing
      if (searchTimerSample != null) {
        org.openmetadata.service.monitoring.RequestLatencyContext.endSearchOperation(
            searchTimerSample);
      }

      if (!request.getIsHierarchy()) {
        return Response.status(OK).entity(searchResponse.toString()).build();
      } else {
        // Build the nested hierarchy from elastic search response
        List<?> response = buildSearchHierarchy(request, searchResponse);
        return Response.status(OK).entity(response).build();
      }

    } catch (ElasticsearchStatusException e) {
      if (e.status() == RestStatus.NOT_FOUND) {
        throw new SearchIndexNotFoundException(
            String.format("Failed to to find index %s", request.getIndex()));
      } else {
        throw new SearchException(String.format("Search failed due to %s", e.getMessage()));
      }
    }
  }

  @Override
  public Response getDocByID(String indexName, String entityId) throws IOException {
    return entityManager.getDocByID(indexName, entityId);
  }

  private void buildHierarchyQuery(
      SearchRequest request, SearchSourceBuilder searchSourceBuilder, RestHighLevelClient client)
      throws IOException {

    if (!request.getIsHierarchy()) {
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
          .must(QueryBuilders.matchQuery("entityStatus", "Approved"));
    } else if (indexName.equalsIgnoreCase(domainIndex)) {
      baseQuery
          .should(QueryBuilders.matchPhraseQuery("parent.fullyQualifiedName", request.getQuery()))
          .should(QueryBuilders.matchPhraseQuery("parent.displayName", request.getQuery()));
    }

    baseQuery.minimumShouldMatch(1);
    searchSourceBuilder.query(baseQuery);

    SearchResponse searchResponse =
        client.search(
            new es.org.elasticsearch.action.search.SearchRequest(request.getIndex())
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
            .must(QueryBuilders.matchQuery("entityStatus", "Approved"));
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
      String q,
      String queryString)
      throws IOException {
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    if (!nullOrEmpty(q)) {
      searchSourceBuilder =
          getSearchBuilderFactory().getSearchSourceBuilder(index, q, offset, limit);
    }

    if (!nullOrEmpty(queryString)) {
      XContentParser queryParser = createXContentParser(queryString);
      searchSourceBuilder = SearchSourceBuilder.fromXContent(queryParser);
    }

    List<Map<String, Object>> results = new ArrayList<>();
    getSearchFilter(filter, searchSourceBuilder);

    searchSourceBuilder.timeout(new TimeValue(30, TimeUnit.SECONDS));
    searchSourceBuilder.from(offset);
    searchSourceBuilder.size(limit);
    if (Boolean.TRUE.equals(searchSortFilter.isSorted())) {
      FieldSortBuilder fieldSortBuilder =
          SortBuilders.fieldSort(searchSortFilter.getSortField())
              .order(SortOrder.fromString(searchSortFilter.getSortType()));
      if (Boolean.TRUE.equals(searchSortFilter.isNested())) {
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
              new es.org.elasticsearch.action.search.SearchRequest(index)
                  .source(searchSourceBuilder),
              RequestOptions.DEFAULT);
      SearchHits searchHits = response.getHits();
      SearchHit[] hits = searchHits.getHits();
      Arrays.stream(hits).forEach(hit -> results.add(hit.getSourceAsMap()));
      return new SearchResultListMapper(results, searchHits.getTotalHits().value);
    } catch (ElasticsearchStatusException e) {
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
    List<Map<String, Object>> results = new ArrayList<>();
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();

    if (!nullOrEmpty(query)) {
      searchSourceBuilder = getSearchBuilderFactory().getSearchSourceBuilder(index, query, 0, size);
    }
    if (!nullOrEmpty(fields)) {
      searchSourceBuilder.fetchSource(fields, null);
    }

    if (Optional.ofNullable(filter).isPresent()) {
      getSearchFilter(filter, searchSourceBuilder);
    }

    searchSourceBuilder.timeout(new TimeValue(30, TimeUnit.SECONDS));
    searchSourceBuilder.from(0);
    searchSourceBuilder.size(size);

    if (Optional.ofNullable(searchAfter).isPresent()) {
      searchSourceBuilder.searchAfter(searchAfter);
    }

    if (Boolean.TRUE.equals(searchSortFilter.isSorted())) {
      FieldSortBuilder fieldSortBuilder =
          SortBuilders.fieldSort(searchSortFilter.getSortField())
              .order(SortOrder.fromString(searchSortFilter.getSortType()));
      if (Boolean.TRUE.equals(searchSortFilter.isNested())) {
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
              new es.org.elasticsearch.action.search.SearchRequest(index)
                  .source(searchSourceBuilder),
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
    } catch (ElasticsearchStatusException e) {
      if (e.status() == RestStatus.NOT_FOUND) {
        throw new SearchIndexNotFoundException(String.format("Failed to to find index %s", index));
      } else {
        throw new SearchException(String.format("Search failed due to %s", e.getDetailedMessage()));
      }
    }
  }

  @Override
  public SearchLineageResult searchLineage(SearchLineageRequest lineageRequest) throws IOException {
    return lineageGraphBuilder.searchLineage(lineageRequest);
  }

  @Override
  public Response searchWithNLQ(SearchRequest request, SubjectContext subjectContext) {
    LOG.info("Searching with NLQ: {}", request.getQuery());
    if (nlqService != null) {
      try {
        String transformedQuery = nlqService.transformNaturalLanguageQuery(request, null);
        XContentParser parser = createXContentParser(transformedQuery);
        SearchSourceBuilder searchSourceBuilder = SearchSourceBuilder.fromXContent(parser);
        searchSourceBuilder.from(request.getFrom());
        searchSourceBuilder.size(request.getSize());
        ElasticSearchSourceBuilderFactory sourceBuilderFactory = getSearchBuilderFactory();
        sourceBuilderFactory.addAggregationsToNLQQuery(searchSourceBuilder, request.getIndex());
        LOG.debug("Transformed NLQ query: {}", transformedQuery);
        es.org.elasticsearch.action.search.SearchRequest searchRequest =
            new es.org.elasticsearch.action.search.SearchRequest(request.getIndex());
        searchRequest.source(searchSourceBuilder);
        es.org.elasticsearch.action.search.SearchResponse response =
            client.search(searchRequest, RequestOptions.DEFAULT);
        if (response.getHits().getTotalHits().value > 0) {
          nlqService.cacheQuery(request.getQuery(), transformedQuery);
        }
        return Response.status(Response.Status.OK).entity(response.toString()).build();
      } catch (Exception e) {
        LOG.error("Error transforming or executing NLQ query: {}", e.getMessage(), e);

        // Try using the built-in OpenSearch NLQ feature as a first fallback
        return fallbackToBasicSearch(request, subjectContext);
      }
    } else {
      return fallbackToBasicSearch(request, subjectContext);
    }
  }

  @Override
  public Response searchWithDirectQuery(SearchRequest request, SubjectContext subjectContext)
      throws IOException {
    LOG.info("Executing direct OpenSearch query: {}", request.getQueryFilter());
    try {
      XContentParser parser = createXContentParser(request.getQueryFilter());
      SearchSourceBuilder searchSourceBuilder = SearchSourceBuilder.fromXContent(parser);
      searchSourceBuilder.from(request.getFrom());
      searchSourceBuilder.size(request.getSize());

      // Apply RBAC constraints
      buildSearchRBACQuery(subjectContext, searchSourceBuilder);

      // Add aggregations if needed
      ElasticSearchSourceBuilderFactory sourceBuilderFactory = getSearchBuilderFactory();
      sourceBuilderFactory.addAggregationsToNLQQuery(searchSourceBuilder, request.getIndex());

      es.org.elasticsearch.action.search.SearchRequest esRequest =
          new es.org.elasticsearch.action.search.SearchRequest(request.getIndex());
      esRequest.source(searchSourceBuilder);

      es.org.elasticsearch.action.search.SearchResponse response =
          client.search(esRequest, RequestOptions.DEFAULT);

      LOG.debug("Direct query search completed successfully");
      return Response.status(Response.Status.OK).entity(response.toString()).build();
    } catch (Exception e) {
      LOG.error("Error executing direct query search: {}", e.getMessage(), e);
      return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
          .entity(String.format("Failed to execute direct query search: %s", e.getMessage()))
          .build();
    }
  }

  private Response fallbackToBasicSearch(SearchRequest request, SubjectContext subjectContext) {
    try {
      LOG.debug("Falling back to basic query_string search for NLQ: {}", request.getQuery());

      SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
      QueryStringQueryBuilder queryBuilder = QueryBuilders.queryStringQuery(request.getQuery());
      searchSourceBuilder.query(queryBuilder);
      searchSourceBuilder.from(request.getFrom());
      searchSourceBuilder.size(request.getSize());

      buildSearchRBACQuery(subjectContext, searchSourceBuilder);
      es.org.elasticsearch.action.search.SearchRequest esRequest =
          new es.org.elasticsearch.action.search.SearchRequest(request.getIndex());
      esRequest.source(searchSourceBuilder);
      getSearchBuilderFactory().addAggregationsToNLQQuery(searchSourceBuilder, request.getIndex());
      SearchResponse searchResponse = client.search(esRequest, RequestOptions.DEFAULT);
      return Response.status(Response.Status.OK).entity(searchResponse.toString()).build();
    } catch (Exception e) {
      LOG.error("Error in fallback search: {}", e.getMessage(), e);
      return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
          .entity(String.format("Failed to execute natural language search: %s", e.getMessage()))
          .build();
    }
  }

  @Override
  public SearchLineageResult searchLineageWithDirection(SearchLineageRequest lineageRequest)
      throws IOException {
    return lineageGraphBuilder.searchLineageWithDirection(lineageRequest);
  }

  @Override
  public LineagePaginationInfo getLineagePaginationInfo(
      String fqn,
      int upstreamDepth,
      int downstreamDepth,
      String queryFilter,
      boolean includeDeleted,
      String entityType)
      throws IOException {
    return lineageGraphBuilder.getLineagePaginationInfo(
        fqn, upstreamDepth, downstreamDepth, queryFilter, includeDeleted, entityType);
  }

  @Override
  public SearchLineageResult searchLineageByEntityCount(EntityCountLineageRequest request)
      throws IOException {
    return lineageGraphBuilder.searchLineageByEntityCount(request);
  }

  @Override
  public SearchLineageResult searchPlatformLineage(
      String index, String queryFilter, boolean deleted) throws IOException {
    return lineageGraphBuilder.getPlatformLineage(index, queryFilter, deleted);
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
    es.org.elasticsearch.action.search.SearchRequest searchRequest =
        new es.org.elasticsearch.action.search.SearchRequest(
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
                .createParser(
                    EsUtils.esXContentRegistry, LoggingDeprecationHandler.INSTANCE, queryFilter);
        es.org.elasticsearch.index.query.QueryBuilder filter =
            SearchSourceBuilder.fromXContent(filterParser).query();
        es.org.elasticsearch.index.query.BoolQueryBuilder newQuery =
            QueryBuilders.boolQuery().must(searchSourceBuilder.query()).filter(filter);
        searchSourceBuilder.query(newQuery);
      } catch (Exception ex) {
        LOG.warn("Error parsing query_filter from query parameters, ignoring filter", ex);
      }
    }
    searchRequest.source(searchSourceBuilder.size(1000));
    SearchResponse searchResponse = client.search(searchRequest, RequestOptions.DEFAULT);
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
    es.org.elasticsearch.action.search.SearchRequest searchRequest =
        new es.org.elasticsearch.action.search.SearchRequest(
            Entity.getSearchRepository().getIndexOrAliasName(GLOBAL_SEARCH_ALIAS));
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    searchSourceBuilder.query(
        QueryBuilders.boolQuery().must(QueryBuilders.termQuery("fullyQualifiedName", fqn)));
    searchRequest.source(searchSourceBuilder.size(1000));
    SearchResponse searchResponse = client.search(searchRequest, RequestOptions.DEFAULT);
    for (var hit : searchResponse.getHits().getHits()) {
      Map<String, Object> tempMap = new HashMap<>(JsonUtils.getMap(hit.getSourceAsMap()));
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
    Set<EsLineageData> edges = new HashSet<>();
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
    es.org.elasticsearch.action.search.SearchRequest searchRequest =
        new es.org.elasticsearch.action.search.SearchRequest(
            Entity.getSearchRepository().getIndexOrAliasName(GLOBAL_SEARCH_ALIAS));
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    searchSourceBuilder.query(
        QueryBuilders.boolQuery().must(QueryBuilders.termQuery("fullyQualifiedName", fqn)));
    searchRequest.source(searchSourceBuilder.size(1000));
    SearchResponse searchResponse = client.search(searchRequest, RequestOptions.DEFAULT);
    for (var hit : searchResponse.getHits().getHits()) {
      Map<String, Object> tempMap = new HashMap<>(JsonUtils.getMap(hit.getSourceAsMap()));
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

  @Override
  public Response searchSchemaEntityRelationship(
      String fqn, int upstreamDepth, int downstreamDepth, String queryFilter, boolean deleted)
      throws IOException {
    Map<String, Object> responseMap =
        searchSchemaEntityRelationshipInternal(
            fqn, upstreamDepth, downstreamDepth, queryFilter, deleted);
    return Response.status(OK).entity(responseMap).build();
  }

  private void searchDataQualityLineage(
      String fqn,
      int upstreamDepth,
      String queryFilter,
      boolean deleted,
      Set<EsLineageData> edges,
      Set<Map<String, Object>> nodes)
      throws IOException {
    Map<String, Map<String, Object>> allNodes = new HashMap<>();
    Map<String, List<EsLineageData>> allEdges = new HashMap<>();
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
      Map<String, List<EsLineageData>> allEdges,
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

        List<EsLineageData> lineageDataList =
            JsonUtils.readOrConvertValues(doc.get("upstreamLineage"), EsLineageData.class);
        for (EsLineageData lineage : lineageDataList) {
          // lineage toEntity is the entity itself
          lineage.withToEntity(getRelationshipRef(doc));
          String fromEntityId = lineage.getFromEntity().getId().toString();
          allEdges.computeIfAbsent(fromEntityId, k -> new ArrayList<>()).add(lineage);
          collectNodesAndEdges(
              lineage.getFromEntity().getFullyQualifiedName(),
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

  private void traceBackDQLineage(
      String nodeFailureId,
      Set<String> nodesWithFailures,
      Map<String, List<EsLineageData>> allEdges,
      Map<String, Map<String, Object>> allNodes,
      Set<Map<String, Object>> nodes,
      Set<EsLineageData> edges,
      Set<String> processedNodes) {
    if (processedNodes.contains(nodeFailureId)) {
      return;
    }

    processedNodes.add(nodeFailureId);
    if (nodesWithFailures.contains(nodeFailureId)) {
      Map<String, Object> node = allNodes.get(nodeFailureId);
      if (node != null) {
        node.keySet().removeAll(FIELDS_TO_REMOVE);
        node.remove("upstreamLineage");
        nodes.add(node);
      }
    }
    List<EsLineageData> edgesForNode = allEdges.get(nodeFailureId);
    if (edgesForNode != null) {
      for (EsLineageData edge : edgesForNode) {
        String fromEntityId = edge.getFromEntity().getId().toString();
        if (!fromEntityId.equals(nodeFailureId)) continue;
        edges.add(edge);
        traceBackDQLineage(
            edge.getToEntity().getId().toString(),
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
    es.org.elasticsearch.action.search.SearchRequest searchRequest =
        new es.org.elasticsearch.action.search.SearchRequest(
            Entity.getSearchRepository().getIndexOrAliasName(GLOBAL_SEARCH_ALIAS));
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    searchSourceBuilder.query(
        QueryBuilders.boolQuery()
            .must(QueryBuilders.termQuery("fqnHash.keyword", FullyQualifiedName.buildHash(fqn)))
            .must(QueryBuilders.termQuery("deleted", !nullOrEmpty(deleted) && deleted)));

    buildSearchSourceFilter(queryFilter, searchSourceBuilder);
    searchRequest.source(searchSourceBuilder.size(1000));
    return client.search(searchRequest, RequestOptions.DEFAULT);
  }

  @Override
  public Response searchBySourceUrl(String sourceUrl) throws IOException {
    es.org.elasticsearch.action.search.SearchRequest searchRequest =
        new es.org.elasticsearch.action.search.SearchRequest(
            Entity.getSearchRepository().getIndexOrAliasName(GLOBAL_SEARCH_ALIAS));
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    searchSourceBuilder.query(
        QueryBuilders.boolQuery().must(QueryBuilders.termQuery("sourceUrl", sourceUrl)));
    searchRequest.source(searchSourceBuilder);
    String response = client.search(searchRequest, RequestOptions.DEFAULT).toString();
    return Response.status(OK).entity(response).build();
  }

  @Override
  public Response searchByField(String fieldName, String fieldValue, String index, Boolean deleted)
      throws IOException {
    es.org.elasticsearch.action.search.SearchRequest searchRequest =
        new es.org.elasticsearch.action.search.SearchRequest(
            Entity.getSearchRepository().getIndexOrAliasName(index));
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    BoolQueryBuilder query =
        QueryBuilders.boolQuery()
            .must(QueryBuilders.wildcardQuery(fieldName, fieldValue))
            .filter(QueryBuilders.termQuery("deleted", deleted));
    searchSourceBuilder.query(query);
    searchRequest.source(searchSourceBuilder);
    String response = client.search(searchRequest, RequestOptions.DEFAULT).toString();
    return Response.status(OK).entity(response).build();
  }

  @Override
  public Response getEntityTypeCounts(SearchRequest request, String index) throws IOException {
    try {
      // Use the EXACT same search building logic as the regular search method
      // to ensure consistency across all endpoints
      SearchSettings searchSettings =
          SettingsCache.getSetting(SettingsType.SEARCH_SETTINGS, SearchSettings.class);
      ElasticSearchSourceBuilderFactory searchBuilderFactory =
          new ElasticSearchSourceBuilderFactory(searchSettings);

      // Build the search exactly as doSearch does
      SearchSourceBuilder searchSourceBuilder =
          searchBuilderFactory.getSearchSourceBuilder(
              index,
              request.getQuery() != null ? request.getQuery() : "*",
              0, // from
              0, // size - we only need aggregations
              false); // explain

      // No RBAC for now as per user's comment about it being disabled

      // Apply deleted filter if specified
      if (request.getDeleted() != null && request.getDeleted()) {
        QueryBuilder currentQuery = searchSourceBuilder.query();
        BoolQueryBuilder boolQuery = QueryBuilders.boolQuery();
        if (currentQuery != null) {
          boolQuery.must(currentQuery);
        }
        boolQuery.must(QueryBuilders.termQuery("deleted", request.getDeleted()));
        searchSourceBuilder.query(boolQuery);
      }

      // Apply query filter if specified
      if (!nullOrEmpty(request.getQueryFilter()) && !request.getQueryFilter().equals("{}")) {
        try {
          // Parse the query filter as JSON
          XContentParser filterParser =
              XContentType.JSON
                  .xContent()
                  .createParser(
                      NamedXContentRegistry.EMPTY,
                      LoggingDeprecationHandler.INSTANCE,
                      request.getQueryFilter());
          QueryBuilder filter = SearchSourceBuilder.fromXContent(filterParser).query();
          if (filter != null) {
            QueryBuilder currentQuery = searchSourceBuilder.query();
            BoolQueryBuilder boolQuery = QueryBuilders.boolQuery();
            if (currentQuery != null) {
              boolQuery.must(currentQuery);
            }
            boolQuery.must(filter);
            searchSourceBuilder.query(boolQuery);
          }
        } catch (Exception ex) {
          LOG.warn(
              "Error parsing query_filter from query parameters, ignoring filter: {}",
              request.getQueryFilter(),
              ex);
        }
      }

      if (!nullOrEmpty(request.getPostFilter())) {
        QueryBuilder postFilter = QueryBuilders.queryStringQuery(request.getPostFilter());
        searchSourceBuilder.postFilter(postFilter);
      }

      searchSourceBuilder.size(0);
      searchSourceBuilder.from(0);
      searchSourceBuilder.trackTotalHits(true);

      // The entityType aggregation is already added by the search builder factory
      // from the global aggregations configuration, so we don't need to add it again

      // Resolve the index alias properly to ensure we're searching across all appropriate indexes
      String resolvedIndex =
          Entity.getSearchRepository().getIndexOrAliasName(index != null ? index : "all");
      es.org.elasticsearch.action.search.SearchRequest esSearchRequest =
          new es.org.elasticsearch.action.search.SearchRequest(resolvedIndex);
      esSearchRequest.source(searchSourceBuilder);

      LOG.debug("Sending entity type counts request to ElasticSearch: {}", searchSourceBuilder);
      SearchResponse searchResponse = client.search(esSearchRequest, RequestOptions.DEFAULT);

      // Convert to API response using toString() which returns proper JSON
      // (not JsonUtils.pojoToJson which fails on internal ES objects)
      return Response.status(OK).entity(searchResponse.toString()).build();
    } catch (Exception e) {
      LOG.error(
          "Error executing entity type counts search for index: {}, query: {}",
          index,
          request.getQuery(),
          e);
      throw new SearchException(
          String.format("Failed to get entity type counts: %s", e.getMessage()));
    }
  }

  @Override
  public Response aggregate(AggregationRequest request) throws IOException {
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();

    // Check if query is JSON format or simple search query
    if (request.getQuery() != null && !request.getQuery().isEmpty()) {
      // Try to parse as JSON first (for backward compatibility with filters)
      if (request.getQuery().trim().startsWith("{")) {
        buildSearchSourceFilter(request.getQuery(), searchSourceBuilder);
      } else {
        // Handle as a search query (including field:value syntax)
        ElasticSearchSourceBuilderFactory searchBuilderFactory = getSearchBuilderFactory();
        // Use getSearchSourceBuilder which properly handles field:value syntax
        SearchSourceBuilder tempBuilder =
            searchBuilderFactory.getSearchSourceBuilder(
                request.getIndex(), request.getQuery(), 0, 10);
        searchSourceBuilder.query(tempBuilder.query());
      }
    }

    // Apply deleted filter if specified
    if (request.getDeleted() != null) {
      QueryBuilder currentQuery = searchSourceBuilder.query();
      BoolQueryBuilder boolQuery = QueryBuilders.boolQuery();

      if (currentQuery != null) {
        boolQuery.must(currentQuery);
      }
      boolQuery.must(QueryBuilders.termQuery("deleted", request.getDeleted()));

      searchSourceBuilder.query(boolQuery);
    }

    String aggregationField = request.getFieldName();
    if (aggregationField == null || aggregationField.isBlank()) {
      throw new IllegalArgumentException("Aggregation field (fieldName) cannot be null or empty");
    }

    int bucketSize = request.getSize();
    String includeValue = request.getFieldValue().toLowerCase();

    TermsAggregationBuilder termsAgg =
        AggregationBuilders.terms(aggregationField)
            .field(aggregationField)
            .size(bucketSize)
            .includeExclude(new IncludeExclude(includeValue, null))
            .order(BucketOrder.key(true));

    if (request.getSourceFields() != null && !request.getSourceFields().isEmpty()) {
      request.setTopHits(Optional.ofNullable(request.getTopHits()).orElse(new TopHits()));

      List<String> topHitFields = request.getSourceFields();

      TopHitsAggregationBuilder topHitsAgg =
          AggregationBuilders.topHits("top")
              .size(request.getTopHits().getSize())
              .fetchSource(topHitFields.toArray(new String[0]), null)
              .trackScores(false);

      termsAgg.subAggregation(topHitsAgg);
    }

    searchSourceBuilder.aggregation(termsAgg).size(0).timeout(new TimeValue(30, TimeUnit.SECONDS));

    SearchResponse searchResponse =
        client.search(
            new es.org.elasticsearch.action.search.SearchRequest(
                    Entity.getSearchRepository().getIndexOrAliasName(request.getIndex()))
                .source(searchSourceBuilder),
            RequestOptions.DEFAULT);

    return Response.status(Response.Status.OK).entity(searchResponse.toString()).build();
  }

  @Override
  public DataQualityReport genericAggregation(
      String query, String index, SearchAggregation aggregationMetadata) throws IOException {
    List<ElasticAggregations> aggregationBuilder =
        ElasticAggregationsBuilder.buildAggregation(
            aggregationMetadata.getAggregationTree(), null, new ArrayList<>());

    // Create search request
    es.org.elasticsearch.action.search.SearchRequest searchRequest =
        new es.org.elasticsearch.action.search.SearchRequest(
            Entity.getSearchRepository().getIndexOrAliasName(index));

    // Create search source builder
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    if (query != null) {
      XContentParser queryParser =
          XContentType.JSON
              .xContent()
              .createParser(EsUtils.esXContentRegistry, LoggingDeprecationHandler.INSTANCE, query);
      es.org.elasticsearch.index.query.QueryBuilder parsedQuery =
          SearchSourceBuilder.fromXContent(queryParser).query();
      es.org.elasticsearch.index.query.BoolQueryBuilder boolQueryBuilder =
          QueryBuilders.boolQuery().must(parsedQuery);
      searchSourceBuilder.query(boolQueryBuilder);
    }
    searchSourceBuilder.size(0).timeout(new TimeValue(30, TimeUnit.SECONDS));

    for (ElasticAggregations aggregation : aggregationBuilder) {
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

    List<ElasticAggregations> aggregationBuilder =
        ElasticAggregationsBuilder.buildAggregation(
            searchAggregation.getAggregationTree(), null, new ArrayList<>());
    es.org.elasticsearch.action.search.SearchRequest searchRequest =
        new es.org.elasticsearch.action.search.SearchRequest(
            Entity.getSearchRepository().getIndexOrAliasName(index));
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    if (query != null) {
      XContentParser queryParser =
          XContentType.JSON
              .xContent()
              .createParser(EsUtils.esXContentRegistry, LoggingDeprecationHandler.INSTANCE, query);
      es.org.elasticsearch.index.query.QueryBuilder parsedQuery =
          SearchSourceBuilder.fromXContent(queryParser).query();
      es.org.elasticsearch.index.query.BoolQueryBuilder boolQueryBuilder =
          QueryBuilders.boolQuery().must(parsedQuery);
      searchSourceBuilder.query(boolQueryBuilder);
    }
    getSearchFilter(filter, searchSourceBuilder);

    searchSourceBuilder.size(0).timeout(new TimeValue(30, TimeUnit.SECONDS));

    for (ElasticAggregations aggregation : aggregationBuilder) {
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

  @Override
  public ElasticSearchConfiguration.SearchType getSearchType() {
    return ElasticSearchConfiguration.SearchType.ELASTICSEARCH;
  }

  @Override
  public void createEntity(String indexName, String docId, String doc) throws IOException {
    entityManager.createEntity(indexName, docId, doc);
  }

  @Override
  public void createEntities(String indexName, List<Map<String, String>> docsAndIds) {
    entityManager.createEntities(indexName, docsAndIds);
  }

  @Override
  public void createTimeSeriesEntity(String indexName, String docId, String doc)
      throws IOException {
    entityManager.createTimeSeriesEntity(indexName, docId, doc);
  }

  @Override
  public void deleteByScript(String indexName, String scriptTxt, Map<String, Object> params)
      throws IOException {
    entityManager.deleteByScript(indexName, scriptTxt, params);
  }

  @Override
  public void deleteEntity(String indexName, String docId) throws IOException {
    entityManager.deleteEntity(indexName, docId);
  }

  @Override
  public void deleteEntityByFields(
      List<String> indexNames, List<Pair<String, String>> fieldAndValue) throws IOException {
    entityManager.deleteEntityByFields(indexNames, fieldAndValue);
  }

  @Override
  public void deleteEntityByFQNPrefix(String indexName, String fqnPrefix) throws IOException {
    entityManager.deleteEntityByFQNPrefix(indexName, fqnPrefix);
  }

  @Override
  public void softDeleteOrRestoreEntity(String indexName, String docId, String scriptTxt)
      throws IOException {
    entityManager.softDeleteOrRestoreEntity(indexName, docId, scriptTxt);
  }

  @Override
  public void softDeleteOrRestoreChildren(
      List<String> indexName, String scriptTxt, List<Pair<String, String>> fieldAndValue)
      throws IOException {
    entityManager.softDeleteOrRestoreChildren(indexName, scriptTxt, fieldAndValue);
  }

  @Override
  public void updateEntity(
      String indexName, String docId, Map<String, Object> doc, String scriptTxt) {
    entityManager.updateEntity(indexName, docId, doc, scriptTxt);
  }

  @Override
  public void reindexEntities(List<EntityReference> entities) throws IOException {
    entityManager.reindexEntities(entities);
  }

  public void reindexAcrossIndices(String matchingKey, EntityReference sourceRef) {
    if (isClientAvailable) {
      getAsyncExecutor()
          .submit(
              () -> {
                try {
                  int from = 0;
                  boolean hasMoreResults = true;

                  while (hasMoreResults) {
                    List<EntityReference> entities =
                        ReindexingUtil.findReferenceInElasticSearchAcrossAllIndexes(
                            matchingKey,
                            ReindexingUtil.escapeDoubleQuotes(sourceRef.getFullyQualifiedName()),
                            from);

                    reindexEntities(entities);

                    from += entities.size();
                    hasMoreResults = !entities.isEmpty();
                  }
                } catch (Exception ex) {
                  LOG.error("Reindexing Across Entities Failed", ex);
                }
              });
    }
  }

  @Override
  public void updateChildren(
      String indexName,
      Pair<String, String> fieldAndValue,
      Pair<String, Map<String, Object>> updates) {
    entityManager.updateChildren(indexName, fieldAndValue, updates);
  }

  @Override
  public void updateByFqnPrefix(
      String indexName, String oldParentFQN, String newParentFQN, String prefixFieldCondition) {
    entityManager.updateByFqnPrefix(indexName, oldParentFQN, newParentFQN, prefixFieldCondition);
  }

  @Override
  public void updateChildren(
      List<String> indexName,
      Pair<String, String> fieldAndValue,
      Pair<String, Map<String, Object>> updates)
      throws IOException {
    entityManager.updateChildren(indexName, fieldAndValue, updates);
  }

  @Override
  public void updateEntityRelationship(
      String indexName,
      Pair<String, String> fieldAndValue,
      Map<String, Object> entityRelationshipData) {
    entityManager.updateEntityRelationship(indexName, fieldAndValue, entityRelationshipData);
  }

  @Override
  public void reindexWithEntityIds(
      List<String> sourceIndices,
      String destinationIndex,
      String pipelineName,
      String entityType,
      List<UUID> entityIds) {
    entityManager.reindexWithEntityIds(
        sourceIndices, destinationIndex, pipelineName, entityType, entityIds);
  }

  @Override
  public void updateLineage(
      String indexName, Pair<String, String> fieldAndValue, EsLineageData lineageData) {
    entityManager.updateLineage(indexName, fieldAndValue, lineageData);
  }

  /**
   *
   */
  @Override
  public void close() {}

  @Override
  public void deleteByRangeQuery(
      String index, String fieldName, Object gt, Object gte, Object lt, Object lte)
      throws IOException {
    entityManager.deleteByRangeQuery(index, fieldName, gt, gte, lt, lte);
  }

  @Override
  public void deleteByRangeAndTerm(
      String index,
      String rangeFieldName,
      Object gt,
      Object gte,
      Object lt,
      Object lte,
      String termKey,
      String termValue)
      throws IOException {
    entityManager.deleteByRangeAndTerm(index, rangeFieldName, gt, gte, lt, lte, termKey, termValue);
  }

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
    return dataInsightAggregatorManager.listDataInsightChartResult(
        startTs, endTs, tier, team, dataInsightChartName, size, from, queryFilter, dataReportIndex);
  }

  @Override
  public List<Map<String, String>> fetchDIChartFields() {
    return dataInsightAggregatorManager.fetchDIChartFields();
  }

  @Override
  public DataInsightCustomChartResultList buildDIChart(
      @NotNull DataInsightCustomChart diChart, long start, long end, boolean live)
      throws IOException {
    return dataInsightAggregatorManager.buildDIChart(diChart, start, end, live);
  }

  @Override
  public QueryCostSearchResult getQueryCostRecords(String serviceName) throws IOException {
    return dataInsightAggregatorManager.getQueryCostRecords(serviceName);
  }

  public RestClient getLowLevelRestClient(ElasticSearchConfiguration esConfig) {
    if (esConfig != null) {
      try {
        RestClientBuilder restClientBuilder =
            RestClient.builder(
                new HttpHost(esConfig.getHost(), esConfig.getPort(), esConfig.getScheme()));

        // Configure connection pooling
        restClientBuilder.setHttpClientConfigCallback(
            httpAsyncClientBuilder -> {
              // Set connection pool sizes
              if (esConfig.getMaxConnTotal() != null && esConfig.getMaxConnTotal() > 0) {
                httpAsyncClientBuilder.setMaxConnTotal(esConfig.getMaxConnTotal());
              }
              if (esConfig.getMaxConnPerRoute() != null && esConfig.getMaxConnPerRoute() > 0) {
                httpAsyncClientBuilder.setMaxConnPerRoute(esConfig.getMaxConnPerRoute());
              }

              // Configure authentication if provided
              if (StringUtils.isNotEmpty(esConfig.getUsername())
                  && StringUtils.isNotEmpty(esConfig.getPassword())) {
                CredentialsProvider credentialsProvider = new BasicCredentialsProvider();
                credentialsProvider.setCredentials(
                    AuthScope.ANY,
                    new UsernamePasswordCredentials(
                        esConfig.getUsername(), esConfig.getPassword()));
                httpAsyncClientBuilder.setDefaultCredentialsProvider(credentialsProvider);
              }

              // Configure SSL if needed
              SSLContext sslContext = null;
              try {
                sslContext = createElasticSearchSSLContext(esConfig);
              } catch (KeyStoreException e) {
                throw new RuntimeException(e);
              }
              if (sslContext != null) {
                httpAsyncClientBuilder.setSSLContext(sslContext);
              }

              // Enable TCP keep alive strategy
              if (esConfig.getKeepAliveTimeoutSecs() != null
                  && esConfig.getKeepAliveTimeoutSecs() > 0) {
                httpAsyncClientBuilder.setKeepAliveStrategy(
                    (response, context) -> esConfig.getKeepAliveTimeoutSecs() * 1000);
              }

              return httpAsyncClientBuilder;
            });

        // Configure request timeouts
        restClientBuilder.setRequestConfigCallback(
            requestConfigBuilder ->
                requestConfigBuilder
                    .setConnectTimeout(esConfig.getConnectionTimeoutSecs() * 1000)
                    .setSocketTimeout(esConfig.getSocketTimeoutSecs() * 1000));

        // Enable compression for better network efficiency
        restClientBuilder.setCompressionEnabled(true);

        // Build client without default headers first to check version
        RestClient tempClient = restClientBuilder.build();
        boolean isElasticsearch7 = isElasticsearch7Version(tempClient);
        tempClient.close();

        // Only set default headers for ES 7.x server
        if (isElasticsearch7) {
          restClientBuilder.setDefaultHeaders(defaultHeaders);
        }

        return restClientBuilder.build();
      } catch (Exception e) {
        LOG.error("Failed to create low level rest client ", e);
        return null;
      }
    } else {
      LOG.error("Failed to create low level rest client as esConfig is null");
      return null;
    }
  }

  public RestHighLevelClient createElasticSearchLegacyClient(RestClient lowLevelClient) {
    try {
      RestHighLevelClientBuilder restHighLevelClientBuilder =
          new RestHighLevelClientBuilder(lowLevelClient).setApiCompatibilityMode(true);
      LOG.info("Successfully initialized legacy Elasticsearch Java API client");
      return restHighLevelClientBuilder.build();
    } catch (Exception e) {
      LOG.error("Failed to initialize legacy Elasticsearch client", e);
      return null;
    }
  }

  private XContentParser createXContentParser(String query) throws IOException {
    try {
      return XContentType.JSON
          .xContent()
          .createParser(EsUtils.esXContentRegistry, LoggingDeprecationHandler.INSTANCE, query);
    } catch (IOException e) {
      LOG.error("Failed to create XContentParser", e);
      throw e;
    }
  }

  private void getSearchFilter(String filter, SearchSourceBuilder searchSourceBuilder)
      throws IOException {
    if (!filter.isEmpty()) {
      try {
        XContentParser queryParser = createXContentParser(filter);
        XContentParser sourceParser = createXContentParser(filter);
        QueryBuilder queryFromXContent = SearchSourceBuilder.fromXContent(queryParser).query();
        FetchSourceContext sourceFromXContent =
            SearchSourceBuilder.fromXContent(sourceParser).fetchSource();
        BoolQueryBuilder boolQuery = QueryBuilders.boolQuery();
        if (searchSourceBuilder.query() != null) {
          boolQuery = boolQuery.must(searchSourceBuilder.query());
        }
        boolQuery = boolQuery.filter(queryFromXContent);
        searchSourceBuilder.query(boolQuery);
        searchSourceBuilder.fetchSource(sourceFromXContent);
      } catch (Exception e) {
        throw new IOException(String.format("Failed to parse query filter: %s", e.getMessage()), e);
      }
    }
  }

  public Object getLowLevelClient() {
    return client.getLowLevelClient();
  }

  @Override
  public RestHighLevelClient getHighLevelClient() {
    return client;
  }

  @Override
  public SearchHealthStatus getSearchHealthStatus() throws IOException {
    return genericManager.getSearchHealthStatus();
  }

  private void buildSearchRBACQuery(
      SubjectContext subjectContext, SearchSourceBuilder searchSourceBuilder) {
    if (shouldApplyRbacConditions(subjectContext, rbacConditionEvaluator)) {
      OMQueryBuilder rbacQuery = rbacConditionEvaluator.evaluateConditions(subjectContext);
      if (rbacQuery != null) {
        searchSourceBuilder.query(
            QueryBuilders.boolQuery()
                .must(searchSourceBuilder.query())
                .filter(((ElasticQueryBuilder) rbacQuery).build()));
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
                .createParser(
                    EsUtils.esXContentRegistry, LoggingDeprecationHandler.INSTANCE, queryFilter);
        QueryBuilder filter = SearchSourceBuilder.fromXContent(filterParser).query();
        BoolQueryBuilder newQuery;
        if (!nullOrEmpty(searchSourceBuilder.query())) {
          newQuery = QueryBuilders.boolQuery().must(searchSourceBuilder.query()).filter(filter);
        } else {
          newQuery = QueryBuilders.boolQuery().filter(filter);
        }
        searchSourceBuilder.query(newQuery);
      } catch (Exception ex) {
        LOG.error("Error parsing query_filter from query parameters, ignoring filter", ex);
        String errorMessage =
            String.format(
                "Error: %s.\nCause: %s",
                ex.getMessage(), ex.getCause() != null ? ex.getCause().toString() : "Unknown");
        throw new ParsingException(XContentLocation.UNKNOWN, errorMessage, ex);
      }
    }
  }

  private ElasticSearchSourceBuilderFactory getSearchBuilderFactory() {
    SearchSettings searchSettings =
        SettingsCache.getSetting(SettingsType.SEARCH_SETTINGS, SearchSettings.class);
    return new ElasticSearchSourceBuilderFactory(searchSettings);
  }

  @Override
  public List<String> getDataStreams(String prefix) throws IOException {
    return genericManager.getDataStreams(prefix);
  }

  @Override
  public void deleteDataStream(String dataStreamName) throws IOException {
    genericManager.deleteDataStream(dataStreamName);
  }

  @Override
  public void deleteILMPolicy(String policyName) throws IOException {
    genericManager.deleteILMPolicy(policyName);
  }

  @Override
  public void deleteIndexTemplate(String templateName) throws IOException {
    genericManager.deleteIndexTemplate(templateName);
  }

  @Override
  public void deleteComponentTemplate(String componentTemplateName) throws IOException {
    genericManager.deleteComponentTemplate(componentTemplateName);
  }

  @Override
  public void dettachIlmPolicyFromIndexes(String indexPattern) throws IOException {
    genericManager.dettachIlmPolicyFromIndexes(indexPattern);
  }

  @Override
  public void removeILMFromComponentTemplate(String componentTemplateName) throws IOException {
    genericManager.removeILMFromComponentTemplate(componentTemplateName);
  }

  public ClusterStatsResponse clusterStats() throws IOException {
    return genericManager.clusterStats();
  }

  public NodesStatsResponse nodesStats() throws IOException {
    return genericManager.nodesStats();
  }

  public GetClusterSettingsResponse clusterSettings() throws IOException {
    return genericManager.clusterSettings();
  }

  public double averageCpuPercentFromNodesStats(NodesStatsResponse nodesStats) {
    return genericManager.averageCpuPercentFromNodesStats(nodesStats);
  }

  public Map<String, Object> extractJvmMemoryStats(NodesStatsResponse nodesStats) {
    return genericManager.extractJvmMemoryStats(nodesStats);
  }

  public String extractMaxContentLengthStr(GetClusterSettingsResponse clusterSettings) {
    return genericManager.extractMaxContentLengthStr(clusterSettings);
  }

  @Override
  public void updateGlossaryTermByFqnPrefix(
      String indexName, String oldParentFQN, String newParentFQN, String prefixFieldCondition) {
    entityManager.updateGlossaryTermByFqnPrefix(
        indexName, oldParentFQN, newParentFQN, prefixFieldCondition);
  }

  @Override
  public void updateColumnsInUpstreamLineage(
      String indexName, HashMap<String, String> originalUpdatedColumnFqnMap) {
    entityManager.updateColumnsInUpstreamLineage(indexName, originalUpdatedColumnFqnMap);
  }

  @Override
  public void deleteColumnsInUpstreamLineage(String indexName, List<String> deletedColumns) {
    entityManager.deleteColumnsInUpstreamLineage(indexName, deletedColumns);
  }

  @Override
  public SearchEntityRelationshipResult searchEntityRelationship(
      SearchEntityRelationshipRequest entityRelationshipRequest) throws IOException {
    int upstreamDepth = entityRelationshipRequest.getUpstreamDepth();
    int downstreamDepth = entityRelationshipRequest.getDownstreamDepth();
    SearchEntityRelationshipResult result =
        entityRelationshipGraphBuilder.getDownstreamEntityRelationship(
            entityRelationshipRequest
                .withUpstreamDepth(upstreamDepth + 1)
                .withDownstreamDepth(downstreamDepth + 1)
                .withDirection(
                    org.openmetadata
                        .schema
                        .api
                        .entityRelationship
                        .EntityRelationshipDirection
                        .DOWNSTREAM)
                .withDirectionValue(
                    getEntityRelationshipDirection(
                        org.openmetadata
                            .schema
                            .api
                            .entityRelationship
                            .EntityRelationshipDirection
                            .DOWNSTREAM)));
    SearchEntityRelationshipResult upstreamResult =
        entityRelationshipGraphBuilder.getUpstreamEntityRelationship(
            entityRelationshipRequest
                .withUpstreamDepth(upstreamDepth + 1)
                .withDownstreamDepth(downstreamDepth + 1)
                .withDirection(
                    org.openmetadata
                        .schema
                        .api
                        .entityRelationship
                        .EntityRelationshipDirection
                        .UPSTREAM)
                .withDirectionValue(
                    getEntityRelationshipDirection(
                        org.openmetadata
                            .schema
                            .api
                            .entityRelationship
                            .EntityRelationshipDirection
                            .UPSTREAM)));

    for (var nodeFromDownstream : result.getNodes().entrySet()) {
      if (upstreamResult.getNodes().containsKey(nodeFromDownstream.getKey())) {
        org.openmetadata.schema.type.entityRelationship.NodeInformation existingNode =
            upstreamResult.getNodes().get(nodeFromDownstream.getKey());
        LayerPaging existingPaging = existingNode.getPaging();
        existingPaging.setEntityDownstreamCount(
            nodeFromDownstream.getValue().getPaging().getEntityDownstreamCount());
      }
    }

    // since paging from downstream is merged into upstream, we can just put the upstream result
    result.getNodes().putAll(upstreamResult.getNodes());
    result.getUpstreamEdges().putAll(upstreamResult.getUpstreamEdges());
    result.getDownstreamEdges().putAll(upstreamResult.getDownstreamEdges());
    return result;
  }

  @Override
  public SearchEntityRelationshipResult searchEntityRelationshipWithDirection(
      SearchEntityRelationshipRequest entityRelationshipRequest) throws IOException {
    Set<String> directionValue =
        getEntityRelationshipDirection(entityRelationshipRequest.getDirection());
    entityRelationshipRequest.setDirectionValue(directionValue);

    entityRelationshipRequest =
        entityRelationshipRequest
            .withUpstreamDepth(entityRelationshipRequest.getUpstreamDepth() + 1)
            .withDownstreamDepth(entityRelationshipRequest.getDownstreamDepth() + 1);

    if (entityRelationshipRequest.getDirection()
        == org.openmetadata.schema.api.entityRelationship.EntityRelationshipDirection.DOWNSTREAM) {
      return entityRelationshipGraphBuilder.getDownstreamEntityRelationship(
          entityRelationshipRequest);
    } else {
      directionValue = getEntityRelationshipDirection(entityRelationshipRequest.getDirection());
      entityRelationshipRequest.setDirectionValue(directionValue);
      return entityRelationshipGraphBuilder.getUpstreamEntityRelationship(
          entityRelationshipRequest);
    }
  }

  private boolean isElasticsearch7Version(RestClient restClient) {
    try {
      Request request = new Request("GET", "/");
      es.org.elasticsearch.client.Response response = restClient.performRequest(request);
      String responseBody = EntityUtils.toString(response.getEntity());
      JsonNode jsonNode = JsonUtils.readTree(responseBody);
      JsonNode versionNode = jsonNode.get("version");
      if (versionNode != null && versionNode.get("number") != null) {
        String version = versionNode.get("number").asText();
        LOG.info("ES Server version is running on: {}", version);
        return version.startsWith("7.");
      }
    } catch (Exception e) {
      LOG.error("Failed to detect Elasticsearch version, assuming non-7.x", e);
    }
    return false;
  }

  @Override
  public SearchSchemaEntityRelationshipResult getSchemaEntityRelationship(
      String schemaFqn,
      String queryFilter,
      String includeSourceFields,
      int offset,
      int limit,
      int from,
      int size,
      boolean deleted)
      throws IOException {
    return entityManager.getSchemaEntityRelationship(
        schemaFqn, queryFilter, includeSourceFields, offset, limit, from, size, deleted);
  }
}
