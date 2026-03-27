package org.openmetadata.service.search;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.search.IndexMapping.INDEX_NAME_SEPARATOR;
import static org.openmetadata.service.Entity.AGGREGATED_COST_ANALYSIS_REPORT_DATA;
import static org.openmetadata.service.Entity.ENTITY_REPORT_DATA;
import static org.openmetadata.service.Entity.FIELD_DESCRIPTION;
import static org.openmetadata.service.Entity.FIELD_DISPLAY_NAME;
import static org.openmetadata.service.Entity.FIELD_DOMAINS;
import static org.openmetadata.service.Entity.FIELD_FOLLOWERS;
import static org.openmetadata.service.Entity.FIELD_FULLY_QUALIFIED_NAME;
import static org.openmetadata.service.Entity.FIELD_NAME;
import static org.openmetadata.service.Entity.FIELD_OWNERS;
import static org.openmetadata.service.Entity.FIELD_USAGE_SUMMARY;
import static org.openmetadata.service.Entity.QUERY;
import static org.openmetadata.service.Entity.RAW_COST_ANALYSIS_REPORT_DATA;
import static org.openmetadata.service.Entity.WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA;
import static org.openmetadata.service.Entity.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA;
import static org.openmetadata.service.search.SearchClient.ADD_DOMAINS_SCRIPT;
import static org.openmetadata.service.search.SearchClient.ADD_FOLLOWERS_SCRIPT;
import static org.openmetadata.service.search.SearchClient.ADD_OWNERS_SCRIPT;
import static org.openmetadata.service.search.SearchClient.DATA_ASSET_SEARCH_ALIAS;
import static org.openmetadata.service.search.SearchClient.DEFAULT_UPDATE_SCRIPT;
import static org.openmetadata.service.search.SearchClient.GLOBAL_SEARCH_ALIAS;
import static org.openmetadata.service.search.SearchClient.PROPAGATE_ENTITY_REFERENCE_FIELD_SCRIPT;
import static org.openmetadata.service.search.SearchClient.PROPAGATE_FIELD_SCRIPT;
import static org.openmetadata.service.search.SearchClient.PROPAGATE_NESTED_FIELD_SCRIPT;
import static org.openmetadata.service.search.SearchClient.PROPAGATE_TEST_SUITES_SCRIPT;
import static org.openmetadata.service.search.SearchClient.REMOVE_DATA_PRODUCTS_CHILDREN_SCRIPT;
import static org.openmetadata.service.search.SearchClient.REMOVE_DOMAINS_CHILDREN_SCRIPT;
import static org.openmetadata.service.search.SearchClient.REMOVE_DOMAINS_SCRIPT;
import static org.openmetadata.service.search.SearchClient.REMOVE_ENTITY_RELATIONSHIP;
import static org.openmetadata.service.search.SearchClient.REMOVE_FOLLOWERS_SCRIPT;
import static org.openmetadata.service.search.SearchClient.REMOVE_OWNERS_SCRIPT;
import static org.openmetadata.service.search.SearchClient.REMOVE_PROPAGATED_ENTITY_REFERENCE_FIELD_SCRIPT;
import static org.openmetadata.service.search.SearchClient.REMOVE_PROPAGATED_FIELD_SCRIPT;
import static org.openmetadata.service.search.SearchClient.REMOVE_TAGS_CHILDREN_SCRIPT;
import static org.openmetadata.service.search.SearchClient.REMOVE_TEST_SUITE_CHILDREN_SCRIPT;
import static org.openmetadata.service.search.SearchClient.SOFT_DELETE_RESTORE_SCRIPT;
import static org.openmetadata.service.search.SearchClient.UPDATE_ADDED_DELETE_GLOSSARY_TAGS;
import static org.openmetadata.service.search.SearchClient.UPDATE_CERTIFICATION_SCRIPT;
import static org.openmetadata.service.search.SearchClient.UPDATE_PROPAGATED_ENTITY_REFERENCE_FIELD_SCRIPT;
import static org.openmetadata.service.search.SearchClient.UPDATE_TAGS_FIELD_SCRIPT;
import static org.openmetadata.service.search.SearchConstants.DOMAINS_ID;
import static org.openmetadata.service.search.SearchConstants.ENTITY_TYPE;
import static org.openmetadata.service.search.SearchConstants.FAILED_TO_CREATE_INDEX_MESSAGE;
import static org.openmetadata.service.search.SearchConstants.FULLY_QUALIFIED_NAME;
import static org.openmetadata.service.search.SearchConstants.HITS;
import static org.openmetadata.service.search.SearchConstants.ID;
import static org.openmetadata.service.search.SearchConstants.PARENT;
import static org.openmetadata.service.search.SearchConstants.PARENT_ID;
import static org.openmetadata.service.search.SearchConstants.SEARCH_SOURCE;
import static org.openmetadata.service.search.SearchConstants.SERVICE_ID;
import static org.openmetadata.service.search.SearchConstants.TAGS_FQN;
import static org.openmetadata.service.search.SearchConstants.TEST_SUITES;
import static org.openmetadata.service.search.SearchUtils.isConnectedVia;
import static org.openmetadata.service.util.EntityUtil.compareEntityReferenceById;
import static org.openmetadata.service.util.EntityUtil.isNullOrEmptyChangeDescription;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import io.micrometer.core.instrument.Metrics;
import io.micrometer.core.instrument.Tags;
import io.micrometer.core.instrument.Timer;
import jakarta.json.JsonObject;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.tuple.ImmutablePair;
import org.apache.commons.lang3.tuple.Pair;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.EntityTimeSeriesInterface;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.schema.api.entityRelationship.SearchEntityRelationshipRequest;
import org.openmetadata.schema.api.entityRelationship.SearchEntityRelationshipResult;
import org.openmetadata.schema.api.lineage.EntityCountLineageRequest;
import org.openmetadata.schema.api.lineage.LineagePaginationInfo;
import org.openmetadata.schema.api.lineage.SearchLineageRequest;
import org.openmetadata.schema.api.lineage.SearchLineageResult;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.dataInsight.DataInsightChartResult;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.PipelineStatus;
import org.openmetadata.schema.entity.data.QueryCostSearchResult;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.search.AggregationRequest;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.service.configuration.elasticsearch.NaturalLanguageSearchConfiguration;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.tests.DataQualityReport;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.AssetCertification;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.UsageDetails;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.search.IndexMappingLoader;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.BulkSink;
import org.openmetadata.service.apps.bundles.searchIndex.ElasticSearchBulkSink;
import org.openmetadata.service.apps.bundles.searchIndex.OpenSearchBulkSink;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventDispatcher;
import org.openmetadata.service.events.lifecycle.handlers.SearchIndexHandler;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.monitoring.RequestLatencyContext;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.search.elasticsearch.ElasticSearchClient;
import org.openmetadata.service.search.indexes.ColumnSearchIndex;
import org.openmetadata.service.search.indexes.PipelineExecutionIndex;
import org.openmetadata.service.search.indexes.SearchIndex;
import org.openmetadata.service.search.nlq.NLQService;
import org.openmetadata.service.search.nlq.NLQServiceFactory;
import org.openmetadata.service.search.opensearch.OpenSearchClient;
import org.openmetadata.service.search.vector.OpenSearchVectorService;
import org.openmetadata.service.search.vector.VectorEmbeddingHandler;
import org.openmetadata.service.search.vector.VectorIndexService;
import org.openmetadata.service.search.vector.client.BedrockEmbeddingClient;
import org.openmetadata.service.search.vector.client.DjlEmbeddingClient;
import org.openmetadata.service.search.vector.client.EmbeddingClient;
import org.openmetadata.service.search.vector.client.OpenAIEmbeddingClient;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.workflows.searchIndex.ReindexingUtil;

@Slf4j
public class SearchRepository {

  private volatile SearchClient searchClient;

  @Getter private Map<String, IndexMapping> entityIndexMap;

  private final String language;

  @Getter @Setter public SearchIndexFactory searchIndexFactory = new SearchIndexFactory();

  private static final Set<String> SERVICE_ENTITY_SET =
      Set.of(
          Entity.DATABASE_SERVICE,
          Entity.DASHBOARD_SERVICE,
          Entity.MESSAGING_SERVICE,
          Entity.PIPELINE_SERVICE,
          Entity.MLMODEL_SERVICE,
          Entity.STORAGE_SERVICE,
          Entity.SEARCH_SERVICE,
          Entity.SECURITY_SERVICE,
          Entity.API_SERVICE,
          Entity.DRIVE_SERVICE);

  private final List<String> inheritableFields =
      List.of(
          FIELD_OWNERS,
          FIELD_DOMAINS,
          FIELD_FOLLOWERS,
          Entity.FIELD_DISABLED,
          Entity.FIELD_TEST_SUITES,
          FIELD_DISPLAY_NAME);
  private final List<String> propagateFields = List.of(Entity.FIELD_TAGS);

  /**
   * Fields currently supported by {@link #getScriptWithParams(EntityInterface, Map, ChangeDescription)}.
   *
   * <p>When a non-versioned update touches any other field, we must fall back to full document
   * indexing to avoid stale search documents.
   */
  private static final Set<String> PARTIAL_SCRIPT_SUPPORTED_FIELDS =
      Set.of(
          FIELD_DESCRIPTION,
          FIELD_FOLLOWERS,
          FIELD_USAGE_SUMMARY,
          "extension",
          "queryUsedIn",
          "votes",
          "pipelineStatus",
          TEST_SUITES);

  @Getter private final ElasticSearchConfiguration searchConfiguration;
  @Getter private final int maxDBConnections;

  @Getter private final String clusterAlias;

  @Getter
  public final List<String> dataInsightReports =
      List.of(
          ENTITY_REPORT_DATA,
          WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA,
          WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA,
          RAW_COST_ANALYSIS_REPORT_DATA,
          AGGREGATED_COST_ANALYSIS_REPORT_DATA);

  public static final String ELASTIC_SEARCH_EXTENSION = "service.eventPublisher";

  protected NLQService nlqService;

  @Getter private EmbeddingClient embeddingClient;
  @Getter private VectorIndexService vectorIndexService;
  @Getter private VectorEmbeddingHandler vectorEmbeddingHandler;
  private volatile boolean vectorServiceInitialized = false;

  public SearchRepository(ElasticSearchConfiguration config, int maxDBConnections) {
    this.maxDBConnections = maxDBConnections;
    searchConfiguration = config;
    searchClient = buildSearchClient(searchConfiguration);
    searchIndexFactory = buildIndexFactory();
    language =
        searchConfiguration != null && searchConfiguration.getSearchIndexMappingLanguage() != null
            ? searchConfiguration.getSearchIndexMappingLanguage().value()
            : "en";
    clusterAlias = searchConfiguration != null ? searchConfiguration.getClusterAlias() : "";
    loadIndexMappings();
    registerSearchIndexHandler();
  }

  /**
   * Register the SearchIndexHandler as the primary handler for search indexing operations.
   * This handler will handle the actual search indexing when entities are created/updated/deleted.
   */
  private void registerSearchIndexHandler() {
    try {
      SearchIndexHandler searchHandler = new SearchIndexHandler(this);
      EntityLifecycleEventDispatcher.getInstance().registerHandler(searchHandler);
      LOG.info("Successfully registered SearchIndexHandler for entity lifecycle events");
    } catch (Exception e) {
      LOG.error("Failed to register SearchIndexHandler", e);
    }
  }

  public SearchClient getSearchClient() {
    if (searchClient == null) {
      synchronized (SearchRepository.class) {
        if (searchClient == null) {
          searchClient = buildSearchClient(searchConfiguration);
        }
      }
    }
    return searchClient;
  }

  private void loadIndexMappings() {
    IndexMappingLoader mappingLoader = IndexMappingLoader.getInstance();
    entityIndexMap = mappingLoader.getIndexMapping();
  }

  public SearchClient buildSearchClient(ElasticSearchConfiguration config) {
    SearchClient sc;

    // Initialize NLQ service first
    initializeNLQService(config);

    if (config != null
        && config.getSearchType() == ElasticSearchConfiguration.SearchType.OPENSEARCH) {
      sc = new OpenSearchClient(config, nlqService);
    } else {
      sc = new ElasticSearchClient(config, nlqService);
    }
    return sc;
  }

  public SearchIndexFactory buildIndexFactory() {
    return new SearchIndexFactory();
  }

  public ElasticSearchConfiguration.SearchType getSearchType() {
    return searchClient.getSearchType();
  }

  public void createIndexes() {
    RecreateIndexHandler recreateIndexHandler = this.createReindexHandler();
    ReindexContext context = recreateIndexHandler.reCreateIndexes(entityIndexMap.keySet());
    if (context != null) {
      for (String entityType : context.getEntities()) {
        try {
          String originalIndex = context.getOriginalIndex(entityType).orElse(null);
          String canonicalIndex = context.getCanonicalIndex(entityType).orElse(null);
          String activeIndex = context.getOriginalIndex(entityType).orElse(null);
          String stagedIndex = context.getStagedIndex(entityType).orElse(null);
          String canonicalAlias = context.getCanonicalAlias(entityType).orElse(null);
          Set<String> existingAliases = context.getExistingAliases(entityType);
          Set<String> parentAliases =
              new HashSet<>(listOrEmpty(context.getParentAliases(entityType)));

          EntityReindexContext entityReindexContext =
              EntityReindexContext.builder()
                  .entityType(entityType)
                  .originalIndex(originalIndex)
                  .canonicalIndex(canonicalIndex)
                  .activeIndex(activeIndex)
                  .stagedIndex(stagedIndex)
                  .canonicalAliases(canonicalAlias)
                  .existingAliases(existingAliases)
                  .parentAliases(parentAliases)
                  .build();
          recreateIndexHandler.finalizeReindex(entityReindexContext, true);

        } catch (Exception ex) {
          LOG.error("Failed to recreate index for entity {}", entityType, ex);
        }
      }
    }
  }

  public void updateIndexes() {
    for (Map.Entry<String, IndexMapping> entry : entityIndexMap.entrySet()) {
      updateIndex(entry.getValue());
    }
  }

