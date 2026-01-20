package org.openmetadata.service.search.elasticsearch;

import static org.openmetadata.service.search.SearchUtils.createElasticSearchSSLContext;
import static org.openmetadata.service.search.SearchUtils.getEntityRelationshipDirection;

import com.fasterxml.jackson.databind.JsonNode;
import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.elasticsearch._types.Refresh;
import es.co.elastic.clients.elasticsearch.cluster.ClusterStatsResponse;
import es.co.elastic.clients.elasticsearch.cluster.GetClusterSettingsResponse;
import es.co.elastic.clients.elasticsearch.core.BulkResponse;
import es.co.elastic.clients.elasticsearch.core.bulk.BulkOperation;
import es.co.elastic.clients.elasticsearch.nodes.NodesStatsResponse;
import es.co.elastic.clients.json.jackson.JacksonJsonpMapper;
import es.co.elastic.clients.transport.rest_client.RestClientTransport;
import es.org.elasticsearch.client.Request;
import es.org.elasticsearch.client.RestClient;
import es.org.elasticsearch.client.RestClientBuilder;
import jakarta.json.JsonObject;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.security.KeyStoreException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
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
import org.openmetadata.schema.entity.data.QueryCostSearchResult;
import org.openmetadata.schema.search.AggregationRequest;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.tests.DataQualityReport;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.LayerPaging;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.search.SearchAggregation;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchHealthStatus;
import org.openmetadata.service.search.SearchResultListMapper;
import org.openmetadata.service.search.SearchSortFilter;
import org.openmetadata.service.search.elasticsearch.queries.ElasticQueryBuilderFactory;
import org.openmetadata.service.search.nlq.NLQService;
import org.openmetadata.service.search.queries.QueryBuilderFactory;
import org.openmetadata.service.search.security.RBACConditionEvaluator;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.workflows.searchIndex.ReindexingUtil;

@Slf4j
public class ElasticSearchClient implements SearchClient {

