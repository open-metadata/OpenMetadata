package org.openmetadata.service.search;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.search.IndexMapping.INDEX_NAME_SEPARATOR;
import static org.openmetadata.service.Entity.AGGREGATED_COST_ANALYSIS_REPORT_DATA;
import static org.openmetadata.service.Entity.ENTITY_REPORT_DATA;
import static org.openmetadata.service.Entity.FIELD_DISPLAY_NAME;
import static org.openmetadata.service.Entity.FIELD_DOMAIN;
import static org.openmetadata.service.Entity.FIELD_FOLLOWERS;
import static org.openmetadata.service.Entity.FIELD_FULLY_QUALIFIED_NAME;
import static org.openmetadata.service.Entity.FIELD_NAME;
import static org.openmetadata.service.Entity.FIELD_OWNERS;
import static org.openmetadata.service.Entity.FIELD_USAGE_SUMMARY;
import static org.openmetadata.service.Entity.QUERY;
import static org.openmetadata.service.Entity.RAW_COST_ANALYSIS_REPORT_DATA;
import static org.openmetadata.service.Entity.WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA;
import static org.openmetadata.service.Entity.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA;
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
import static org.openmetadata.service.search.SearchClient.REMOVE_ENTITY_RELATIONSHIP;
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
import static org.openmetadata.service.search.SearchConstants.ENTITY_TYPE;
import static org.openmetadata.service.search.SearchConstants.FAILED_TO_CREATE_INDEX_MESSAGE;
import static org.openmetadata.service.search.SearchConstants.FULLY_QUALIFIED_NAME;
import static org.openmetadata.service.search.SearchConstants.HITS;
import static org.openmetadata.service.search.SearchConstants.ID;
import static org.openmetadata.service.search.SearchConstants.PARENT;
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
import org.apache.commons.lang.exception.ExceptionUtils;
import org.apache.commons.lang3.tuple.ImmutablePair;
import org.apache.commons.lang3.tuple.Pair;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.EntityTimeSeriesInterface;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.schema.api.lineage.SearchLineageRequest;
import org.openmetadata.schema.api.lineage.SearchLineageResult;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.dataInsight.DataInsightChartResult;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.QueryCostSearchResult;
import org.openmetadata.schema.search.AggregationRequest;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.service.configuration.elasticsearch.NaturalLanguageSearchConfiguration;
import org.openmetadata.schema.tests.DataQualityReport;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.AssetCertification;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.UsageDetails;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.search.IndexMappingLoader;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventDispatcher;
import org.openmetadata.service.events.lifecycle.handlers.SearchIndexHandler;
import org.openmetadata.service.exception.UnhandledServerException;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.search.elasticsearch.ElasticSearchClient;
import org.openmetadata.service.search.indexes.SearchIndex;
import org.openmetadata.service.search.nlq.NLQService;
import org.openmetadata.service.search.nlq.NLQServiceFactory;
import org.openmetadata.service.search.opensearch.OpenSearchClient;
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

  private final List<String> inheritableFields =
      List.of(
          FIELD_OWNERS,
          FIELD_DOMAIN,
          Entity.FIELD_DISABLED,
          Entity.FIELD_TEST_SUITES,
          FIELD_DISPLAY_NAME);
  private final List<String> propagateFields = List.of(Entity.FIELD_TAGS);

  @Getter private final ElasticSearchConfiguration elasticSearchConfiguration;

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
  @Getter private final Integer databaseMaxPoolSize;

  public SearchRepository(ElasticSearchConfiguration config) {
    this(config, null);
  }

  public SearchRepository(ElasticSearchConfiguration config, Integer databaseMaxPoolSize) {
    elasticSearchConfiguration = config;
    this.databaseMaxPoolSize = databaseMaxPoolSize;
    searchClient = buildSearchClient(config);
    searchIndexFactory = buildIndexFactory();
    language =
        config != null && config.getSearchIndexMappingLanguage() != null
            ? config.getSearchIndexMappingLanguage().value()
            : "en";
    clusterAlias = config != null ? config.getClusterAlias() : "";
    loadIndexMappings();

    // Register the search index handler as the primary handler for search operations
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
          searchClient = buildSearchClient(elasticSearchConfiguration);
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
    for (IndexMapping indexMapping : entityIndexMap.values()) {
      createIndex(indexMapping);
    }
  }

  public void updateIndexes() {
    for (IndexMapping indexMapping : entityIndexMap.values()) {
      updateIndex(indexMapping);
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

  public String getIndexNameWithoutAlias(String fullIndexName) {
    if (clusterAlias != null
        && !clusterAlias.isEmpty()
        && fullIndexName.startsWith(clusterAlias + INDEX_NAME_SEPARATOR)) {
      return fullIndexName.substring((clusterAlias + INDEX_NAME_SEPARATOR).length());
    }
    return fullIndexName;
  }

  public boolean indexExists(IndexMapping indexMapping) {
    return searchClient.indexExists(indexMapping.getIndexName(clusterAlias));
  }

  public void createIndex(IndexMapping indexMapping) {
    try {
      if (!indexExists(indexMapping)) {
        String indexMappingContent = getIndexMapping(indexMapping);
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
      String indexMappingContent = getIndexMapping(indexMapping);
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
      if (indexExists(indexMapping)) {
        searchClient.deleteIndex(indexMapping);
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
    try {
      IndexMapping indexMapping = entityIndexMap.get(entityType);
      SearchIndex index = searchIndexFactory.buildIndex(entityType, entity);
      String doc = JsonUtils.pojoToJson(index.buildSearchIndexDoc());
      searchClient.createEntity(indexMapping.getIndexName(clusterAlias), entityId, doc);
    } catch (Exception ie) {
      LOG.error(
          "Issue in Creating new search document for entity [{}] and entityType [{}]. Reason[{}], Cause[{}], Stack [{}]",
          entityId,
          entityType,
          ie.getMessage(),
          ie.getCause(),
          ExceptionUtils.getStackTrace(ie));
    }
  }

  /**
   * Create search indexes for multiple entities only (no lifecycle events).
   * This method is used by SearchIndexHandler.
   */
  public void createEntitiesIndex(List<EntityInterface> entities) {
    if (!nullOrEmpty(entities)) {
      // All entities in the list are of the same type
      String entityType = entities.getFirst().getEntityReference().getType();
      IndexMapping indexMapping = entityIndexMap.get(entityType);
      List<Map<String, String>> docs = new ArrayList<>();
      for (EntityInterface entity : entities) {
        SearchIndex index = searchIndexFactory.buildIndex(entityType, entity);
        String doc = JsonUtils.pojoToJson(index.buildSearchIndexDoc());
        docs.add(Collections.singletonMap(entity.getId().toString(), doc));
      }

      try {
        searchClient.createEntities(indexMapping.getIndexName(clusterAlias), docs);
      } catch (Exception ie) {
        LOG.error(
            "Issue in Creating entities document for entityType [{}]. Reason[{}], Cause[{}], Stack [{}]",
            entityType,
            ie.getMessage(),
            ie.getCause(),
            ExceptionUtils.getStackTrace(ie));
      }
    }
  }

  /**
   * Create search indexes for multiple entities and dispatch lifecycle events.
   * This method maintains backward compatibility.
   */
  public void createEntities(List<EntityInterface> entities) {
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
      try {
        IndexMapping indexMapping = entityIndexMap.get(entityType);
        SearchIndex index = searchIndexFactory.buildIndex(entityType, entity);
        String doc = JsonUtils.pojoToJson(index.buildSearchIndexDoc());
        searchClient.createTimeSeriesEntity(indexMapping.getIndexName(clusterAlias), entityId, doc);
      } catch (Exception ie) {
        LOG.error(
            "Issue in Creating new search document for entity [{}] and entityType [{}]. Reason[{}], Cause[{}], Stack [{}]",
            entityId,
            entityType,
            ie.getMessage(),
            ie.getCause(),
            ExceptionUtils.getStackTrace(ie));
      }
    }
  }

  public void updateTimeSeriesEntity(EntityTimeSeriesInterface entityTimeSeries) {
    if (entityTimeSeries != null) {
      String entityType = entityTimeSeries.getEntityReference().getType();
      String entityId = entityTimeSeries.getId().toString();
      try {
        IndexMapping indexMapping = entityIndexMap.get(entityType);
        SearchIndex elasticSearchIndex =
            searchIndexFactory.buildIndex(entityType, entityTimeSeries);
        Map<String, Object> doc = elasticSearchIndex.buildSearchIndexDoc();
        searchClient.updateEntity(
            indexMapping.getIndexName(clusterAlias), entityId, doc, DEFAULT_UPDATE_SCRIPT);
      } catch (RuntimeException e) {
        LOG.error(
            "Issue in Updating the search document for entity [{}] and entityType [{}]. Reason[{}], Cause[{}], Stack [{}]",
            entityId,
            entityType,
            e.getMessage(),
            e.getCause(),
            ExceptionUtils.getStackTrace(e));
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

      if (changeDescription != null
          && entity.getChangeDescription() != null
          && Objects.equals(
              entity.getVersion(), entity.getChangeDescription().getPreviousVersion())) {
        scriptTxt = getScriptWithParams(entity, doc, changeDescription);
      } else {
        SearchIndex elasticSearchIndex = searchIndexFactory.buildIndex(entityType, entity);
        doc = elasticSearchIndex.buildSearchIndexDoc();
      }
      searchClient.updateEntity(indexMapping.getIndexName(clusterAlias), entityId, doc, scriptTxt);
      propagateInheritedFieldsToChildren(
          entityType, entityId, changeDescription, indexMapping, entity);
      propagateGlossaryTags(entityType, entity.getFullyQualifiedName(), changeDescription);
      propagateCertificationTags(entityType, entity, changeDescription);
      propagateToRelatedEntities(entityType, changeDescription, indexMapping, entity);
    } catch (Exception ie) {
      LOG.error(
          "Issue in Updating the search document for entity [{}] and entityType [{}]. Reason[{}], Cause[{}], Stack [{}]",
          entityId,
          entityType,
          ie.getMessage(),
          ie.getCause(),
          ExceptionUtils.getStackTrace(ie));
    }
  }

  public void updateEntity(EntityReference entityReference) {
    EntityRepository<?> entityRepository = Entity.getEntityRepository(entityReference.getType());
    EntityInterface entity =
        entityRepository.get(null, entityReference.getId(), entityRepository.getFields("*"));
    // Update Entity
    updateEntityIndex(entity);
  }

  public boolean checkIfIndexingIsSupported(String entityType) {
    IndexMapping indexMapping = entityIndexMap.get(entityType);
    if (indexMapping == null) {
      LOG.debug("Index mapping is not supported for entity type: {}", entityType);
      return false;
    }
    return true;
  }

  public void propagateInheritedFieldsToChildren(
      String entityType,
      String entityId,
      ChangeDescription changeDescription,
      IndexMapping indexMapping,
      EntityInterface entity) {
    if (changeDescription != null) {
      Pair<String, Map<String, Object>> updates =
          getInheritedFieldChanges(changeDescription, entity);
      Pair<String, String> parentMatch;
      if (!updates.getValue().isEmpty()
          && (updates.getValue().containsKey(FIELD_DOMAIN)
              || updates.getValue().containsKey(FIELD_DISPLAY_NAME))) {
        if (entityType.equalsIgnoreCase(Entity.DATABASE_SERVICE)
            || entityType.equalsIgnoreCase(Entity.DASHBOARD_SERVICE)
            || entityType.equalsIgnoreCase(Entity.MESSAGING_SERVICE)
            || entityType.equalsIgnoreCase(Entity.PIPELINE_SERVICE)
            || entityType.equalsIgnoreCase(Entity.MLMODEL_SERVICE)
            || entityType.equalsIgnoreCase(Entity.STORAGE_SERVICE)
            || entityType.equalsIgnoreCase(Entity.SEARCH_SERVICE)
            || entityType.equalsIgnoreCase(Entity.API_SERVICE)) {
          parentMatch = new ImmutablePair<>(SERVICE_ID, entityId);
        } else {
          parentMatch = new ImmutablePair<>(entityType + ".id", entityId);
        }
      } else {
        parentMatch = new ImmutablePair<>(entityType + ".id", entityId);
      }
      List<String> childAliases = indexMapping.getChildAliases(clusterAlias);
      if (updates.getKey() != null && !updates.getKey().isEmpty() && !nullOrEmpty(childAliases)) {
        searchClient.updateChildren(childAliases, parentMatch, updates);
      }
    }
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
      String indexName = indexMapping.getIndexName();
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
          paramMap.put("tagFQN", oldFQN);
          paramMap.put("updates", updates);
          searchClient.updateChildren(
              GLOBAL_SEARCH_ALIAS,
              new ImmutablePair<>(TAGS_FQN, oldFQN),
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
          } catch (UnhandledServerException e) {
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
          } catch (UnhandledServerException e) {
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
          } catch (UnhandledServerException e) {
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
        || entityType.equalsIgnoreCase(Entity.API_SERVICE)) {
      return "service." + fieldName;
    } else {
      return entityType + "." + fieldName;
    }
  }

  public void deleteByScript(String entityType, String scriptTxt, Map<String, Object> params) {
    try {
      IndexMapping indexMapping = getIndexMapping(entityType);
      searchClient.deleteByScript(indexMapping.getIndexName(clusterAlias), scriptTxt, params);
    } catch (Exception ie) {
      LOG.error(
          "Issue in deleting  search document for entityType [{}]. Reason[{}], Cause[{}], Stack [{}]",
          entityType,
          ie.getMessage(),
          ie.getCause(),
          ExceptionUtils.getStackTrace(ie));
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
    IndexMapping indexMapping = entityIndexMap.get(entityType);
    try {
      searchClient.deleteEntity(indexMapping.getIndexName(clusterAlias), entityId);
      deleteOrUpdateChildren(entity, indexMapping);
    } catch (Exception ie) {
      LOG.error(
          "Issue in Deleting the search document for entityID [{}] and entityType [{}]. Reason[{}], Cause[{}], Stack [{}]",
          entityId,
          entityType,
          ie.getMessage(),
          ie.getCause(),
          ExceptionUtils.getStackTrace(ie));
    }
  }

  public void deleteEntityByFQNPrefix(EntityInterface entity) {
    if (entity != null) {
      String entityType = entity.getEntityReference().getType();
      String fqn = entity.getFullyQualifiedName();
      IndexMapping indexMapping = entityIndexMap.get(entityType);
      try {
        searchClient.deleteEntityByFQNPrefix(indexMapping.getIndexName(clusterAlias), fqn);
      } catch (Exception ie) {
        LOG.error(
            "Issue in Deleting the search document for entityFQN [{}] and entityType [{}]. Reason[{}], Cause[{}], Stack [{}]",
            fqn,
            entityType,
            ie.getMessage(),
            ie.getCause(),
            ExceptionUtils.getStackTrace(ie));
      }
    }
  }

  public void deleteTimeSeriesEntityById(EntityTimeSeriesInterface entity) {
    if (entity != null) {
      String entityId = entity.getId().toString();
      String entityType = entity.getEntityReference().getType();
      IndexMapping indexMapping = entityIndexMap.get(entityType);
      try {
        searchClient.deleteEntity(indexMapping.getIndexName(clusterAlias), entityId);
      } catch (Exception ie) {
        LOG.error(
            "Issue in Deleting the search document for entityID [{}] and entityType [{}]. Reason[{}], Cause[{}], Stack [{}]",
            entityId,
            entityType,
            ie.getMessage(),
            ie.getCause(),
            ExceptionUtils.getStackTrace(ie));
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
    IndexMapping indexMapping = entityIndexMap.get(entityType);
    String scriptTxt = String.format(SOFT_DELETE_RESTORE_SCRIPT, delete);
    try {
      searchClient.softDeleteOrRestoreEntity(
          indexMapping.getIndexName(clusterAlias), entityId, scriptTxt);
      softDeleteOrRestoredChildren(entity.getEntityReference(), indexMapping, delete);
    } catch (Exception ie) {
      LOG.error(
          "Issue in Soft Deleting the search document for entityID [{}] and entityType [{}]. Reason[{}], Cause[{}], Stack [{}]",
          entityId,
          entityType,
          ie.getMessage(),
          ie.getCause(),
          ExceptionUtils.getStackTrace(ie));
    }
  }

  public void deleteOrUpdateChildren(EntityInterface entity, IndexMapping indexMapping) {
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
      case Entity.DASHBOARD -> {
        String scriptTxt =
            String.format(
                "if (ctx._source.dashboards.size() == 1) { ctx._source.put('deleted', '%s') }",
                true);
        searchClient.softDeleteOrRestoreChildren(
            indexMapping.getChildAliases(clusterAlias),
            scriptTxt,
            List.of(new ImmutablePair<>("dashboards.id", docId)));
      }
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
              new ImmutablePair<>(REMOVE_TEST_SUITE_CHILDREN_SCRIPT, null));
        }
      }
      case Entity.DASHBOARD_SERVICE,
          Entity.DATABASE_SERVICE,
          Entity.MESSAGING_SERVICE,
          Entity.PIPELINE_SERVICE,
          Entity.MLMODEL_SERVICE,
          Entity.STORAGE_SERVICE,
          Entity.SEARCH_SERVICE -> searchClient.deleteEntityByFields(
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
      EntityReference entityReference, IndexMapping indexMapping, boolean delete) {
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
          Entity.SEARCH_SERVICE -> searchClient.softDeleteOrRestoreChildren(
          indexMapping.getChildAliases(clusterAlias),
          scriptTxt,
          List.of(new ImmutablePair<>("service.id", docId)));
      case Entity.DASHBOARD -> {
        scriptTxt =
            String.format(
                "if (ctx._source.dashboards.size() == 1) { ctx._source.put('deleted', '%s') }",
                delete);
        searchClient.softDeleteOrRestoreChildren(
            indexMapping.getChildAliases(clusterAlias),
            scriptTxt,
            List.of(new ImmutablePair<>("dashboards.id", docId)));
      }
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
    }

    for (FieldChange fieldChange : changeDescription.getFieldsUpdated()) {
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
    }
    return scriptTxt.toString();
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

  public void deleteRelationshipFromSearch(UUID fromTableId, UUID toTableId) {
    String relationDocId = fromTableId.toString() + "-" + toTableId.toString();
    searchClient.updateChildren(
        GLOBAL_SEARCH_ALIAS,
        new ImmutablePair<>("entityRelationship.docId.keyword", relationDocId),
        new ImmutablePair<>(String.format(REMOVE_ENTITY_RELATIONSHIP, relationDocId), null));
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
}