  public void createMissingIndexes() {
    LOG.info("Checking for missing search indexes...");
    int created = 0;
    for (Map.Entry<String, IndexMapping> entry : entityIndexMap.entrySet()) {
      try {
        if (!indexExists(entry.getValue())) {
          createIndex(entry.getValue());
          created++;
          LOG.info("Created missing index for entity type: {}", entry.getKey());
        }
      } catch (Exception e) {
        LOG.warn("Failed to create missing index for {}: {}", entry.getKey(), e.getMessage());
      }
    }
    if (created > 0) {
      LOG.info(
          "Created {} missing indexes out of {} total entity types",
          created,
          entityIndexMap.size());
    } else {
      LOG.info("All {} indexes already exist", entityIndexMap.size());
    }
  }

  public void createOrUpdateIndexTemplates() {
    LOG.info("Creating/updating index templates for all entities...");
    int success = 0;
    int failed = 0;
    for (Map.Entry<String, IndexMapping> entry : entityIndexMap.entrySet()) {
      try {
        IndexMapping indexMapping = entry.getValue();
        String indexName = indexMapping.getIndexName(clusterAlias);
        String templateName = "om_" + indexName;
        String indexPattern = indexName + "*";
        String mappingContent = readIndexMapping(indexMapping);
        if (mappingContent != null) {
          searchClient.createOrUpdateIndexTemplate(templateName, indexPattern, mappingContent);
          success++;
        } else {
          failed++;
          LOG.warn("No mapping content found for entity type: {}", entry.getKey());
        }
      } catch (Exception e) {
        failed++;
        LOG.warn("Failed to create index template for {}: {}", entry.getKey(), e.getMessage());
      }
    }
    LOG.info(
        "Index templates creation completed. Success: {}, Failed: {}, Total: {}",
        success,
        failed,
        entityIndexMap.size());
  }

  public void createOrUpdateIndexTemplate(String entityType) throws IOException {
    IndexMapping indexMapping = entityIndexMap.get(entityType);
    if (indexMapping == null) {
      throw new IllegalArgumentException("No index mapping found for entity type: " + entityType);
    }
    String indexName = indexMapping.getIndexName(clusterAlias);
    String templateName = "om_" + indexName;
    String indexPattern = indexName + "*";
    String mappingContent = readIndexMapping(indexMapping);
    if (mappingContent == null) {
      throw new IllegalArgumentException("No mapping content found for entity type: " + entityType);
    }
    searchClient.createOrUpdateIndexTemplate(templateName, indexPattern, mappingContent);
    LOG.info("Created/updated index template '{}' for entity type '{}'", templateName, entityType);
  }

  public void prepareForReindex() {
    initializeVectorSearchService();
  }

  public synchronized void initializeVectorSearchService() {
    if (vectorServiceInitialized) {
      return;
    }

    ElasticSearchConfiguration cfg = getSearchConfiguration();
    if (!isVectorEmbeddingEnabled()) {
      LOG.info("Vector embedding is not enabled, skipping initialization");
      return;
    }

    try {
      this.embeddingClient = createEmbeddingClient(cfg);

      if (cfg.getSearchType() == ElasticSearchConfiguration.SearchType.OPENSEARCH) {
        os.org.opensearch.client.opensearch.OpenSearchClient osClient =
            ((OpenSearchClient) getSearchClient()).getNewClient();
        OpenSearchVectorService.init(osClient, embeddingClient);
        this.vectorIndexService = OpenSearchVectorService.getInstance();
      } else {
        LOG.warn(
            "Vector embedding is only supported with OpenSearch. Elasticsearch support is planned.");
        return;
      }

      this.vectorEmbeddingHandler = new VectorEmbeddingHandler(vectorIndexService);

      vectorServiceInitialized = true;

      ensureHybridSearchPipeline();

      LOG.info(
          "Vector search service initialized with provider={}, dimension={}",
          cfg.getNaturalLanguageSearch().getEmbeddingProvider(),
          embeddingClient.getDimension());
    } catch (Exception e) {
      LOG.error("Failed to initialize vector search service: {}", e.getMessage(), e);
    }
  }

  public void ensureHybridSearchPipeline() {
    if (!isVectorEmbeddingEnabled() || !vectorServiceInitialized) {
      return;
    }

    ElasticSearchConfiguration cfg = getSearchConfiguration();
    NaturalLanguageSearchConfiguration nlConfig = cfg.getNaturalLanguageSearch();
    double keywordWeight = nlConfig.getKeywordWeight() != null ? nlConfig.getKeywordWeight() : 0.6;
    double semanticWeight =
        nlConfig.getSemanticWeight() != null ? nlConfig.getSemanticWeight() : 0.4;

    try {
      SearchSettings ss =
          SettingsCache.getSetting(SettingsType.SEARCH_SETTINGS, SearchSettings.class);
      if (ss != null && ss.getGlobalSettings() != null) {
        if (ss.getGlobalSettings().getKeywordWeight() != null) {
          keywordWeight = ss.getGlobalSettings().getKeywordWeight();
        }
        if (ss.getGlobalSettings().getSemanticWeight() != null) {
          semanticWeight = ss.getGlobalSettings().getSemanticWeight();
        }
      }
    } catch (Exception e) {
      LOG.warn("Failed to load hybrid weights from Settings, using config defaults", e);
    }

    updateHybridSearchPipeline(keywordWeight, semanticWeight);
  }

  public void updateHybridSearchPipeline(double keywordWeight, double semanticWeight) {
    if (vectorIndexService instanceof OpenSearchVectorService openSearchVectorService) {
      openSearchVectorService.ensureHybridSearchPipeline(keywordWeight, semanticWeight);
    } else {
      LOG.warn("Hybrid search pipeline update is only supported with OpenSearch");
    }
  }

  public IndexMapping getIndexMapping(String entityType) {
    return entityIndexMap.get(entityType);
  }

  public String getIndexOrAliasName(String name) {
    if (clusterAlias == null || clusterAlias.isEmpty()) {
      return name;
    }
    return Arrays.stream(name.split(","))
        .map(index -> clusterAlias + INDEX_NAME_SEPARATOR + index.trim())
        .collect(Collectors.joining(","));
  }

  private static final Map<String, Set<String>> RBAC_CHILD_TYPES =
      Map.of(Entity.TABLE, Set.of(Entity.TABLE_COLUMN));

  public List<String> getChildIndexAliases(String entityType) {
    Set<String> rbacChildren = RBAC_CHILD_TYPES.getOrDefault(entityType, Set.of());
    List<String> aliases = new ArrayList<>();
    for (String childEntityType : rbacChildren) {
      IndexMapping childMapping = entityIndexMap.get(childEntityType);
      if (childMapping != null) {
        String alias = childMapping.getAlias(null);
        if (alias != null) {
          aliases.add(alias);
        }
      }
    }
    return aliases;
  }

  public String getIndexNameWithoutAlias(String fullIndexName) {
    if (clusterAlias != null
        && !clusterAlias.isEmpty()
        && fullIndexName.startsWith(clusterAlias + INDEX_NAME_SEPARATOR)) {
      return fullIndexName.substring((clusterAlias + INDEX_NAME_SEPARATOR).length());
    }
    return fullIndexName;
  }

  public boolean indexExists(IndexMapping indexMapping) {
    String indexName = indexMapping.getIndexName(clusterAlias);
    if (searchClient.indexExists(indexName)) {
      return true;
    }
    return !searchClient.getIndicesByAlias(indexName).isEmpty();
  }

  public void createIndex(IndexMapping indexMapping) {
    try {
      String indexName = indexMapping.getIndexName(clusterAlias);
      if (!indexExists(indexMapping)) {
        // Clean up any lingering alias with the same name
        Set<String> aliasTargets = searchClient.getIndicesByAlias(indexName);
        for (String target : aliasTargets) {
          searchClient.removeAliases(target, Set.of(indexName));
          searchClient.deleteIndex(target);
        }

        String indexMappingContent = readIndexMapping(indexMapping);
        searchClient.createIndex(indexMapping, indexMappingContent);
        searchClient.createAliases(indexMapping);
      }
    } catch (Exception e) {
      LOG.error(
          String.format(FAILED_TO_CREATE_INDEX_MESSAGE),
          indexMapping.getIndexName(clusterAlias),
          e);
    }
  }

  public void updateIndex(IndexMapping indexMapping) {
    try {
      String indexMappingContent = readIndexMapping(indexMapping);
      if (indexExists(indexMapping)) {
        searchClient.updateIndex(indexMapping, indexMappingContent);
      } else {
        searchClient.createIndex(indexMapping, indexMappingContent);
      }
      searchClient.createAliases(indexMapping);
    } catch (Exception e) {
      LOG.warn("Failed to Update Index for entity {}", indexMapping.getIndexName(clusterAlias));
    }
  }

  public void deleteIndex(IndexMapping indexMapping) {
    try {
      String indexName = indexMapping.getIndexName(clusterAlias);
      if (searchClient.indexExists(indexName)) {
        searchClient.deleteIndex(indexMapping);
      } else {
        Set<String> aliasTargets = searchClient.getIndicesByAlias(indexName);
        for (String target : aliasTargets) {
          searchClient.removeAliases(target, Set.of(indexName));
          searchClient.deleteIndex(target);
        }
      }
    } catch (Exception e) {
      LOG.error(
          String.format(
              "Failed to Delete Index for entity %s due to ",
              indexMapping.getIndexName(clusterAlias)),
          e);
    }
  }

  private String getIndexMapping(IndexMapping indexMapping) {
    try (InputStream in =
        getClass()
            .getResourceAsStream(
                String.format(indexMapping.getIndexMappingFile(), language.toLowerCase()))) {
      assert in != null;
      return new String(in.readAllBytes());
    } catch (Exception e) {
      LOG.error("Failed to read index Mapping file due to ", e);
    }
    return null;
  }

  public String readIndexMapping(IndexMapping indexMapping) {
    String mapping = getIndexMapping(indexMapping);
    if (isVectorEmbeddingEnabled() && embeddingClient != null && mapping != null) {
      mapping = reformatVectorIndexWithDimension(mapping, embeddingClient.getDimension());
    }
    return mapping;
  }

  /**
   * Create search index for an entity only (no lifecycle events).
   * This method is used by SearchIndexHandler.
   */
  public void createEntityIndex(EntityInterface entity) {
    if (entity == null) {
      LOG.warn("Entity is null, cannot create index.");
      return;
    }

    if (!checkIfIndexingIsSupported(entity.getEntityReference().getType())) {
      LOG.debug(
          "Indexing is not supported for entity type: {}", entity.getEntityReference().getType());
      return;
    }

    String entityId = entity.getId().toString();
    String entityType = entity.getEntityReference().getType();
    Timer.Sample searchSample = RequestLatencyContext.startSearchOperation();
    if (shouldSkipStreamingIndexing(
        entityType, entityId, entity.getFullyQualifiedName(), "createEntityIndex")) {
      return;
    }
    try {
      IndexMapping indexMapping = entityIndexMap.get(entityType);
      SearchIndex index = searchIndexFactory.buildIndex(entityType, entity);
      String doc = JsonUtils.pojoToJson(index.buildSearchIndexDoc());
      searchClient.createEntity(indexMapping.getIndexName(clusterAlias), entityId, doc);

      if (Entity.TABLE.equals(entityType)) {
        indexTableColumns((Table) entity);
      }
    } catch (Exception ie) {
      SearchIndexRetryQueue.enqueue(
          entityId,
          entity.getFullyQualifiedName(),
          SearchIndexRetryQueue.failureReason("createEntityIndex", ie));
      LOG.error(
          "Issue creating new search document for entity [{}] and entityType [{}]",
          entityId,
          entityType,
          ie);
    } finally {
      RequestLatencyContext.endSearchOperation(searchSample);
    }
  }

  private void indexTableColumns(Table table) {
    if (table.getColumns() == null || table.getColumns().isEmpty()) {
      return;
    }

    IndexMapping columnIndexMapping = entityIndexMap.get(Entity.TABLE_COLUMN);
    if (columnIndexMapping == null) {
      LOG.debug("Column index mapping not found, skipping column indexing");
      return;
    }

    List<Column> flattenedColumns = ColumnSearchIndex.flattenColumns(table.getColumns());
    List<Map<String, String>> docs = new ArrayList<>();

    for (Column column : flattenedColumns) {
      try {
        ColumnSearchIndex columnIndex = new ColumnSearchIndex(column, table);
        String doc = JsonUtils.pojoToJson(columnIndex.buildSearchIndexDoc());
        String columnId = ColumnSearchIndex.generateColumnId(column.getFullyQualifiedName());
        docs.add(Collections.singletonMap(columnId, doc));
      } catch (Exception e) {
        LOG.error(
            "Issue indexing column [{}] for table [{}]: {}",
            column.getFullyQualifiedName(),
            table.getFullyQualifiedName(),
            e.getMessage());
      }
    }

    if (!docs.isEmpty()) {
      try {
        searchClient.createEntities(columnIndexMapping.getIndexName(clusterAlias), docs);
      } catch (Exception e) {
        LOG.error(
            "Issue bulk indexing columns for table [{}]: {}",
            table.getFullyQualifiedName(),
            e.getMessage());
        if (e instanceof RuntimeException re) {
          throw re;
        }
        throw new RuntimeException(e);
      }
    }
  }

  private void deleteTableColumns(Table table) {
    IndexMapping columnIndexMapping = entityIndexMap.get(Entity.TABLE_COLUMN);
    if (columnIndexMapping == null) {
      return;
    }

    try {
      searchClient.deleteEntityByFields(
          List.of(columnIndexMapping.getIndexName(clusterAlias)),
          List.of(new ImmutablePair<>("table.id", table.getId().toString())));
    } catch (Exception e) {
      LOG.error(
          "Issue deleting columns for table [{}]: {}",
          table.getFullyQualifiedName(),
          e.getMessage());
      if (e instanceof RuntimeException re) {
        throw re;
      }
      throw new RuntimeException(e);
    }
  }