  // New Java API client support for migration
  @Getter protected final ElasticsearchClient newClient;
  private final RestClient lowLevelClient;

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
  private final ElasticSearchAggregationManager aggregationManager;
  private final ElasticSearchDataInsightAggregatorManager dataInsightAggregatorManager;
  private final ElasticSearchSearchManager searchManager;

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
    this(config, null);
  }

  // Update the constructor to accept NLQService
  public ElasticSearchClient(ElasticSearchConfiguration config, NLQService nlqService) {
    this.lowLevelClient = getLowLevelRestClient(config);
    this.newClient = createElasticSearchNewClient(lowLevelClient);
    clusterAlias = config != null ? config.getClusterAlias() : "";
    isClientAvailable = newClient != null;
    isNewClientAvailable = newClient != null;
    queryBuilderFactory = new ElasticQueryBuilderFactory();
    rbacConditionEvaluator = new RBACConditionEvaluator(queryBuilderFactory);
    lineageGraphBuilder = new ESLineageGraphBuilder(newClient);
    entityRelationshipGraphBuilder = new ESEntityRelationshipGraphBuilder(newClient);
    this.nlqService = nlqService;
    indexManager = new ElasticSearchIndexManager(newClient, clusterAlias);
    entityManager = new ElasticSearchEntityManager(newClient);
    genericManager = new ElasticSearchGenericManager(newClient);
    aggregationManager = new ElasticSearchAggregationManager(newClient);
    dataInsightAggregatorManager = new ElasticSearchDataInsightAggregatorManager(newClient);
    searchManager =
        new ElasticSearchSearchManager(newClient, rbacConditionEvaluator, clusterAlias, nlqService);
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
  @SuppressWarnings("unchecked")
  public <T> T getHighLevelClient() {
    return (T) newClient;
  }

  @Override
  public Object getLowLevelClient() {
    return lowLevelClient;
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
  public void deleteIndexWithBackoff(String indexName) {
    indexManager.deleteIndexWithBackoff(indexName);
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
    return searchManager.search(request, subjectContext);
  }

  @Override
  public Response previewSearch(
      SearchRequest request, SubjectContext subjectContext, SearchSettings searchSettings)
      throws IOException {
    return searchManager.previewSearch(request, subjectContext, searchSettings);
  }

  @Override
  public Response getDocByID(String indexName, String entityId) throws IOException {
    return entityManager.getDocByID(indexName, entityId);
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
    return searchManager.listWithOffset(
        filter, limit, offset, index, searchSortFilter, q, queryString);
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
    return searchManager.listWithDeepPagination(
        index, query, filter, fields, searchSortFilter, size, searchAfter);
  }

  @Override
  public SearchLineageResult searchLineage(SearchLineageRequest lineageRequest) throws IOException {
    return lineageGraphBuilder.searchLineage(lineageRequest);
  }

  @Override
  public Response searchWithNLQ(SearchRequest request, SubjectContext subjectContext) {
    return searchManager.searchWithNLQ(request, subjectContext);
  }

  @Override
  public Response searchWithDirectQuery(SearchRequest request, SubjectContext subjectContext)
      throws IOException {
    return searchManager.searchWithDirectQuery(request, subjectContext);
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

  @Override
  public Response searchEntityRelationship(
      String fqn, int upstreamDepth, int downstreamDepth, String queryFilter, boolean deleted)
      throws IOException {
    return searchManager.searchEntityRelationship(
        fqn, upstreamDepth, downstreamDepth, queryFilter, deleted);
  }

  @Override
  public Response searchDataQualityLineage(
      String fqn, int upstreamDepth, String queryFilter, boolean deleted) throws IOException {
    return searchManager.searchDataQualityLineage(fqn, upstreamDepth, queryFilter, deleted);
  }

  @Override
  public Response searchSchemaEntityRelationship(
      String fqn, int upstreamDepth, int downstreamDepth, String queryFilter, boolean deleted)
      throws IOException {
    return searchManager.searchSchemaEntityRelationship(
        fqn, upstreamDepth, downstreamDepth, queryFilter, deleted);
  }

  @Override
  public Response searchBySourceUrl(String sourceUrl) throws IOException {
    return searchManager.searchBySourceUrl(sourceUrl);
  }

  @Override
  public Response searchByField(String fieldName, String fieldValue, String index, Boolean deleted)
      throws IOException {
    return searchManager.searchByField(fieldName, fieldValue, index, deleted);
  }

  @Override
  public Response getEntityTypeCounts(SearchRequest request, String index) throws IOException {
    return aggregationManager.getEntityTypeCounts(request, index);
  }

  @Override
  public Response aggregate(AggregationRequest request) throws IOException {
    return aggregationManager.aggregate(request);
  }

  @Override
  public DataQualityReport genericAggregation(
      String query, String index, SearchAggregation aggregationMetadata) throws IOException {
    return aggregationManager.genericAggregation(query, index, aggregationMetadata);
  }

  @Override
  public JsonObject aggregate(
      String query, String index, SearchAggregation searchAggregation, String filter)
      throws IOException {
    return aggregationManager.aggregate(query, index, searchAggregation, filter);
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
  public BulkResponse bulkElasticSearch(List<BulkOperation> operations) throws IOException {
    return newClient.bulk(b -> b.operations(operations).refresh(Refresh.True));
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

  @Override
  public SearchHealthStatus getSearchHealthStatus() throws IOException {
    return genericManager.getSearchHealthStatus();
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
  public void updateClassificationTagByFqnPrefix(
      String indexName, String oldParentFQN, String newParentFQN, String prefixFieldCondition) {
    entityManager.updateClassificationTagByFqnPrefix(
        indexName, oldParentFQN, newParentFQN, prefixFieldCondition);
  }

  @Override
  public void updateDataProductReferences(String oldFqn, String newFqn) {
    entityManager.updateDataProductReferences(oldFqn, newFqn);
  }

  @Override
  public void updateAssetDomainsForDataProduct(
      String dataProductFqn, List<String> oldDomainFqns, List<EntityReference> newDomains) {
    entityManager.updateAssetDomainsForDataProduct(dataProductFqn, oldDomainFqns, newDomains);
  }

  @Override
  public void updateAssetDomainsByIds(
      List<UUID> assetIds, List<String> oldDomainFqns, List<EntityReference> newDomains) {
    entityManager.updateAssetDomainsByIds(assetIds, oldDomainFqns, newDomains);
  }

  @Override
  public void updateDomainFqnByPrefix(String oldFqn, String newFqn) {
    entityManager.updateDomainFqnByPrefix(oldFqn, newFqn);
  }

  @Override
  public void updateAssetDomainFqnByPrefix(String oldFqn, String newFqn) {
    entityManager.updateAssetDomainFqnByPrefix(oldFqn, newFqn);
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