  private void syncTableColumns(Table table, ChangeDescription changeDescription) {
    // Check if columns were actually modified
    boolean columnsChanged = hasColumnsChanged(changeDescription);

    if (columnsChanged) {
      // Columns were added/removed/modified - do full reindex
      deleteTableColumns(table);
      indexTableColumns(table);
    } else {
      // Only inherited fields changed - use efficient update
      updateTableColumnsInheritedFields(table);
    }
  }

  private boolean hasColumnsChanged(ChangeDescription changeDescription) {
    if (changeDescription == null) {
      return true; // Default to full reindex if no change description
    }

    return listOrEmpty(changeDescription.getFieldsAdded()).stream()
            .anyMatch(field -> field.getName().startsWith(Entity.FIELD_COLUMNS))
        || listOrEmpty(changeDescription.getFieldsUpdated()).stream()
            .anyMatch(field -> field.getName().startsWith(Entity.FIELD_COLUMNS))
        || listOrEmpty(changeDescription.getFieldsDeleted()).stream()
            .anyMatch(field -> field.getName().startsWith(Entity.FIELD_COLUMNS));
  }

  private void updateTableColumnsInheritedFields(Table table) {
    IndexMapping columnIndexMapping = entityIndexMap.get(Entity.TABLE_COLUMN);
    if (columnIndexMapping == null) {
      return;
    }

    try {
      // Build the inherited fields update map
      Map<String, Object> inheritedFields = new HashMap<>();

      // Update table reference fields
      Map<String, Object> tableRef = new HashMap<>();
      tableRef.put("id", table.getId().toString());
      tableRef.put("name", table.getName());
      tableRef.put(
          "displayName",
          table.getDisplayName() != null && !table.getDisplayName().isBlank()
              ? table.getDisplayName()
              : table.getName());
      tableRef.put("fullyQualifiedName", table.getFullyQualifiedName());
      tableRef.put("description", table.getDescription());
      tableRef.put("deleted", table.getDeleted());
      tableRef.put("type", Entity.TABLE);
      inheritedFields.put("table", tableRef);

      // Update inherited fields from table
      inheritedFields.put("deleted", table.getDeleted() != null && table.getDeleted());
      inheritedFields.put("updatedAt", table.getUpdatedAt());
      inheritedFields.put("updatedBy", table.getUpdatedBy());
      inheritedFields.put("version", table.getVersion());

      if (table.getService() != null) {
        inheritedFields.put("service", SearchIndexUtils.toEntityRefMap(table.getService()));
      }
      if (table.getDatabase() != null) {
        inheritedFields.put("database", SearchIndexUtils.toEntityRefMap(table.getDatabase()));
      }
      if (table.getDatabaseSchema() != null) {
        inheritedFields.put(
            "databaseSchema", SearchIndexUtils.toEntityRefMap(table.getDatabaseSchema()));
      }
      if (table.getServiceType() != null) {
        inheritedFields.put("serviceType", table.getServiceType().toString());
      }
      if (table.getOwners() != null) {
        inheritedFields.put("owners", buildEntityRefListWithDisplayName(table.getOwners()));
      }
      if (table.getDomains() != null) {
        inheritedFields.put("domains", buildEntityRefListWithDisplayName(table.getDomains()));
      }
      if (table.getFollowers() != null) {
        inheritedFields.put("followers", SearchIndexUtils.parseFollowers(table.getFollowers()));
      }

      int totalVotes =
          nullOrEmpty(table.getVotes())
              ? 0
              : Math.max(table.getVotes().getUpVotes() - table.getVotes().getDownVotes(), 0);
      inheritedFields.put("totalVotes", totalVotes);

      // Use updateChildren to efficiently update all columns for this table
      searchClient.updateChildren(
          List.of(columnIndexMapping.getIndexName(clusterAlias)),
          new ImmutablePair<>("table.id", table.getId().toString()),
          new ImmutablePair<>(DEFAULT_UPDATE_SCRIPT, inheritedFields));

      LOG.debug(
          "Efficiently updated inherited fields for columns of table [{}]",
          table.getFullyQualifiedName());
    } catch (Exception e) {
      LOG.error(
          "Issue updating inherited fields for columns of table [{}]: {}. Falling back to full reindex.",
          table.getFullyQualifiedName(),
          e.getMessage());
      try {
        deleteTableColumns(table);
        indexTableColumns(table);
      } catch (Exception fallbackEx) {
        LOG.error(
            "Fallback column reindex also failed for [{}]",
            table.getFullyQualifiedName(),
            fallbackEx);
      }
    }
  }

  private List<Map<String, Object>> buildEntityRefListWithDisplayName(
      List<EntityReference> entities) {
    if (nullOrEmpty(entities)) {
      return Collections.emptyList();
    }
    return entities.stream().map(SearchIndexUtils::toEntityRefMap).toList();
  }

  /**
   * Create search indexes for multiple entities only (no lifecycle events).
   * This method is used by SearchIndexHandler.
   */
  public void createEntitiesIndex(List<EntityInterface> entities) throws IOException {
    if (!nullOrEmpty(entities)) {
      String entityType = entities.getFirst().getEntityReference().getType();
      Timer.Sample searchSample = RequestLatencyContext.startSearchOperation();
      try {
        if (SearchIndexRetryQueue.isEntityTypeSuspended(entityType)) {
          LOG.debug(
              "Skipping live search indexing for {} entities because reindex is active for {}",
              entities.size(),
              entityType);
          return;
        }
        if (!getSearchClient().isClientAvailable()) {
          for (EntityInterface entity : entities) {
            SearchIndexRetryQueue.enqueue(
                entity.getId() != null ? entity.getId().toString() : null,
                entity.getFullyQualifiedName(),
                "createEntitiesIndex: Search client unavailable");
          }
          return;
        }
        IndexMapping indexMapping = entityIndexMap.get(entityType);
        List<Map<String, String>> docs = new ArrayList<>();
        for (EntityInterface entity : entities) {
          try {
            SearchIndex index = searchIndexFactory.buildIndex(entityType, entity);
            String doc = JsonUtils.pojoToJson(index.buildSearchIndexDoc());
            docs.add(Collections.singletonMap(entity.getId().toString(), doc));
          } catch (Exception ie) {
            LOG.error(
                "Issue in building search document for entity [{}] and entityType [{}]",
                entity.getId(),
                entityType,
                ie);
          }
        }

        if (docs.isEmpty()) {
          return;
        }

        searchClient.createEntities(indexMapping.getIndexName(clusterAlias), docs);

        if (Entity.TABLE.equals(entityType)) {
          indexColumnsForTables(entities);
        }
      } finally {
        RequestLatencyContext.endSearchOperation(searchSample);
      }
    }
  }

  private static final int COLUMN_BATCH_SIZE = 500;

  private void indexColumnsForTables(List<EntityInterface> entities) {
    IndexMapping columnIndexMapping = entityIndexMap.get(Entity.TABLE_COLUMN);
    if (columnIndexMapping == null) {
      return;
    }

    String indexName = columnIndexMapping.getIndexName(clusterAlias);
    List<Map<String, String>> allColumnDocs = new ArrayList<>();

    for (EntityInterface entity : entities) {
      Table table = (Table) entity;
      if (table.getColumns() == null || table.getColumns().isEmpty()) {
        continue;
      }

      List<Column> flattenedColumns = ColumnSearchIndex.flattenColumns(table.getColumns());
      for (Column column : flattenedColumns) {
        try {
          ColumnSearchIndex columnIndex = new ColumnSearchIndex(column, table);
          String doc = JsonUtils.pojoToJson(columnIndex.buildSearchIndexDoc());
          String columnId = ColumnSearchIndex.generateColumnId(column.getFullyQualifiedName());
          allColumnDocs.add(Collections.singletonMap(columnId, doc));

          if (allColumnDocs.size() >= COLUMN_BATCH_SIZE) {
            searchClient.createEntities(indexName, allColumnDocs);
            allColumnDocs.clear();
          }
        } catch (Exception e) {
          LOG.error(
              "Issue indexing column [{}] for table [{}]: {}",
              column.getFullyQualifiedName(),
              table.getFullyQualifiedName(),
              e.getMessage());
        }
      }
    }

    if (!allColumnDocs.isEmpty()) {
      try {
        searchClient.createEntities(indexName, allColumnDocs);
      } catch (Exception e) {
        LOG.error("Issue bulk indexing columns: {}", e.getMessage());
      }
    }
  }

  /**
   * Create search indexes for multiple entities and dispatch lifecycle events.
   * This method maintains backward compatibility.
   */
  public void createEntities(List<EntityInterface> entities) throws IOException {
    // For backward compatibility, just call the index-only method
    // EntityRepository now handles lifecycle event dispatching
    createEntitiesIndex(entities);
  }

  public void createTimeSeriesEntity(EntityTimeSeriesInterface entity) {
    if (entity != null) {
      String entityType;
      if (entity instanceof ReportData reportData) {
        // Report data type is an entity itself where each report data type has its own index
        entityType = reportData.getReportDataType().toString();
      } else {
        entityType = entity.getEntityReference().getType();
      }
      String entityId = entity.getId().toString();
      Timer.Sample searchSample = RequestLatencyContext.startSearchOperation();
      try {
        IndexMapping indexMapping = entityIndexMap.get(entityType);
        SearchIndex index = searchIndexFactory.buildIndex(entityType, entity);
        String doc = JsonUtils.pojoToJson(index.buildSearchIndexDoc());
        searchClient.createTimeSeriesEntity(indexMapping.getIndexName(clusterAlias), entityId, doc);
      } catch (Exception ie) {
        SearchIndexRetryQueue.enqueue(
            entityId,
            entity.getEntityReference() != null
                ? entity.getEntityReference().getFullyQualifiedName()
                : null,
            entityType,
            SearchIndexRetryQueue.failureReason("createTimeSeriesEntity", ie));
        LOG.error(
            "Issue creating new search document for entity [{}] and entityType [{}]",
            entityId,
            entityType,
            ie);
      } finally {
        RequestLatencyContext.endSearchOperation(searchSample);
      }
    }
  }

  public void updateTimeSeriesEntity(EntityTimeSeriesInterface entityTimeSeries) {
    if (entityTimeSeries != null) {
      String entityType = entityTimeSeries.getEntityReference().getType();
      String entityId = entityTimeSeries.getId().toString();
      Timer.Sample searchSample = RequestLatencyContext.startSearchOperation();
      try {
        IndexMapping indexMapping = entityIndexMap.get(entityType);
        SearchIndex elasticSearchIndex =
            searchIndexFactory.buildIndex(entityType, entityTimeSeries);
        Map<String, Object> doc = elasticSearchIndex.buildSearchIndexDoc();
        searchClient.updateEntity(
            indexMapping.getIndexName(clusterAlias), entityId, doc, DEFAULT_UPDATE_SCRIPT);
      } catch (RuntimeException e) {
        SearchIndexRetryQueue.enqueue(
            entityId,
            entityTimeSeries.getEntityReference() != null
                ? entityTimeSeries.getEntityReference().getFullyQualifiedName()
                : null,
            entityType,
            SearchIndexRetryQueue.failureReason("updateTimeSeriesEntity", e));
        LOG.error(
            "Issue updating the search document for entity [{}] and entityType [{}]",
            entityId,
            entityType,
            e);
      } finally {
        RequestLatencyContext.endSearchOperation(searchSample);
      }
    }
  }

  /**
   * Update search index for an entity only (no lifecycle events).
   * This method is used by SearchIndexHandler.
   */
  public void updateEntityIndex(EntityInterface entity) {
    if (entity == null) {
      LOG.warn("Entity is null, cannot update index.");
      return;
    }

    if (!checkIfIndexingIsSupported(entity.getEntityReference().getType())) {
      LOG.debug(
          "Indexing is not supported for entity type: {}", entity.getEntityReference().getType());
      return;
    }

    String entityType = entity.getEntityReference().getType();
    String entityId = entity.getId().toString();
    if (shouldSkipStreamingIndexing(
        entityType, entityId, entity.getFullyQualifiedName(), "updateEntityIndex")) {
      return;
    }

    // Start timing search operation
    Timer.Sample searchSample = RequestLatencyContext.startSearchOperation();
    long startTime = System.currentTimeMillis();

    try {
      IndexMapping indexMapping = entityIndexMap.get(entityType);
      String scriptTxt = DEFAULT_UPDATE_SCRIPT;
      Map<String, Object> doc = new HashMap<>();

      ChangeDescription incrementalChangeDescription = entity.getIncrementalChangeDescription();
      ChangeDescription changeDescription;

      if (!isNullOrEmptyChangeDescription(incrementalChangeDescription)) {
        changeDescription = incrementalChangeDescription;
      } else {
        changeDescription = entity.getChangeDescription();
      }

      boolean isNonVersionedUpdate =
          changeDescription != null
              && entity.getChangeDescription() != null
              && Objects.equals(
                  entity.getVersion(), entity.getChangeDescription().getPreviousVersion());
      if (isNonVersionedUpdate && canUseScriptedPartialUpdate(changeDescription)) {
        scriptTxt = getScriptWithParams(entity, doc, changeDescription);
      } else {
        if (isNonVersionedUpdate && changeDescription != null) {
          LOG.debug(
              "Falling back to full document indexing for non-versioned update. entityType={}, entityId={}, changedFields={}",
              entityType,
              entityId,
              getChangedFieldNames(changeDescription));
        }
        SearchIndex elasticSearchIndex = searchIndexFactory.buildIndex(entityType, entity);
        doc = elasticSearchIndex.buildSearchIndexDoc();
      }

      // Use synchronous update to ensure tests pass
      // TODO: Consider using async updates with proper wait mechanisms in tests
      searchClient.updateEntity(indexMapping.getIndexName(clusterAlias), entityId, doc, scriptTxt);

      if (Entity.TABLE.equals(entityType)) {
        try {
          syncTableColumns((Table) entity, changeDescription);
        } catch (Exception e) {
          LOG.error(
              "Column sync failed for [{}], continuing with propagation",
              entity.getFullyQualifiedName(),
              e);
        }
      }

      long updateTime = System.currentTimeMillis() - startTime;

      // Only propagate if fields that affect children have changed
      long propagateTime = 0;
      if (requiresPropagation(changeDescription, entityType, entity)) {
        // Time propagation operations
        startTime = System.currentTimeMillis();
        propagateInheritedFieldsToChildren(
            entityType, entityId, changeDescription, indexMapping, entity);
        propagateGlossaryTags(entityType, entity.getFullyQualifiedName(), changeDescription);
        propagateCertificationTags(entityType, entity, changeDescription);
        propagateToRelatedEntities(entityType, changeDescription, indexMapping, entity);
        propagateTime = System.currentTimeMillis() - startTime;

        LOG.info(
            "Search index update with propagation - entity: {}, type: {}, update: {}ms, propagate: {}ms, total: {}ms",
            entityId,
            entityType,
            updateTime,
            propagateTime,
            updateTime + propagateTime);
      } else {
        LOG.info(
            "Search index update without propagation - entity: {}, type: {}, update: {}ms",
            entityId,
            entityType,
            updateTime);
      }

      // Record search index metrics
      Tags tags = Tags.of("entity_type", entityType, "operation", "update");
      Metrics.timer("search.index.update", tags)
          .record(updateTime, java.util.concurrent.TimeUnit.MILLISECONDS);

      if (propagateTime > 0) {
        Metrics.timer("search.index.propagate", tags)
            .record(propagateTime, java.util.concurrent.TimeUnit.MILLISECONDS);
        Metrics.counter("search.index.propagation.executed", tags).increment();
      } else {
        Metrics.counter("search.index.propagation.skipped", tags).increment();
      }
    } catch (Exception ie) {
      SearchIndexRetryQueue.enqueue(
          entityId,
          entity.getFullyQualifiedName(),
          SearchIndexRetryQueue.failureReason("updateEntityIndex", ie));
      LOG.error(
          "Issue updating the search document for entity [{}] and entityType [{}]",
          entityId,
          entityType,
          ie);
    } finally {
      // End search timing
      if (searchSample != null) {
        RequestLatencyContext.endSearchOperation(searchSample);
      }
    }
  }

  public void bulkIndexPipelineExecutions(
      Pipeline pipeline, List<PipelineStatus> pipelineStatuses) {
    try {
      String indexName = getIndexOrAliasName("pipeline_status_search_index");
      List<Map<String, String>> docsAndIds = new ArrayList<>();
      for (PipelineStatus pipelineStatus : pipelineStatuses) {
        PipelineExecutionIndex pipelineExecutionIndex =
            new PipelineExecutionIndex(pipeline, pipelineStatus);
        Map<String, Object> doc = pipelineExecutionIndex.buildSearchIndexDoc();
        String docId = PipelineExecutionIndex.getDocumentId(pipeline, pipelineStatus);
        String docJson = JsonUtils.pojoToJson(doc);
        docsAndIds.add(Map.of(docId, docJson));
      }
      searchClient.createEntities(indexName, docsAndIds);
      LOG.debug(
          "Bulk indexed {} pipeline executions for {}",
          pipelineStatuses.size(),
          pipeline.getFullyQualifiedName());
    } catch (Exception e) {
      SearchIndexRetryQueue.enqueue(
          pipeline.getId() != null ? pipeline.getId().toString() : null,
          pipeline.getFullyQualifiedName(),
          Entity.PIPELINE,
          SearchIndexRetryQueue.failureReason("bulkIndexPipelineExecutions", e));
      LOG.error("Failed to bulk index pipeline executions in Elasticsearch", e);
    }
  }

  public void updateEntity(EntityReference entityReference) {
    EntityRepository<?> entityRepository = Entity.getEntityRepository(entityReference.getType());
    EntityInterface entity =
        entityRepository.get(null, entityReference.getId(), entityRepository.getFields("*"));
    entity.setChangeDescription(null);
    updateEntityIndex(entity);
  }

  /**
   * Bulk update multiple entities in the search index. This is much more efficient than calling
   * updateEntity() for each entity individually.
   *
   * <p>This method groups entities by type before indexing to ensure each entity goes to the
   * correct index. This is critical during multi-level imports where entities of different types
   * may be batched together.
   *
   * @param entities List of entities to update in the search index
   */
  public void updateEntitiesIndex(List<? extends EntityInterface> entities) {
    if (entities == null || entities.isEmpty()) {
      return;
    }

    // Keep only the latest state per (entityType, entityId) within the same bulk call.
    // This avoids repeated writes/propagation for duplicates in a single request.
    Map<String, EntityInterface> dedupedEntities = new LinkedHashMap<>();
    for (EntityInterface entity : entities) {
      if (entity == null || entity.getId() == null || entity.getEntityReference() == null) {
        continue;
      }
      String entityType = entity.getEntityReference().getType();
      if (nullOrEmpty(entityType)) {
        continue;
      }
      String key = entityType + ":" + entity.getId();
      dedupedEntities.remove(key);
      dedupedEntities.put(key, entity);
    }
    if (dedupedEntities.isEmpty()) {
      return;
    }

    // Group entities by their actual type to ensure each goes to the correct index
    Map<String, List<EntityInterface>> entitiesByType = new HashMap<>();
    for (EntityInterface entity : dedupedEntities.values()) {
      if (entity == null
          || entity.getEntityReference() == null
          || !checkIfIndexingIsSupported(entity.getEntityReference().getType())) {
        continue;
      }

      String actualType = entity.getEntityReference().getType();
      entitiesByType.computeIfAbsent(actualType, k -> new ArrayList<>()).add(entity);
    }

    int batchSize = 100;
    int maxConcurrentRequests = 5;
    long maxPayloadSizeBytes = 10 * 1024 * 1024; // 10MB

    // Process each entity type separately to ensure correct index routing
    for (Map.Entry<String, List<EntityInterface>> entry : entitiesByType.entrySet()) {
      String entityType = entry.getKey();
      List<EntityInterface> typeEntities = entry.getValue();

      if (SearchIndexRetryQueue.isEntityTypeSuspended(entityType)) {
        LOG.debug(
            "Skipping bulk live indexing for {} entities because reindex is active for {}",
            typeEntities.size(),
            entityType);
        continue;
      }

      if (!getSearchClient().isClientAvailable()) {
        for (EntityInterface entity : typeEntities) {
          SearchIndexRetryQueue.enqueue(
              entity.getId() != null ? entity.getId().toString() : null,
              entity.getFullyQualifiedName(),
              "updateEntitiesBulk: Search client unavailable");
        }
        continue;
      }

      BulkSink bulkSink = null;
      try {
        bulkSink = createBulkSink(batchSize, maxConcurrentRequests, maxPayloadSizeBytes);
        Map<String, Object> contextData = new HashMap<>();
        contextData.put(ReindexingUtil.ENTITY_TYPE_KEY, entityType);
        bulkSink.write(typeEntities, contextData);
        bulkSink.flushAndAwait(60); // Wait up to 60 seconds for completion
      } catch (Exception e) {
        LOG.error("Error during bulk entity update in search index for type {}", entityType, e);
        for (EntityInterface entity : typeEntities) {
          try {
            updateEntityIndex(entity);
          } catch (Exception ex) {
            LOG.error(
                "Error updating entity {} in search index", entity.getFullyQualifiedName(), ex);
          }
        }
      } finally {
        if (bulkSink != null) {
          try {
            bulkSink.close();
          } catch (Exception e) {
            LOG.warn("Error closing bulk sink", e);
          }
        }
      }
    }

    // Run fan-out propagation once after all bulk doc updates are flushed.
    propagateEntitiesAfterBulkFlush(dedupedEntities.values());
  }

  private void propagateEntitiesAfterBulkFlush(Iterable<EntityInterface> entities) {
    int candidates = 0;
    int propagated = 0;
    long startTime = System.currentTimeMillis();

    for (EntityInterface entity : entities) {
      if (entity == null || entity.getId() == null || entity.getEntityReference() == null) {
        continue;
      }
      String entityType = entity.getEntityReference().getType();
      if (!checkIfIndexingIsSupported(entityType)) {
        continue;
      }

      ChangeDescription incrementalChangeDescription = entity.getIncrementalChangeDescription();
      ChangeDescription changeDescription =
          !isNullOrEmptyChangeDescription(incrementalChangeDescription)
              ? incrementalChangeDescription
              : entity.getChangeDescription();

      if (!requiresPropagation(changeDescription, entityType, entity)) {
        continue;
      }

      candidates++;
      try {
        IndexMapping indexMapping = entityIndexMap.get(entityType);
        propagateInheritedFieldsToChildren(
            entityType, entity.getId().toString(), changeDescription, indexMapping, entity);
        propagateGlossaryTags(entityType, entity.getFullyQualifiedName(), changeDescription);
        propagateCertificationTags(entityType, entity, changeDescription);
        propagateToRelatedEntities(entityType, changeDescription, indexMapping, entity);
        propagated++;
      } catch (Exception e) {
        LOG.error(
            "Error propagating bulk search updates for entity {} of type {}",
            entity.getId(),
            entityType,
            e);
      }
    }

    if (candidates > 0) {
      LOG.info(
          "Bulk propagation phase completed: candidates={}, propagated={}, durationMs={}",
          candidates,
          propagated,
          System.currentTimeMillis() - startTime);
    }
  }

  public void updateEntitiesBulk(List<? extends EntityInterface> entities) {
    updateEntitiesIndex(entities);
  }

  /**
   * Bulk updates domain references for assets when a data product's domain changes. This is more
   * efficient than updating each entity individually as it uses a single update-by-query operation.
   *
   * @param dataProductFqn the fully qualified name of the data product
   * @param oldDomainFqns list of old domain FQNs to remove from assets
   * @param newDomains list of new domain references to add to assets
   */
  public void updateAssetDomainsForDataProduct(
      String dataProductFqn, List<String> oldDomainFqns, List<EntityReference> newDomains) {
    Timer.Sample s = RequestLatencyContext.startSearchOperation();
    if (SearchIndexRetryQueue.isEntityTypeSuspended(Entity.DATA_PRODUCT)) {
      LOG.debug(
          "Skipping updateAssetDomainsForDataProduct because reindex is active for {}",
          Entity.DATA_PRODUCT);
      return;
    }
    if (!getSearchClient().isClientAvailable()) {
      SearchIndexRetryQueue.enqueue(
          null, dataProductFqn, "updateAssetDomainsForDataProduct: Search client unavailable");
      return;
    }
    try {
      getSearchClient().updateAssetDomainsForDataProduct(dataProductFqn, oldDomainFqns, newDomains);
    } catch (Exception e) {
      SearchIndexRetryQueue.enqueue(
          null,
          dataProductFqn,
          SearchIndexRetryQueue.failureReason("updateAssetDomainsForDataProduct", e));
    } finally {
      RequestLatencyContext.endSearchOperation(s);
    }
  }

  public void updateAssetDomainsByIds(
      List<UUID> assetIds, List<String> oldDomainFqns, List<EntityReference> newDomains) {
    Timer.Sample s = RequestLatencyContext.startSearchOperation();

    if (SearchIndexRetryQueue.isEntityTypeSuspended(Entity.DATA_PRODUCT)) {
      LOG.debug(
          "Skipping updateAssetDomainsByIds because reindex is active for {}", Entity.DATA_PRODUCT);
      return;
    }
    if (!getSearchClient().isClientAvailable()) {
      for (UUID assetId : listOrEmpty(assetIds)) {
        SearchIndexRetryQueue.enqueue(
            assetId != null ? assetId.toString() : null,
            null,
            "updateAssetDomainsByIds: Search client unavailable");
      }
      return;
    }
    try {
      getSearchClient().updateAssetDomainsByIds(assetIds, oldDomainFqns, newDomains);
    } catch (Exception e) {
      for (UUID assetId : listOrEmpty(assetIds)) {
        SearchIndexRetryQueue.enqueue(
            assetId != null ? assetId.toString() : null,
            null,
            SearchIndexRetryQueue.failureReason("updateAssetDomainsByIds", e));
      }
    } finally {
      RequestLatencyContext.endSearchOperation(s);
    }
  }

  public void updateDomainFqnByPrefix(String oldFqn, String newFqn) {
    Timer.Sample s = RequestLatencyContext.startSearchOperation();
    if (SearchIndexRetryQueue.isEntityTypeSuspended(Entity.DOMAIN)) {
      LOG.debug("Skipping updateDomainFqnByPrefix because reindex is active for {}", Entity.DOMAIN);
      return;
    }
    if (!getSearchClient().isClientAvailable()) {
      SearchIndexRetryQueue.enqueue(
          null, newFqn, "updateDomainFqnByPrefix: Search client unavailable");
      return;
    }
    try {
      getSearchClient().updateDomainFqnByPrefix(oldFqn, newFqn);
    } catch (Exception e) {
      SearchIndexRetryQueue.enqueue(
          null, newFqn, SearchIndexRetryQueue.failureReason("updateDomainFqnByPrefix", e));
    } finally {
      RequestLatencyContext.endSearchOperation(s);
    }
  }

  public void updateAssetDomainFqnByPrefix(String oldFqn, String newFqn) {
    Timer.Sample s = RequestLatencyContext.startSearchOperation();

    if (SearchIndexRetryQueue.isEntityTypeSuspended(Entity.DOMAIN)) {
      LOG.debug(
          "Skipping updateAssetDomainFqnByPrefix because reindex is active for {}", Entity.DOMAIN);
      return;
    }
    if (!getSearchClient().isClientAvailable()) {
      SearchIndexRetryQueue.enqueue(
          null, newFqn, "updateAssetDomainFqnByPrefix: Search client unavailable");
      return;
    }
    try {
      getSearchClient().updateAssetDomainFqnByPrefix(oldFqn, newFqn);
    } catch (Exception e) {
      SearchIndexRetryQueue.enqueue(
          null, newFqn, SearchIndexRetryQueue.failureReason("updateAssetDomainFqnByPrefix", e));
    } finally {
      RequestLatencyContext.endSearchOperation(s);
    }
  }

  public boolean checkIfIndexingIsSupported(String entityType) {
    IndexMapping indexMapping = entityIndexMap.get(entityType);
    if (indexMapping == null) {
      LOG.debug("Index mapping is not supported for entity type: {}", entityType);
      return false;
    }
    return true;
  }

  /**
   * Determines if changes require propagation to child entities.
   * Only propagate when fields that actually affect children have been modified.
   */
  private boolean requiresPropagation(
      ChangeDescription changeDescription, String entityType, EntityInterface entity) {
    if (changeDescription == null) {
      return false;
    }

    // Check if any inheritable fields have changed (owners, domains, etc.)
    boolean hasInheritableChanges =
        changeDescription.getFieldsAdded().stream()
                .anyMatch(field -> inheritableFields.contains(field.getName()))
            || changeDescription.getFieldsUpdated().stream()
                .anyMatch(field -> inheritableFields.contains(field.getName()))
            || changeDescription.getFieldsDeleted().stream()
                .anyMatch(field -> inheritableFields.contains(field.getName()));

    // Tags need special handling - they only propagate in specific scenarios:
    // 1. From glossary terms to entities
    // 2. When a tag entity itself is updated (to all entities using it)
    // 3. NOT from table to columns
    boolean hasTagChanges = false;
    boolean nameChanged =
        changeDescription.getFieldsUpdated().stream()
            .anyMatch(field -> field.getName().equals(FIELD_NAME));
    if (entityType.equalsIgnoreCase(Entity.GLOSSARY_TERM)
        || entityType.equalsIgnoreCase(Entity.TAG)) {
      hasTagChanges =
          changeDescription.getFieldsAdded().stream()
                  .anyMatch(field -> propagateFields.contains(field.getName()))
              || changeDescription.getFieldsUpdated().stream()
                  .anyMatch(field -> propagateFields.contains(field.getName()))
              || changeDescription.getFieldsDeleted().stream()
                  .anyMatch(field -> propagateFields.contains(field.getName()));
    }

    // Check for glossary term specific changes
    if (entityType.equalsIgnoreCase(Entity.GLOSSARY_TERM)) {
      hasInheritableChanges =
          hasInheritableChanges
              || hasTagChanges
              || nameChanged
              || changeDescription.getFieldsAdded().stream()
                  .anyMatch(field -> field.getName().equals(Entity.FIELD_TAGS))
              || changeDescription.getFieldsDeleted().stream()
                  .anyMatch(field -> field.getName().equals(Entity.FIELD_TAGS));
    }

    // Check for certification tag changes + tag specific changes
    if (entityType.equalsIgnoreCase(Entity.TAG)) {
      Tag tag = (Tag) entity;
      hasInheritableChanges = hasInheritableChanges || nameChanged;
      if (tag != null && tag.getCertification() != null) {
        hasInheritableChanges =
            hasInheritableChanges
                || changeDescription.getFieldsUpdated().stream()
                    .anyMatch(field -> field.getName().equals("certification"));
      }
    }

    // Check for relationship changes that need propagation
    if (changeDescription.getFieldsAdded().stream()
            .anyMatch(field -> field.getName().equals("upstreamEntityRelationship"))
        || changeDescription.getFieldsUpdated().stream()
            .anyMatch(field -> field.getName().equals("upstreamEntityRelationship"))) {
      hasInheritableChanges = true;
    }

    // Page entities have special FQN propagation when parent changes
    if (entityType.equalsIgnoreCase(Entity.PAGE)) {
      boolean parentChanged =
          changeDescription.getFieldsAdded().stream()
                  .anyMatch(field -> field.getName().contains("parent"))
              || changeDescription.getFieldsUpdated().stream()
                  .anyMatch(field -> field.getName().contains("parent"));
      hasInheritableChanges = hasInheritableChanges || parentChanged;
    }

    boolean propagationRequired = hasInheritableChanges || hasTagChanges;

    if (propagationRequired) {
      LOG.debug(
          "Propagation required for entity {} of type {} - changes detected in inheritable fields or special propagation needed",
          entity.getId(),
          entityType);
    }

    return propagationRequired;
  }

  public void propagateInheritedFieldsToChildren(
      String entityType,
      String entityId,
      ChangeDescription changeDescription,
      IndexMapping indexMapping,
      EntityInterface entity)
      throws IOException {
    if (changeDescription == null) {
      return;
    }

    Pair<String, Map<String, Object>> updates = getInheritedFieldChanges(changeDescription, entity);
    if (updates.getKey() == null || updates.getKey().isEmpty()) {
      return;
    }

    List<String> childAliases = indexMapping.getChildAliases(clusterAlias);
    if (nullOrEmpty(childAliases)) {
      return;
    }

    // Domain has subdomains (parent.id) and data products (domains.id) - handle separately
    if (entityType.equalsIgnoreCase(Entity.DOMAIN)) {
      propagateToDomainChildren(entityId, indexMapping, updates);
      return;
    }

    // Other entities: resolve parent field name and propagate to children
    String parentFieldName = resolveParentFieldName(entityType, updates);
    Pair<String, String> parentMatch = new ImmutablePair<>(parentFieldName, entityId);
    searchClient.updateChildren(childAliases, parentMatch, updates);
  }

  private String resolveParentFieldName(
      String entityType, Pair<String, Map<String, Object>> updates) {
    if (!updates.getValue().isEmpty()
        && (updates.getValue().keySet().stream()
                .anyMatch(key -> key.toLowerCase().contains(FIELD_DOMAINS))
            || updates.getValue().containsKey(FIELD_DISPLAY_NAME))) {
      if (SERVICE_ENTITY_SET.stream().anyMatch(s -> s.equalsIgnoreCase(entityType))) {
        return SERVICE_ID;
      }
    }
    return entityType + ".id";
  }

  private void propagateToDomainChildren(
      String domainId, IndexMapping indexMapping, Pair<String, Map<String, Object>> updates)
      throws IOException {
    searchClient.updateChildren(
        List.of(indexMapping.getIndexName(clusterAlias)),
        new ImmutablePair<>(PARENT_ID, domainId),
        updates);
    searchClient.updateChildren(
        List.of(entityIndexMap.get(Entity.DATA_PRODUCT).getIndexName(clusterAlias)),
        new ImmutablePair<>(DOMAINS_ID, domainId),
        updates);
  }

  public void propagateGlossaryTags(
      String entityType, String glossaryFQN, ChangeDescription changeDescription) {
    Map<String, Object> fieldData = new HashMap<>();
    if (changeDescription != null && entityType.equalsIgnoreCase(Entity.GLOSSARY_TERM)) {
      for (FieldChange field : changeDescription.getFieldsAdded()) {
        if (propagateFields.contains(field.getName())) {
          List<TagLabel> tagLabels =
              JsonUtils.readObjects((String) field.getNewValue(), TagLabel.class);
          tagLabels.forEach(tagLabel -> tagLabel.setLabelType(TagLabel.LabelType.DERIVED));
          fieldData.put("tagAdded", tagLabels);
        }
      }
      for (FieldChange field : changeDescription.getFieldsDeleted()) {
        if (propagateFields.contains(field.getName())) {
          List<TagLabel> tagLabels =
              JsonUtils.readObjects((String) field.getOldValue(), TagLabel.class);
          tagLabels.forEach(tagLabel -> tagLabel.setLabelType(TagLabel.LabelType.DERIVED));
          fieldData.put("tagDeleted", tagLabels);
        }
      }
      searchClient.updateChildren(
          GLOBAL_SEARCH_ALIAS,
          new ImmutablePair<>(TAGS_FQN, glossaryFQN),
          new ImmutablePair<>(UPDATE_ADDED_DELETE_GLOSSARY_TAGS, fieldData));
    }
  }

  private static final String CERTIFICATION = "Certification";
  private static final String CERTIFICATION_FIELD = "certification";
  private static final String CERTIFICATION_TAG_FQN_FIELD = "certification.tagLabel.tagFQN";

  public void propagateCertificationTags(
      String entityType, EntityInterface entity, ChangeDescription changeDescription) {
    if (changeDescription == null) {
      return;
    }

    if (Entity.TAG.equalsIgnoreCase(entityType)) {
      handleTagEntityUpdate((Tag) entity);
    } else {
      handleEntityCertificationUpdate(entity, changeDescription);
    }
  }

  private void handleTagEntityUpdate(Tag tagEntity) {
    if (CERTIFICATION.equals(tagEntity.getClassification().getFullyQualifiedName())) {
      updateCertificationInSearch(tagEntity);
    }
  }

  private void updateCertificationInSearch(Tag tagEntity) {
    Map<String, Object> paramMap = new HashMap<>();
    paramMap.put("name", tagEntity.getName());
    paramMap.put("description", tagEntity.getDescription());
    paramMap.put("tagFQN", tagEntity.getFullyQualifiedName());
    paramMap.put("style", tagEntity.getStyle());
    searchClient.updateChildren(
        DATA_ASSET_SEARCH_ALIAS,
        new ImmutablePair<>(CERTIFICATION_TAG_FQN_FIELD, tagEntity.getFullyQualifiedName()),
        new ImmutablePair<>(UPDATE_CERTIFICATION_SCRIPT, paramMap));
  }

  private void handleEntityCertificationUpdate(EntityInterface entity, ChangeDescription change) {
    if (!isCertificationUpdated(change)) {
      return;
    }

    AssetCertification certification = getCertificationFromEntity(entity);
    updateEntityCertificationInSearch(entity, certification);
  }

  private boolean isCertificationUpdated(ChangeDescription change) {
    return Stream.concat(
            Stream.concat(change.getFieldsUpdated().stream(), change.getFieldsAdded().stream()),
            change.getFieldsDeleted().stream())
        .anyMatch(fieldChange -> CERTIFICATION_FIELD.equals(fieldChange.getName()));
  }

  private AssetCertification getCertificationFromEntity(EntityInterface entity) {
    return (AssetCertification) EntityUtil.getEntityField(entity, CERTIFICATION_FIELD);
  }

  private void updateEntityCertificationInSearch(
      EntityInterface entity, AssetCertification certification) {
    IndexMapping indexMapping = entityIndexMap.get(entity.getEntityReference().getType());
    String indexName = indexMapping.getIndexName(clusterAlias);
    Map<String, Object> paramMap = new HashMap<>();

    if (certification != null && certification.getTagLabel() != null) {
      paramMap.put("name", certification.getTagLabel().getName());
      paramMap.put("description", certification.getTagLabel().getDescription());
      paramMap.put("tagFQN", certification.getTagLabel().getTagFQN());
      paramMap.put("style", certification.getTagLabel().getStyle());
    } else {
      paramMap.put("name", null);
      paramMap.put("description", null);
      paramMap.put("tagFQN", null);
      paramMap.put("style", null);
    }

    searchClient.updateEntity(
        indexName, entity.getId().toString(), paramMap, UPDATE_CERTIFICATION_SCRIPT);
  }

  public void propagateToRelatedEntities(
      String entityType,
      ChangeDescription changeDescription,
      IndexMapping indexMapping,
      EntityInterface entity) {

    if (changeDescription != null && entityType.equalsIgnoreCase(Entity.PAGE)) {
      String indexName = indexMapping.getIndexName(clusterAlias);
      for (FieldChange field : changeDescription.getFieldsAdded()) {
        if (field.getName().contains(PARENT)) {
          String oldParentFQN = entity.getName();
          String newParentFQN = entity.getFullyQualifiedName();
          // Propagate FQN updates to all subchildren
          searchClient.updateByFqnPrefix(
              indexName, oldParentFQN, newParentFQN, FIELD_FULLY_QUALIFIED_NAME);
        }
      }

      for (FieldChange field : changeDescription.getFieldsUpdated()) {
        if (field.getName().contains(PARENT)) {
          EntityReference entityReferenceBeforeUpdate =
              JsonUtils.readValue(field.getOldValue().toString(), EntityReference.class);
          // Propagate FQN updates to all subchildren
          String originalFqn =
              FullyQualifiedName.add(
                  entityReferenceBeforeUpdate.getFullyQualifiedName(), entity.getName());
          String updatedFqn = entity.getFullyQualifiedName();
          searchClient.updateByFqnPrefix(
              indexName, originalFqn, updatedFqn, FIELD_FULLY_QUALIFIED_NAME);
        }
      }

      for (FieldChange field : changeDescription.getFieldsDeleted()) {
        if (field.getName().contains(PARENT)) {
          EntityReference entityReferenceBeforeUpdate =
              JsonUtils.readValue(field.getOldValue().toString(), EntityReference.class);
          // Remove the parent field from the entity in search
          String parentFieldPath = "parent";
          Map<String, Object> params = new HashMap<>();
          params.put("field", parentFieldPath);
          searchClient.updateEntity(
              indexName, entity.getId().toString(), params, "ctx._source.remove(params.field)");

          // Propagate FQN updates to all subchildren
          String originalFqn =
              FullyQualifiedName.add(
                  entityReferenceBeforeUpdate.getFullyQualifiedName(), entity.getName());
          searchClient.updateByFqnPrefix(
              indexName, originalFqn, entity.getName(), FIELD_FULLY_QUALIFIED_NAME);
        }
      }
    } else if (changeDescription != null
        && (entityType.equalsIgnoreCase(Entity.CLASSIFICATION)
            || entityType.equalsIgnoreCase(Entity.GLOSSARY)
            || entityType.equalsIgnoreCase(Entity.GLOSSARY_TERM)
            || entityType.equalsIgnoreCase(Entity.TAG))) {

      // Update the assets associated with the tags/terms in classification/glossary
      Map<String, Object> paramMap = new HashMap<>();
      for (FieldChange field : changeDescription.getFieldsUpdated()) {
        String parentFQN = FullyQualifiedName.getParentFQN(entity.getFullyQualifiedName());
        String oldFQN;
        String newFQN;

        if (!nullOrEmpty(parentFQN)) {
          oldFQN = FullyQualifiedName.add(parentFQN, field.getOldValue().toString());
          newFQN = FullyQualifiedName.add(parentFQN, field.getNewValue().toString());
        } else {
          oldFQN = FullyQualifiedName.quoteName(field.getOldValue().toString());
          newFQN = FullyQualifiedName.quoteName(field.getNewValue().toString());
        }

        if (field.getName().contains(FIELD_NAME)) {
          searchClient.updateByFqnPrefix(GLOBAL_SEARCH_ALIAS, oldFQN, newFQN, TAGS_FQN);
        }

        if (field.getName().equalsIgnoreCase(FIELD_DISPLAY_NAME)) {
          Map<String, Object> updates = new HashMap<>();
          updates.put("displayName", field.getNewValue().toString());
          paramMap.put("tagFQN", entity.getFullyQualifiedName());
          paramMap.put("updates", updates);
          searchClient.updateChildren(
              GLOBAL_SEARCH_ALIAS,
              new ImmutablePair<>(TAGS_FQN, entity.getFullyQualifiedName()),
              new ImmutablePair<>(UPDATE_TAGS_FIELD_SCRIPT, paramMap));
        }
      }
    }
  }

  private Pair<String, Map<String, Object>> getInheritedFieldChanges(
      ChangeDescription changeDescription, EntityInterface entity) {
    StringBuilder scriptTxt = new StringBuilder();
    Map<String, Object> fieldData = new HashMap<>();

    if (changeDescription != null) {
      for (FieldChange field : changeDescription.getFieldsDeleted()) {
        if (inheritableFields.contains(field.getName())) {
          try {
            if (field.getName().equals(FIELD_OWNERS)) {
              List<EntityReference> inheritedOwners =
                  JsonUtils.deepCopyList(entity.getOwners(), EntityReference.class);
              for (EntityReference inheritedOwner : inheritedOwners) {
                inheritedOwner.setInherited(true);
              }
              fieldData.put("deletedOwners", inheritedOwners);
              scriptTxt.append(REMOVE_OWNERS_SCRIPT);
              scriptTxt.append(" ");
            } else if (field.getName().equals(FIELD_DOMAINS)) {
              List<EntityReference> inheritedDomains =
                  JsonUtils.deepCopyList(entity.getDomains(), EntityReference.class);
              for (EntityReference inheritedDomain : inheritedDomains) {
                inheritedDomain.setInherited(true);
              }
              fieldData.put("deletedDomains", inheritedDomains);
              scriptTxt.append(REMOVE_DOMAINS_SCRIPT);
              scriptTxt.append(" ");
            } else if (field.getName().equals(FIELD_FOLLOWERS)) {
              List<EntityReference> inheritedFollowers =
                  copyWithInheritedFlag(entity.getFollowers());
              fieldData.put("deletedFollowers", inheritedFollowers);
              scriptTxt.append(REMOVE_FOLLOWERS_SCRIPT);
              scriptTxt.append(" ");
            } else {
              EntityReference entityReference =
                  JsonUtils.readValue(field.getOldValue().toString(), EntityReference.class);
              scriptTxt.append(
                  String.format(
                      REMOVE_PROPAGATED_ENTITY_REFERENCE_FIELD_SCRIPT,
                      field.getName(),
                      field.getName(),
                      field.getName()));
              fieldData.put(field.getName(), JsonUtils.getMap(entityReference));
              scriptTxt.append(" ");
            }
          } catch (JsonParsingException e) {
            scriptTxt.append(String.format(REMOVE_PROPAGATED_FIELD_SCRIPT, field.getName()));
          }
        }
      }
      for (FieldChange field : changeDescription.getFieldsUpdated()) {
        if (inheritableFields.contains(field.getName())) {
          try {
            EntityReference newEntityReference =
                JsonUtils.readValue(field.getNewValue().toString(), EntityReference.class);
            fieldData.put(
                "entityBeforeUpdate",
                JsonUtils.readValue(field.getOldValue().toString(), EntityReference.class));
            scriptTxt.append(
                String.format(
                    UPDATE_PROPAGATED_ENTITY_REFERENCE_FIELD_SCRIPT,
                    field.getName(),
                    field.getName(),
                    field.getName(),
                    field.getName(),
                    field.getName()));
            fieldData.put(field.getName(), newEntityReference);
          } catch (JsonParsingException e) {
            if (field.getName().equals(Entity.FIELD_TEST_SUITES)) {
              scriptTxt.append(PROPAGATE_TEST_SUITES_SCRIPT);
              fieldData.put(Entity.FIELD_TEST_SUITES, field.getNewValue());
            } else if (field.getName().equals(FIELD_DISPLAY_NAME)) {
              String fieldPath =
                  getFieldPath(entity.getEntityReference().getType(), field.getName());
              fieldData.put(field.getName(), field.getNewValue().toString());
              scriptTxt.append(
                  String.format(PROPAGATE_NESTED_FIELD_SCRIPT, fieldPath, field.getName()));
            } else {
              scriptTxt.append(
                  String.format(PROPAGATE_FIELD_SCRIPT, field.getName(), field.getNewValue()));
            }
          }
          scriptTxt.append(" ");
        }
      }
      for (FieldChange field : changeDescription.getFieldsAdded()) {
        if (inheritableFields.contains(field.getName())) {
          try {
            if (field.getName().equals(FIELD_OWNERS)) {
              List<EntityReference> inheritedOwners =
                  JsonUtils.deepCopyList(entity.getOwners(), EntityReference.class);
              for (EntityReference inheritedOwner : inheritedOwners) {
                inheritedOwner.setInherited(true);
              }
              fieldData.put("updatedOwners", inheritedOwners);
              scriptTxt.append(ADD_OWNERS_SCRIPT);
            } else if (field.getName().equals(FIELD_DOMAINS)) {
              List<EntityReference> inheritedDomains =
                  JsonUtils.deepCopyList(entity.getDomains(), EntityReference.class);
              for (EntityReference inheritedDomain : inheritedDomains) {
                inheritedDomain.setInherited(true);
              }
              fieldData.put("updatedDomains", inheritedDomains);
              scriptTxt.append(ADD_DOMAINS_SCRIPT);
            } else if (field.getName().equals(FIELD_FOLLOWERS)) {
              List<EntityReference> inheritedFollowers =
                  copyWithInheritedFlag(entity.getFollowers());
              fieldData.put("updatedFollowers", inheritedFollowers);
              scriptTxt.append(ADD_FOLLOWERS_SCRIPT);
            } else {
              EntityReference entityReference =
                  JsonUtils.readValue(field.getNewValue().toString(), EntityReference.class);
              scriptTxt.append(
                  String.format(
                      PROPAGATE_ENTITY_REFERENCE_FIELD_SCRIPT,
                      field.getName(),
                      field.getName(),
                      field.getName(),
                      field.getName(),
                      field.getName()));
              fieldData.put(field.getName(), entityReference);
            }
            scriptTxt.append(" ");
          } catch (JsonParsingException e) {
            if (field.getName().equals(FIELD_DISPLAY_NAME)) {
              String fieldPath =
                  getFieldPath(entity.getEntityReference().getType(), field.getName());
              fieldData.put(field.getName(), field.getNewValue().toString());
              scriptTxt.append(
                  String.format(PROPAGATE_NESTED_FIELD_SCRIPT, fieldPath, field.getName()));
            } else {
              scriptTxt.append(
                  String.format(PROPAGATE_FIELD_SCRIPT, field.getName(), field.getNewValue()));
              scriptTxt.append(" ");
            }
          }
        }
      }
    }
    return new ImmutablePair<>(scriptTxt.toString(), fieldData);
  }

  private String getFieldPath(String entityType, String fieldName) {
    if (entityType.equalsIgnoreCase(Entity.DATABASE_SERVICE)
        || entityType.equalsIgnoreCase(Entity.DASHBOARD_SERVICE)
        || entityType.equalsIgnoreCase(Entity.MESSAGING_SERVICE)
        || entityType.equalsIgnoreCase(Entity.PIPELINE_SERVICE)
        || entityType.equalsIgnoreCase(Entity.MLMODEL_SERVICE)
        || entityType.equalsIgnoreCase(Entity.STORAGE_SERVICE)
        || entityType.equalsIgnoreCase(Entity.SEARCH_SERVICE)
        || entityType.equalsIgnoreCase(Entity.SECURITY_SERVICE)
        || entityType.equalsIgnoreCase(Entity.API_SERVICE)
        || entityType.equalsIgnoreCase(Entity.DRIVE_SERVICE)) {
      return "service." + fieldName;
    } else {
      return entityType + "." + fieldName;
    }
  }

  public void deleteByScript(String entityType, String scriptTxt, Map<String, Object> params) {
    Timer.Sample searchSample = RequestLatencyContext.startSearchOperation();
    try {
      IndexMapping indexMapping = getIndexMapping(entityType);
      searchClient.deleteByScript(indexMapping.getIndexName(clusterAlias), scriptTxt, params);
    } catch (Exception ie) {
      LOG.error("Issue deleting search document for entityType [{}]", entityType, ie);
    } finally {
      RequestLatencyContext.endSearchOperation(searchSample);
    }
  }

  /**
   * Delete search index for an entity only (no lifecycle events).
   * This method is used by SearchIndexHandler.
   */
  public void deleteEntityIndex(EntityInterface entity) {
    if (entity == null) {
      LOG.debug("Entity or EntityReference is null, cannot perform delete.");
      return;
    }

    if (!checkIfIndexingIsSupported(entity.getEntityReference().getType())) {
      LOG.debug(
          "Indexing is not supported for entity type: {}", entity.getEntityReference().getType());
      return;
    }

    String entityId = entity.getId().toString();
    String entityType = entity.getEntityReference().getType();
    if (shouldSkipStreamingIndexing(
        entityType, entityId, entity.getFullyQualifiedName(), "deleteEntityIndex")) {
      return;
    }
    IndexMapping indexMapping = entityIndexMap.get(entityType);
    Timer.Sample searchSample = RequestLatencyContext.startSearchOperation();
    try {
      searchClient.deleteEntity(indexMapping.getIndexName(clusterAlias), entityId);
      deleteOrUpdateChildren(entity, indexMapping);
      if (Entity.TABLE.equals(entityType)) {
        deleteTableColumns((Table) entity);
      }
    } catch (Exception ie) {
      SearchIndexRetryQueue.enqueue(
          entityId,
          entity.getFullyQualifiedName(),
          SearchIndexRetryQueue.failureReason("deleteEntityIndex", ie));
      LOG.error(
          "Issue deleting the search document for entityID [{}] and entityType [{}]",
          entityId,
          entityType,
          ie);
    } finally {
      RequestLatencyContext.endSearchOperation(searchSample);
    }
  }

  public void deleteEntityByFQNPrefix(EntityInterface entity) {
    if (entity != null) {
      String entityType = entity.getEntityReference().getType();
      String fqn = entity.getFullyQualifiedName();
      if (SearchIndexRetryQueue.isEntityTypeSuspended(entityType)) {
        LOG.debug(
            "Skipping deleteEntityByFQNPrefix for {} because reindex is active for {}",
            fqn,
            entityType);
        return;
      }
      if (!getSearchClient().isClientAvailable()) {
        SearchIndexRetryQueue.enqueue(
            entity.getId() != null ? entity.getId().toString() : null,
            fqn,
            "deleteEntityByFQNPrefix: Search client unavailable");
        return;
      }
      IndexMapping indexMapping = entityIndexMap.get(entityType);
      Timer.Sample searchSample = RequestLatencyContext.startSearchOperation();
      try {
        searchClient.deleteEntityByFQNPrefix(indexMapping.getIndexName(clusterAlias), fqn);
      } catch (Exception ie) {
        SearchIndexRetryQueue.enqueue(
            entity.getId() != null ? entity.getId().toString() : null,
            fqn,
            SearchIndexRetryQueue.failureReason("deleteEntityByFQNPrefix", ie));
        LOG.error(
            "Issue deleting the search document for entityFQN [{}] and entityType [{}]",
            fqn,
            entityType,
            ie);
      } finally {
        RequestLatencyContext.endSearchOperation(searchSample);
      }
    }
  }

  public void deleteTimeSeriesEntityById(EntityTimeSeriesInterface entity) {
    if (entity != null) {
      String entityId = entity.getId().toString();
      String entityType = entity.getEntityReference().getType();
      IndexMapping indexMapping = entityIndexMap.get(entityType);
      Timer.Sample searchSample = RequestLatencyContext.startSearchOperation();
      try {
        searchClient.deleteEntity(indexMapping.getIndexName(clusterAlias), entityId);
      } catch (Exception ie) {
        SearchIndexRetryQueue.enqueue(
            entityId,
            entity.getEntityReference() != null
                ? entity.getEntityReference().getFullyQualifiedName()
                : null,
            entityType,
            SearchIndexRetryQueue.failureReason("deleteTimeSeriesEntityById", ie));
        LOG.error(
            "Issue deleting the search document for entityID [{}] and entityType [{}]",
            entityId,
            entityType,
            ie);
      } finally {
        RequestLatencyContext.endSearchOperation(searchSample);
      }
    }
  }

  /**
   * Soft delete or restore search index for an entity only (no lifecycle events).
   * This method is used by SearchIndexHandler.
   */
  public void softDeleteOrRestoreEntityIndex(EntityInterface entity, boolean delete) {
    if (entity == null) {
      LOG.debug("Entity or EntityReference is null, cannot perform soft delete or restore.");
      return;
    }

    if (!checkIfIndexingIsSupported(entity.getEntityReference().getType())) {
      LOG.debug(
          "Indexing is not supported for entity type: {}", entity.getEntityReference().getType());
      return;
    }

    String entityId = entity.getId().toString();
    String entityType = entity.getEntityReference().getType();
    if (shouldSkipStreamingIndexing(
        entityType, entityId, entity.getFullyQualifiedName(), "softDeleteOrRestoreEntityIndex")) {
      return;
    }
    IndexMapping indexMapping = entityIndexMap.get(entityType);
    String scriptTxt = String.format(SOFT_DELETE_RESTORE_SCRIPT, delete);
    Timer.Sample searchSample = RequestLatencyContext.startSearchOperation();
    try {
      searchClient.softDeleteOrRestoreEntity(
          indexMapping.getIndexName(clusterAlias), entityId, scriptTxt);
      softDeleteOrRestoredChildren(entity.getEntityReference(), indexMapping, delete);

      if (Entity.TABLE.equals(entityType)) {
        softDeleteOrRestoreTableColumns((Table) entity, delete);
      }
    } catch (Exception ie) {
      SearchIndexRetryQueue.enqueue(
          entityId,
          entity.getFullyQualifiedName(),
          SearchIndexRetryQueue.failureReason("softDeleteOrRestoreEntityIndex", ie));
      LOG.error(
          "Issue soft deleting the search document for entityID [{}] and entityType [{}]",
          entityId,
          entityType,
          ie);
    } finally {
      RequestLatencyContext.endSearchOperation(searchSample);
    }
  }

  private void softDeleteOrRestoreTableColumns(Table table, boolean delete) {
    IndexMapping columnIndexMapping = entityIndexMap.get(Entity.TABLE_COLUMN);
    if (columnIndexMapping == null) {
      return;
    }

    String scriptTxt = String.format(SOFT_DELETE_RESTORE_SCRIPT, delete);
    try {
      searchClient.updateChildren(
          List.of(columnIndexMapping.getIndexName(clusterAlias)),
          new ImmutablePair<>("table.id", table.getId().toString()),
          new ImmutablePair<>(scriptTxt, null));
    } catch (Exception e) {
      LOG.error(
          "Issue soft deleting/restoring columns for table [{}]: {}",
          table.getFullyQualifiedName(),
          e.getMessage());
      if (e instanceof RuntimeException re) {
        throw re;
      }
      throw new RuntimeException(e);
    }
  }

  public void deleteOrUpdateChildren(EntityInterface entity, IndexMapping indexMapping)
      throws IOException {
    String docId = entity.getId().toString();
    String entityType = entity.getEntityReference().getType();
    switch (entityType) {
      case Entity.DOMAIN -> {
        searchClient.updateChildren(
            GLOBAL_SEARCH_ALIAS,
            new ImmutablePair<>(entityType + ".id", docId),
            new ImmutablePair<>(REMOVE_DOMAINS_CHILDREN_SCRIPT, null));
        // we are doing below because we want to delete the data products with domain when domain is
        // deleted
        searchClient.deleteEntityByFields(
            indexMapping.getChildAliases(clusterAlias),
            List.of(new ImmutablePair<>(entityType + ".id", docId)));
      }
      case Entity.DATA_PRODUCT -> searchClient.updateChildren(
          GLOBAL_SEARCH_ALIAS,
          new ImmutablePair<>("dataProducts.id", docId),
          new ImmutablePair<>(
              REMOVE_DATA_PRODUCTS_CHILDREN_SCRIPT,
              Collections.singletonMap("fqn", entity.getFullyQualifiedName())));

      case Entity.TAG, Entity.GLOSSARY_TERM -> searchClient.updateChildren(
          GLOBAL_SEARCH_ALIAS,
          new ImmutablePair<>("tags.tagFQN", entity.getFullyQualifiedName()),
          new ImmutablePair<>(
              REMOVE_TAGS_CHILDREN_SCRIPT,
              Collections.singletonMap("fqn", entity.getFullyQualifiedName())));
      case Entity.TEST_SUITE -> {
        TestSuite testSuite = (TestSuite) entity;
        if (Boolean.TRUE.equals(testSuite.getBasic())) {
          searchClient.deleteEntityByFields(
              indexMapping.getChildAliases(clusterAlias),
              List.of(new ImmutablePair<>("testSuite.id", docId)));
        } else {
          searchClient.updateChildren(
              indexMapping.getChildAliases(clusterAlias),
              new ImmutablePair<>("testSuites.id", testSuite.getId().toString()),
              new ImmutablePair<>(
                  REMOVE_TEST_SUITE_CHILDREN_SCRIPT,
                  Collections.singletonMap("suiteId", testSuite.getId().toString())));
        }
      }
      case Entity.DASHBOARD_SERVICE,
          Entity.DATABASE_SERVICE,
          Entity.MESSAGING_SERVICE,
          Entity.PIPELINE_SERVICE,
          Entity.MLMODEL_SERVICE,
          Entity.STORAGE_SERVICE,
          Entity.SEARCH_SERVICE,
          Entity.SECURITY_SERVICE,
          Entity.DRIVE_SERVICE -> searchClient.deleteEntityByFields(
          indexMapping.getChildAliases(clusterAlias),
          List.of(new ImmutablePair<>("service.id", docId)));
      default -> {
        List<String> indexNames = indexMapping.getChildAliases(clusterAlias);
        if (!indexNames.isEmpty()) {
          searchClient.deleteEntityByFields(
              indexNames, List.of(new ImmutablePair<>(entityType + ".id", docId)));
        }
      }
    }
  }

  public void softDeleteOrRestoredChildren(
      EntityReference entityReference, IndexMapping indexMapping, boolean delete)
      throws IOException {
    String docId = entityReference.getId().toString();
    String entityType = entityReference.getType();
    String scriptTxt = String.format(SOFT_DELETE_RESTORE_SCRIPT, delete);
    switch (entityType) {
      case Entity.DASHBOARD_SERVICE,
          Entity.DATABASE_SERVICE,
          Entity.MESSAGING_SERVICE,
          Entity.PIPELINE_SERVICE,
          Entity.MLMODEL_SERVICE,
          Entity.STORAGE_SERVICE,
          Entity.SEARCH_SERVICE,
          Entity.SECURITY_SERVICE,
          Entity.DRIVE_SERVICE -> searchClient.softDeleteOrRestoreChildren(
          indexMapping.getChildAliases(clusterAlias),
          scriptTxt,
          List.of(new ImmutablePair<>("service.id", docId)));
      default -> {
        List<String> indexNames = indexMapping.getChildAliases(clusterAlias);
        if (!indexNames.isEmpty()) {
          searchClient.softDeleteOrRestoreChildren(
              indexMapping.getChildAliases(clusterAlias),
              scriptTxt,
              List.of(new ImmutablePair<>(entityType + ".id", docId)));
        }
      }
    }
  }

  public String getScriptWithParams(
      EntityInterface entity,
      Map<String, Object> fieldAddParams,
      ChangeDescription changeDescription) {
    List<FieldChange> fieldsAdded = changeDescription.getFieldsAdded();
    StringBuilder scriptTxt = new StringBuilder();
    fieldAddParams.put("updatedAt", entity.getUpdatedAt());
    scriptTxt.append("ctx._source.updatedAt=params.updatedAt;");
    for (FieldChange fieldChange : fieldsAdded) {
      if (fieldChange.getName().equalsIgnoreCase(FIELD_FOLLOWERS)) {
        @SuppressWarnings("unchecked")
        List<EntityReference> entityReferences = (List<EntityReference>) fieldChange.getNewValue();
        List<String> newFollowers = new ArrayList<>();
        for (EntityReference follower : entityReferences) {
          newFollowers.add(follower.getId().toString());
        }
        fieldAddParams.put(fieldChange.getName(), newFollowers);
        scriptTxt.append("ctx._source.followers.addAll(params.followers);");
      }
      if (fieldChange.getName().equalsIgnoreCase("extension")) {
        String entityType = entity.getEntityReference().getType();
        List<Map<String, Object>> customPropertiesTyped =
            SearchIndexUtils.buildTypedCustomProperties(entity.getExtension(), entityType);
        fieldAddParams.put("customPropertiesTyped", customPropertiesTyped);
        fieldAddParams.put("extension", entity.getExtension());
        scriptTxt.append("ctx._source.customPropertiesTyped = params.customPropertiesTyped;");
        scriptTxt.append("ctx._source.extension = params.extension;");
      }
      if (fieldChange.getName().equalsIgnoreCase(FIELD_DESCRIPTION)) {
        fieldAddParams.put(FIELD_DESCRIPTION, entity.getDescription());
        scriptTxt.append("ctx._source.description = params.description;");
      }
    }

    for (FieldChange fieldChange : changeDescription.getFieldsDeleted()) {
      if (fieldChange.getName().equalsIgnoreCase(FIELD_FOLLOWERS)) {
        @SuppressWarnings("unchecked")
        List<EntityReference> entityReferences = (List<EntityReference>) fieldChange.getOldValue();
        for (EntityReference follower : entityReferences) {
          fieldAddParams.put(fieldChange.getName(), follower.getId().toString());
        }
        scriptTxt.append(
            "ctx._source.followers.removeAll(Collections.singleton(params.followers));");
      }
      if (fieldChange.getName().equalsIgnoreCase(FIELD_DESCRIPTION)) {
        scriptTxt.append("ctx._source.description = null;");
      }
    }

    for (FieldChange fieldChange : changeDescription.getFieldsUpdated()) {
      if (fieldChange.getName().equalsIgnoreCase(FIELD_DESCRIPTION)) {
        fieldAddParams.put(FIELD_DESCRIPTION, entity.getDescription());
        scriptTxt.append("ctx._source.description = params.description;");
      }
      if (fieldChange.getName().equalsIgnoreCase(FIELD_USAGE_SUMMARY)) {
        UsageDetails usageSummary = (UsageDetails) fieldChange.getNewValue();
        fieldAddParams.put(fieldChange.getName(), JsonUtils.getMap(usageSummary));
        scriptTxt.append("ctx._source.usageSummary = params.usageSummary;");
      }
      if (entity.getEntityReference().getType().equals(QUERY)
          && fieldChange.getName().equalsIgnoreCase("queryUsedIn")) {
        fieldAddParams.put(
            fieldChange.getName(),
            JsonUtils.convertValue(
                fieldChange.getNewValue(),
                new TypeReference<List<LinkedHashMap<String, String>>>() {}));
        scriptTxt.append("ctx._source.queryUsedIn = params.queryUsedIn;");
      }
      if (fieldChange.getName().equalsIgnoreCase("votes")) {
        Map<String, Object> doc = JsonUtils.getMap(entity);
        fieldAddParams.put(fieldChange.getName(), doc.get("votes"));
        scriptTxt.append("ctx._source.votes = params.votes;");
      }
      if (fieldChange.getName().equalsIgnoreCase("pipelineStatus")) {
        scriptTxt.append(
            "if (ctx._source.containsKey('pipelineStatus')) { ctx._source.pipelineStatus = params.newPipelineStatus; } else { ctx._source['pipelineStatus'] = params.newPipelineStatus;}");
        Map<String, Object> doc = JsonUtils.getMap(entity);
        fieldAddParams.put("newPipelineStatus", doc.get("pipelineStatus"));
      }
      if (fieldChange.getName().equalsIgnoreCase(TEST_SUITES)) {
        scriptTxt.append("ctx._source.testSuites = params.testSuites;");
        Map<String, Object> doc = JsonUtils.getMap(entity);
        fieldAddParams.put(TEST_SUITES, doc.get(TEST_SUITES));
      }
      if (fieldChange.getName().equalsIgnoreCase("extension")) {
        String entityType = entity.getEntityReference().getType();
        List<Map<String, Object>> customPropertiesTyped =
            SearchIndexUtils.buildTypedCustomProperties(entity.getExtension(), entityType);
        fieldAddParams.put("customPropertiesTyped", customPropertiesTyped);
        fieldAddParams.put("extension", entity.getExtension());
        scriptTxt.append("ctx._source.customPropertiesTyped = params.customPropertiesTyped;");
        scriptTxt.append("ctx._source.extension = params.extension;");
      }
    }
    return scriptTxt.toString();
  }

  private boolean canUseScriptedPartialUpdate(ChangeDescription changeDescription) {
    Set<String> changedFieldNames = getChangedFieldNames(changeDescription);
    return !changedFieldNames.isEmpty()
        && changedFieldNames.stream().allMatch(PARTIAL_SCRIPT_SUPPORTED_FIELDS::contains);
  }

  private Set<String> getChangedFieldNames(ChangeDescription changeDescription) {
    if (changeDescription == null) {
      return Collections.emptySet();
    }

    Set<String> changedFields = new HashSet<>();
    listOrEmpty(changeDescription.getFieldsAdded())
        .forEach(fieldChange -> changedFields.add(fieldChange.getName()));
    listOrEmpty(changeDescription.getFieldsUpdated())
        .forEach(fieldChange -> changedFields.add(fieldChange.getName()));
    listOrEmpty(changeDescription.getFieldsDeleted())
        .forEach(fieldChange -> changedFields.add(fieldChange.getName()));
    return changedFields;
  }

  public Response search(SearchRequest request, SubjectContext subjectContext) throws IOException {
    return searchClient.search(request, subjectContext);
  }

  public Response previewSearch(
      SearchRequest request, SubjectContext subjectContext, SearchSettings searchSettings)
      throws IOException {
    return searchClient.previewSearch(request, subjectContext, searchSettings);
  }

  public Response searchWithNLQ(SearchRequest request, SubjectContext subjectContext)
      throws IOException {
    return searchClient.searchWithNLQ(request, subjectContext);
  }

  public Response searchWithDirectQuery(SearchRequest request, SubjectContext subjectContext)
      throws IOException {
    return searchClient.searchWithDirectQuery(request, subjectContext);
  }

  public Response getDocument(String indexName, UUID entityId) throws IOException {
    return searchClient.getDocByID(indexName, entityId.toString());
  }

  public SearchResultListMapper listWithOffset(
      SearchListFilter filter,
      int limit,
      int offset,
      String entityType,
      SearchSortFilter searchSortFilter,
      String q)
      throws IOException {
    return listWithOffset(filter, limit, offset, entityType, searchSortFilter, q, null);
  }

  public SearchResultListMapper listWithOffset(
      SearchListFilter filter,
      int limit,
      int offset,
      String entityType,
      SearchSortFilter searchSortFilter,
      String q,
      String queryString)
      throws IOException {
    IndexMapping index = entityIndexMap.get(entityType);
    return searchClient.listWithOffset(
        filter.getCondition(entityType),
        limit,
        offset,
        index.getIndexName(clusterAlias),
        searchSortFilter,
        q,
        queryString);
  }

  public SearchResultListMapper listWithOffset(
      SearchListFilter filter,
      int limit,
      int offset,
      String entityType,
      SearchSortFilter searchSortFilter,
      String q,
      String queryString,
      SubjectContext subjectContext)
      throws IOException {
    IndexMapping index = entityIndexMap.get(entityType);
    return searchClient.listWithOffset(
        filter.getCondition(entityType),
        limit,
        offset,
        index.getIndexName(clusterAlias),
        searchSortFilter,
        q,
        queryString,
        subjectContext);
  }

  public SearchResultListMapper listWithDeepPagination(
      String entityType,
      String query,
      String filter,
      String[] fields,
      SearchSortFilter searchSortFilter,
      int size,
      Object[] searchAfter)
      throws IOException {
    IndexMapping index = entityIndexMap.get(entityType);
    return searchClient.listWithDeepPagination(
        index.getIndexName(clusterAlias),
        query,
        filter,
        fields,
        searchSortFilter,
        size,
        searchAfter);
  }

  public Response searchBySourceUrl(String sourceUrl) throws IOException {
    return searchClient.searchBySourceUrl(sourceUrl);
  }

  public SearchLineageResult searchLineage(SearchLineageRequest lineageRequest) throws IOException {
    return searchClient.searchLineage(lineageRequest);
  }

  public SearchLineageResult searchPlatformLineage(
      String alias, String queryFilter, boolean deleted) throws IOException {
    return searchClient.searchPlatformLineage(alias, queryFilter, deleted);
  }

  public SearchLineageResult searchLineageWithDirection(SearchLineageRequest lineageRequest)
      throws IOException {
    return searchClient.searchLineageWithDirection(lineageRequest);
  }

  public LineagePaginationInfo getLineagePaginationInfo(
      String fqn,
      int upstreamDepth,
      int downstreamDepth,
      String queryFilter,
      boolean includeDeleted,
      String entityType)
      throws IOException {
    return searchClient.getLineagePaginationInfo(
        fqn, upstreamDepth, downstreamDepth, queryFilter, includeDeleted, entityType);
  }

  public SearchLineageResult searchLineageByEntityCount(EntityCountLineageRequest request)
      throws IOException {
    return searchClient.searchLineageByEntityCount(request);
  }

  public Response searchEntityRelationship(
      String fqn, int upstreamDepth, int downstreamDepth, String queryFilter, boolean deleted)
      throws IOException {
    return searchClient.searchEntityRelationship(
        fqn, upstreamDepth, downstreamDepth, queryFilter, deleted);
  }

  public Response searchDataQualityLineage(
      String fqn, int upstreamDepth, String queryFilter, boolean deleted) throws IOException {
    return searchClient.searchDataQualityLineage(fqn, upstreamDepth, queryFilter, deleted);
  }

  public Response searchSchemaEntityRelationship(
      String fqn, int upstreamDepth, int downstreamDepth, String queryFilter, boolean deleted)
      throws IOException {
    return searchClient.searchSchemaEntityRelationship(
        fqn, upstreamDepth, downstreamDepth, queryFilter, deleted);
  }

  public SearchLineageResult searchLineageForExport(
      String fqn,
      int upstreamDepth,
      int downstreamDepth,
      String queryFilter,
      boolean deleted,
      String entityType)
      throws IOException {
    return searchClient.searchLineage(
        new SearchLineageRequest()
            .withFqn(fqn)
            .withUpstreamDepth(upstreamDepth)
            .withDownstreamDepth(downstreamDepth)
            .withQueryFilter(queryFilter)
            .withIncludeDeleted(deleted)
            .withIsConnectedVia(isConnectedVia(entityType)));
  }

  public Response searchByField(String fieldName, String fieldValue, String index, Boolean deleted)
      throws IOException {
    return searchClient.searchByField(fieldName, fieldValue, index, deleted);
  }

  public Response aggregate(AggregationRequest request) throws IOException {
    return searchClient.aggregate(request);
  }

  public Response getEntityTypeCounts(SearchRequest request, String index) throws IOException {
    return searchClient.getEntityTypeCounts(request, index);
  }

  public JsonObject aggregate(
      String query, String entityType, SearchAggregation searchAggregation, SearchListFilter filter)
      throws IOException {
    return searchClient.aggregate(
        query, entityType, searchAggregation, filter.getCondition(entityType));
  }

  public DataQualityReport genericAggregation(
      String query, String index, SearchAggregation aggregationMetadata) throws IOException {
    return searchClient.genericAggregation(query, index, aggregationMetadata);
  }

  public DataQualityReport genericAggregation(
      String query,
      String index,
      SearchAggregation aggregationMetadata,
      SubjectContext subjectContext)
      throws IOException {
    return searchClient.genericAggregation(query, index, aggregationMetadata, subjectContext);
  }

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
    return searchClient.listDataInsightChartResult(
        startTs, endTs, tier, team, dataInsightChartName, size, from, queryFilter, dataReportIndex);
  }

  public List<EntityReference> getEntitiesContainingFQNFromES(
      String entityFQN, int size, String indexName) {
    try {
      String queryFilter =
          String.format(
              "{\"query\":{\"bool\":{\"must\":[{\"wildcard\":{\"fullyQualifiedName\":\"%s.*\"}}]}}}",
              ReindexingUtil.escapeDoubleQuotes(entityFQN));

      SearchRequest searchRequest =
          new SearchRequest()
              .withQuery("")
              .withSize(size)
              .withIndex(Entity.getSearchRepository().getIndexOrAliasName(indexName))
              .withFrom(0)
              .withQueryFilter(queryFilter)
              .withFetchSource(true)
              .withTrackTotalHits(false)
              .withSortFieldParam("_score")
              .withDeleted(false)
              .withSortOrder("desc")
              .withIncludeSourceFields(new ArrayList<>());

      // Execute the search and parse the response
      Response response = search(searchRequest, null);
      String json = (String) response.getEntity();
      Set<EntityReference> fqns = new TreeSet<>(compareEntityReferenceById);

      // Extract hits from the response JSON and create entity references
      for (Iterator<JsonNode> it =
              ((ArrayNode) Objects.requireNonNull(JsonUtils.extractValue(json, HITS, HITS)))
                  .elements();
          it.hasNext(); ) {
        JsonNode jsonNode = it.next();
        String id = JsonUtils.extractValue(jsonNode, SEARCH_SOURCE, ID);
        String fqn = JsonUtils.extractValue(jsonNode, SEARCH_SOURCE, FULLY_QUALIFIED_NAME);
        String type = JsonUtils.extractValue(jsonNode, SEARCH_SOURCE, ENTITY_TYPE);
        if (!nullOrEmpty(fqn) && !nullOrEmpty(type)) {
          fqns.add(
              new EntityReference()
                  .withId(UUID.fromString(id))
                  .withFullyQualifiedName(fqn)
                  .withType(type));
        }
      }

      return new ArrayList<>(fqns);
    } catch (Exception ex) {
      LOG.error("Error while getting entities from ES for validation", ex);
    }
    return new ArrayList<>();
  }

  public Set<String> getSearchEntities() {
    return new HashSet<>(entityIndexMap.keySet());
  }

  private boolean shouldSkipStreamingIndexing(
      String entityType, String entityId, String entityFqn, String operation) {
    if (SearchIndexRetryQueue.isEntityTypeSuspended(entityType)) {
      LOG.debug(
          "Skipping live search indexing operation {} for entityType {} because reindex is active",
          operation,
          entityType);
      return true;
    }

    if (!getSearchClient().isClientAvailable()) {
      SearchIndexRetryQueue.enqueue(entityId, entityFqn, operation + ": Search client unavailable");
      return true;
    }
    return false;
  }

  public void deleteRelationshipFromSearch(UUID fromTableId, UUID toTableId) {
    String relationDocId = fromTableId.toString() + "-" + toTableId.toString();
    try {
      searchClient.updateChildren(
          GLOBAL_SEARCH_ALIAS,
          new ImmutablePair<>("upstreamEntityRelationship.docId.keyword", relationDocId),
          new ImmutablePair<>(
              REMOVE_ENTITY_RELATIONSHIP, Collections.singletonMap("docId", relationDocId)));
    } catch (Exception e) {
      SearchIndexRetryQueue.enqueue(
          fromTableId.toString(),
          null,
          Entity.TABLE,
          SearchIndexRetryQueue.failureReason("deleteRelationshipFromSearch", e));
      LOG.error(
          "Failed to delete relationship from search for {}: {}", relationDocId, e.getMessage());
    }
  }

  public QueryCostSearchResult getQueryCostRecords(String serviceName) throws IOException {
    return searchClient.getQueryCostRecords(serviceName);
  }

  public void initializeNLQService(ElasticSearchConfiguration config) {
    try {
      NaturalLanguageSearchConfiguration nlqConfig = config.getNaturalLanguageSearch();
      if (nlqConfig != null && Boolean.TRUE.equals(nlqConfig.getEnabled())) {
        nlqService = NLQServiceFactory.createNLQService(config);
        LOG.info("Initialized NLQ service with provider: {}", nlqConfig.getProviderClass());
      } else {
        LOG.info("Natural language search is not enabled");
      }
    } catch (Exception e) {
      LOG.error("Failed to initialize NLQ service", e);
    }
  }

  public BulkSink createBulkSink(
      int batchSize, int maxConcurrentRequests, long maxPayloadSizeBytes) {
    ElasticSearchConfiguration.SearchType searchType = getSearchType();
    if (searchType.equals(ElasticSearchConfiguration.SearchType.OPENSEARCH)) {
      return new OpenSearchBulkSink(this, batchSize, maxConcurrentRequests, maxPayloadSizeBytes);
    } else {
      return new ElasticSearchBulkSink(this, batchSize, maxConcurrentRequests, maxPayloadSizeBytes);
    }
  }

  public RecreateIndexHandler createReindexHandler() {
    return new RecreateWithEmbeddings();
  }

  public boolean isVectorEmbeddingEnabled() {
    ElasticSearchConfiguration cfg = getSearchConfiguration();
    return cfg != null
        && cfg.getNaturalLanguageSearch() != null
        && Boolean.TRUE.equals(cfg.getNaturalLanguageSearch().getSemanticSearchEnabled());
  }

  @SuppressWarnings("unused")
  public <T> T getHighLevelClient() {
    return searchClient.getHighLevelClient();
  }

  public SearchEntityRelationshipResult searchEntityRelationshipWithDirection(
      SearchEntityRelationshipRequest entityRelationshipRequest) throws IOException {
    return searchClient.searchEntityRelationshipWithDirection(entityRelationshipRequest);
  }

  public SearchEntityRelationshipResult searchEntityRelationship(
      SearchEntityRelationshipRequest entityRelationshipRequest) throws IOException {
    return searchClient.searchEntityRelationship(entityRelationshipRequest);
  }

  public org.openmetadata.schema.api.entityRelationship.SearchSchemaEntityRelationshipResult
      getSchemaEntityRelationship(
          String schemaFqn,
          String queryFilter,
          String includeSourceFields,
          int offset,
          int limit,
          int from,
          int size,
          boolean deleted)
          throws IOException {
    return searchClient.getSchemaEntityRelationship(
        schemaFqn, queryFilter, includeSourceFields, offset, limit, from, size, deleted);
  }

  private static List<EntityReference> copyWithInheritedFlag(List<EntityReference> references) {
    if (references == null || references.isEmpty()) {
      return new ArrayList<>();
    }
    List<EntityReference> inheritedReferences =
        JsonUtils.deepCopyList(references, EntityReference.class);
    inheritedReferences.forEach(ref -> ref.setInherited(true));
    return inheritedReferences;
  }

  private String reformatVectorIndexWithDimension(String mapping, int dimension) {
    try {
      com.fasterxml.jackson.databind.ObjectMapper mapper =
          new com.fasterxml.jackson.databind.ObjectMapper();
      JsonNode root = mapper.readTree(mapping);
      if (root.has("mappings")) {
        JsonNode mappings = root.get("mappings");
        com.fasterxml.jackson.databind.node.ObjectNode meta =
            ((com.fasterxml.jackson.databind.node.ObjectNode) mappings).putObject("_meta");
        meta.put(
                "embedding_model",
                embeddingClient != null ? embeddingClient.getModelId() : "unknown")
            .put("embedding_dimension", dimension);
      }
      return mapper.writeValueAsString(root);
    } catch (Exception e) {
      LOG.warn("Failed to set embedding _meta in mapping JSON", e);
      return mapping;
    }
  }

  protected EmbeddingClient createEmbeddingClient(ElasticSearchConfiguration esConfig) {
    NaturalLanguageSearchConfiguration config = esConfig.getNaturalLanguageSearch();
    String provider =
        config.getEmbeddingProvider() != null ? config.getEmbeddingProvider() : "bedrock";

    return switch (provider.toLowerCase()) {
      case "bedrock" -> {
        if (config.getBedrock() == null) {
          throw new IllegalStateException(
              "Bedrock configuration is required when using bedrock provider");
        }
        yield new BedrockEmbeddingClient(esConfig);
      }
      case "openai" -> {
        if (config.getOpenai() == null) {
          throw new IllegalStateException(
              "OpenAI configuration is required when using openai provider");
        }
        yield new OpenAIEmbeddingClient(esConfig);
      }
      case "djl" -> {
        if (config.getDjl() == null) {
          throw new IllegalStateException("DJL configuration is required when using djl provider");
        }
        yield new DjlEmbeddingClient(esConfig);
      }
      default -> throw new IllegalArgumentException("Unknown embedding provider: " + provider);
    };
  }

  public String getModelIdentifier() {
    return embeddingClient != null ? embeddingClient.getModelId() : null;
  }

  /**
   * Initialize advanced search features that depend on application settings.
   * This method is called during Phase 2 of application startup after
   * settings cache has been initialized and database settings are available.
   *
   * Currently initializes lineage builders that require LINEAGE_SETTINGS.
   */
  public void initializeLineageComponents() {
    LOG.info("Initializing lineage components for SearchRepository");

    if (searchClient != null) {
      try {
        searchClient.initializeLineageBuilders();
        LOG.info("Lineage components initialized successfully");
      } catch (Exception e) {
        LOG.error("Failed to initialize lineage components", e);
      }
    } else {
      LOG.warn("Cannot initialize lineage components - SearchClient is null");
    }
  }
}
