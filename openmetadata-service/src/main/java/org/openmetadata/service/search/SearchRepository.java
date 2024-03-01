package org.openmetadata.service.search;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.AGGREGATED_COST_ANALYSIS_REPORT_DATA;
import static org.openmetadata.service.Entity.ENTITY_REPORT_DATA;
import static org.openmetadata.service.Entity.FIELD_FOLLOWERS;
import static org.openmetadata.service.Entity.FIELD_USAGE_SUMMARY;
import static org.openmetadata.service.Entity.QUERY;
import static org.openmetadata.service.Entity.RAW_COST_ANALYSIS_REPORT_DATA;
import static org.openmetadata.service.Entity.WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA;
import static org.openmetadata.service.Entity.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA;
import static org.openmetadata.service.search.SearchClient.DEFAULT_UPDATE_SCRIPT;
import static org.openmetadata.service.search.SearchClient.GLOBAL_SEARCH_ALIAS;
import static org.openmetadata.service.search.SearchClient.PROPAGATE_ENTITY_REFERENCE_FIELD_SCRIPT;
import static org.openmetadata.service.search.SearchClient.PROPAGATE_FIELD_SCRIPT;
import static org.openmetadata.service.search.SearchClient.REMOVE_DOMAINS_CHILDREN_SCRIPT;
import static org.openmetadata.service.search.SearchClient.REMOVE_PROPAGATED_ENTITY_REFERENCE_FIELD_SCRIPT;
import static org.openmetadata.service.search.SearchClient.REMOVE_PROPAGATED_FIELD_SCRIPT;
import static org.openmetadata.service.search.SearchClient.REMOVE_TAGS_CHILDREN_SCRIPT;
import static org.openmetadata.service.search.SearchClient.REMOVE_TEST_SUITE_CHILDREN_SCRIPT;
import static org.openmetadata.service.search.SearchClient.SOFT_DELETE_RESTORE_SCRIPT;
import static org.openmetadata.service.search.SearchClient.UPDATE_ADDED_DELETE_GLOSSARY_TAGS;
import static org.openmetadata.service.search.SearchClient.UPDATE_PROPAGATED_ENTITY_REFERENCE_FIELD_SCRIPT;
import static org.openmetadata.service.search.models.IndexMapping.indexNameSeparator;

import com.fasterxml.jackson.core.type.TypeReference;
import java.io.IOException;
import java.io.InputStream;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.SortedMap;
import javax.json.JsonObject;
import javax.ws.rs.core.Response;
import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.exception.ExceptionUtils;
import org.apache.commons.lang3.tuple.ImmutablePair;
import org.apache.commons.lang3.tuple.Pair;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.EntityTimeSeriesInterface;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.schema.dataInsight.DataInsightChartResult;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.UsageDetails;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.UnhandledServerException;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.search.elasticsearch.ElasticSearchClient;
import org.openmetadata.service.search.indexes.SearchIndex;
import org.openmetadata.service.search.models.IndexMapping;
import org.openmetadata.service.search.opensearch.OpenSearchClient;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class SearchRepository {

  @Getter private final SearchClient searchClient;

  private Map<String, IndexMapping> entityIndexMap;

  private final String language;

  @Getter @Setter public SearchIndexFactory searchIndexFactory = new SearchIndexFactory();

  private final List<String> inheritableFields =
      List.of(Entity.FIELD_OWNER, Entity.FIELD_DOMAIN, Entity.FIELD_DISABLED);
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

  public SearchRepository(ElasticSearchConfiguration config) {
    elasticSearchConfiguration = config;
    if (config != null
        && config.getSearchType() == ElasticSearchConfiguration.SearchType.OPENSEARCH) {
      searchClient = new OpenSearchClient(config);
    } else {
      searchClient = new ElasticSearchClient(config);
    }
    try {
      if (config != null && (!nullOrEmpty(config.getSearchIndexFactoryClassName()))) {
        this.searchIndexFactory =
            Class.forName(config.getSearchIndexFactoryClassName())
                .asSubclass(SearchIndexFactory.class)
                .getDeclaredConstructor()
                .newInstance();
      }
    } catch (Exception e) {
      LOG.warn("Failed to initialize search index factory using default one", e);
    }
    language =
        config != null && config.getSearchIndexMappingLanguage() != null
            ? config.getSearchIndexMappingLanguage().value()
            : "en";
    clusterAlias = config != null ? config.getClusterAlias() : "";
    loadIndexMappings();
    Entity.setSearchRepository(this);
  }

  private void loadIndexMappings() {
    Set<String> entities;
    entityIndexMap = new HashMap<>();
    try (InputStream in = getClass().getResourceAsStream("/elasticsearch/indexMapping.json")) {
      assert in != null;
      JsonObject jsonPayload = JsonUtils.readJson(new String(in.readAllBytes())).asJsonObject();
      entities = jsonPayload.keySet();
      for (String s : entities) {
        entityIndexMap.put(
            s, JsonUtils.readValue(jsonPayload.get(s).toString(), IndexMapping.class));
      }
    } catch (Exception e) {
      throw new UnhandledServerException("Failed to load indexMapping.json", e);
    }
    try (InputStream in2 =
        getClass().getResourceAsStream("/elasticsearch/collate/indexMapping.json")) {
      if (in2 != null) {
        JsonObject jsonPayload = JsonUtils.readJson(new String(in2.readAllBytes())).asJsonObject();
        entities = jsonPayload.keySet();
        for (String s : entities) {
          entityIndexMap.put(
              s, JsonUtils.readValue(jsonPayload.get(s).toString(), IndexMapping.class));
        }
      }
    } catch (Exception e) {
      LOG.warn("Failed to load indexMapping.json");
    }
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

  public void dropIndexes() {
    for (IndexMapping indexMapping : entityIndexMap.values()) {
      deleteIndex(indexMapping);
    }
  }

  public IndexMapping getIndexMapping(String entityType) {
    return entityIndexMap.get(entityType);
  }

  public String getIndexOrAliasName(String name) {
    return clusterAlias != null && !clusterAlias.isEmpty()
        ? clusterAlias + indexNameSeparator + name
        : name;
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
          String.format(
              "Failed to Create Index for entity %s due to ",
              indexMapping.getIndexName(clusterAlias)),
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
      LOG.warn(
          String.format(
              "Failed to Update Index for entity %s", indexMapping.getIndexName(clusterAlias)));
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

  public void createEntity(EntityInterface entity) {
    if (entity != null) {
      String entityId = entity.getId().toString();
      String entityType = entity.getEntityReference().getType();
      try {
        IndexMapping indexMapping = entityIndexMap.get(entityType);
        SearchIndex index = searchIndexFactory.buildIndex(entityType, entity);
        String doc = JsonUtils.pojoToJson(index.buildESDoc());
        searchClient.createEntity(indexMapping.getIndexName(clusterAlias), entityId, doc);
      } catch (Exception ie) {
        LOG.error(
            String.format(
                "Issue in Creating new search document for entity [%s] and entityType [%s]. Reason[%s], Cause[%s], Stack [%s]",
                entityId,
                entityType,
                ie.getMessage(),
                ie.getCause(),
                ExceptionUtils.getStackTrace(ie)));
      }
    }
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
        String doc = JsonUtils.pojoToJson(index.buildESDoc());
        searchClient.createTimeSeriesEntity(indexMapping.getIndexName(clusterAlias), entityId, doc);
      } catch (Exception ie) {
        LOG.error(
            String.format(
                "Issue in Creating new search document for entity [%s] and entityType [%s]. Reason[%s], Cause[%s], Stack [%s]",
                entityId,
                entityType,
                ie.getMessage(),
                ie.getCause(),
                ExceptionUtils.getStackTrace(ie)));
      }
    }
  }

  public void updateEntity(EntityInterface entity) {
    if (entity != null) {
      String entityType = entity.getEntityReference().getType();
      String entityId = entity.getId().toString();
      try {
        IndexMapping indexMapping = entityIndexMap.get(entityType);
        String scriptTxt = DEFAULT_UPDATE_SCRIPT;
        Map<String, Object> doc = new HashMap<>();
        if (entity.getChangeDescription() != null
            && Objects.equals(
                entity.getVersion(), entity.getChangeDescription().getPreviousVersion())) {
          scriptTxt = getScriptWithParams(entity, doc);
        } else {
          SearchIndex elasticSearchIndex = searchIndexFactory.buildIndex(entityType, entity);
          doc = elasticSearchIndex.buildESDoc();
        }
        searchClient.updateEntity(
            indexMapping.getIndexName(clusterAlias), entityId, doc, scriptTxt);
        propagateInheritedFieldsToChildren(
            entityType, entityId, entity.getChangeDescription(), indexMapping);
        propagateGlossaryTags(
            entityType, entity.getFullyQualifiedName(), entity.getChangeDescription());
      } catch (Exception ie) {
        LOG.error(
            String.format(
                "Issue in Updatind the search document for entity [%s] and entityType [%s]. Reason[%s], Cause[%s], Stack [%s]",
                entityId,
                entityType,
                ie.getMessage(),
                ie.getCause(),
                ExceptionUtils.getStackTrace(ie)));
      }
    }
  }

  public void updateEntity(EntityReference entityReference) {
    EntityRepository<?> entityRepository = Entity.getEntityRepository(entityReference.getType());
    EntityInterface entity =
        entityRepository.get(null, entityReference.getId(), entityRepository.getFields("*"));
    // Update Entity
    updateEntity(entity);
  }

  public void propagateInheritedFieldsToChildren(
      String entityType,
      String entityId,
      ChangeDescription changeDescription,
      IndexMapping indexMapping) {
    if (changeDescription != null) {
      Pair<String, Map<String, Object>> updates = getInheritedFieldChanges(changeDescription);
      Pair<String, String> parentMatch;
      if (!updates.getValue().isEmpty()
          && updates.getValue().get("type").toString().equalsIgnoreCase("domain")
          && (entityType.equalsIgnoreCase(Entity.DATABASE_SERVICE)
              || entityType.equalsIgnoreCase(Entity.DASHBOARD_SERVICE)
              || entityType.equalsIgnoreCase(Entity.MESSAGING_SERVICE)
              || entityType.equalsIgnoreCase(Entity.PIPELINE_SERVICE)
              || entityType.equalsIgnoreCase(Entity.MLMODEL_SERVICE)
              || entityType.equalsIgnoreCase(Entity.STORAGE_SERVICE)
              || entityType.equalsIgnoreCase(Entity.SEARCH_SERVICE))) {
        parentMatch = new ImmutablePair<>("service.id", entityId);
      } else {
        parentMatch = new ImmutablePair<>(entityType + ".id", entityId);
      }
      if (updates.getKey() != null && !updates.getKey().isEmpty()) {
        searchClient.updateChildren(indexMapping.getAlias(clusterAlias), parentMatch, updates);
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
              JsonUtils.readObjects(
                  (String) changeDescription.getFieldsAdded().get(0).getNewValue(), TagLabel.class);
          tagLabels.forEach(tagLabel -> tagLabel.setLabelType(TagLabel.LabelType.DERIVED));
          fieldData.put("tagAdded", tagLabels);
        }
      }
      for (FieldChange field : changeDescription.getFieldsDeleted()) {
        if (propagateFields.contains(field.getName())) {
          List<TagLabel> tagLabels =
              JsonUtils.readObjects(
                  (String) changeDescription.getFieldsDeleted().get(0).getOldValue(),
                  TagLabel.class);
          tagLabels.forEach(tagLabel -> tagLabel.setLabelType(TagLabel.LabelType.DERIVED));
          fieldData.put("tagDeleted", tagLabels);
        }
      }
      searchClient.updateChildren(
          GLOBAL_SEARCH_ALIAS,
          new ImmutablePair<>("tags.tagFQN", glossaryFQN),
          new ImmutablePair<>(UPDATE_ADDED_DELETE_GLOSSARY_TAGS, fieldData));
    }
  }

  private Pair<String, Map<String, Object>> getInheritedFieldChanges(
      ChangeDescription changeDescription) {
    StringBuilder scriptTxt = new StringBuilder();
    Map<String, Object> fieldData = new HashMap<>();
    if (changeDescription != null) {
      for (FieldChange field : changeDescription.getFieldsAdded()) {
        if (inheritableFields.contains(field.getName())) {
          try {
            EntityReference entityReference =
                JsonUtils.readValue(field.getNewValue().toString(), EntityReference.class);
            scriptTxt.append(
                String.format(
                    PROPAGATE_ENTITY_REFERENCE_FIELD_SCRIPT, field.getName(), field.getName()));
            fieldData = JsonUtils.getMap(entityReference);
          } catch (UnhandledServerException e) {
            scriptTxt.append(
                String.format(PROPAGATE_FIELD_SCRIPT, field.getName(), field.getNewValue()));
          }
        }
      }
      for (FieldChange field : changeDescription.getFieldsUpdated()) {
        if (inheritableFields.contains(field.getName())) {
          try {
            EntityReference oldEntityReference =
                JsonUtils.readValue(field.getOldValue().toString(), EntityReference.class);
            EntityReference newEntityReference =
                JsonUtils.readValue(field.getNewValue().toString(), EntityReference.class);
            scriptTxt.append(
                String.format(
                    UPDATE_PROPAGATED_ENTITY_REFERENCE_FIELD_SCRIPT,
                    field.getName(),
                    field.getName(),
                    oldEntityReference.getId().toString(),
                    field.getName()));
            fieldData = JsonUtils.getMap(newEntityReference);
          } catch (UnhandledServerException e) {
            scriptTxt.append(
                String.format(PROPAGATE_FIELD_SCRIPT, field.getName(), field.getNewValue()));
          }
        }
      }
      for (FieldChange field : changeDescription.getFieldsDeleted()) {
        if (inheritableFields.contains(field.getName())) {
          try {
            EntityReference entityReference =
                JsonUtils.readValue(field.getOldValue().toString(), EntityReference.class);
            scriptTxt.append(
                String.format(
                    REMOVE_PROPAGATED_ENTITY_REFERENCE_FIELD_SCRIPT,
                    field.getName(),
                    field.getName(),
                    entityReference.getId().toString(),
                    field.getName()));
            fieldData = JsonUtils.getMap(entityReference);
          } catch (UnhandledServerException e) {
            scriptTxt.append(String.format(REMOVE_PROPAGATED_FIELD_SCRIPT, field.getName()));
          }
        }
      }
    }
    return new ImmutablePair<>(scriptTxt.toString(), fieldData);
  }

  public void deleteByScript(String entityType, String scriptTxt, Map<String, Object> params) {
    try {
      IndexMapping indexMapping = getIndexMapping(entityType);
      searchClient.deleteByScript(indexMapping.getIndexName(clusterAlias), scriptTxt, params);
    } catch (Exception ie) {
      LOG.error(
          String.format(
              "Issue in Creating new search document for entityType [%s]. Reason[%s], Cause[%s], Stack [%s]",
              entityType, ie.getMessage(), ie.getCause(), ExceptionUtils.getStackTrace(ie)));
    }
  }

  public void deleteEntity(EntityInterface entity) {
    if (entity != null) {
      String entityId = entity.getId().toString();
      String entityType = entity.getEntityReference().getType();
      IndexMapping indexMapping = entityIndexMap.get(entityType);
      try {
        searchClient.deleteEntity(indexMapping.getIndexName(clusterAlias), entityId);
        deleteOrUpdateChildren(entity, indexMapping);
      } catch (Exception ie) {
        LOG.error(
            String.format(
                "Issue in Deleting the search document for entityID [%s] and entityType [%s]. Reason[%s], Cause[%s], Stack [%s]",
                entityId,
                entityType,
                ie.getMessage(),
                ie.getCause(),
                ExceptionUtils.getStackTrace(ie)));
      }
    }
  }

  public void softDeleteOrRestoreEntity(EntityInterface entity, boolean delete) {
    if (entity != null) {
      String entityId = entity.getId().toString();
      String entityType = entity.getEntityReference().getType();
      IndexMapping indexMapping = entityIndexMap.get(entityType);
      String scriptTxt = String.format(SOFT_DELETE_RESTORE_SCRIPT, delete);
      try {
        searchClient.softDeleteOrRestoreEntity(
            indexMapping.getIndexName(clusterAlias), entityId, scriptTxt);
        softDeleteOrRestoredChildren(entity, indexMapping, delete);
      } catch (Exception ie) {
        LOG.error(
            String.format(
                "Issue in Soft Deleting the search document for entityID [%s] and entityType [%s]. Reason[%s], Cause[%s], Stack [%s]",
                entityId,
                entityType,
                ie.getMessage(),
                ie.getCause(),
                ExceptionUtils.getStackTrace(ie)));
      }
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
            indexMapping.getAlias(clusterAlias),
            List.of(new ImmutablePair<>(entityType + ".id", docId)));
      }
      case Entity.TAG, Entity.GLOSSARY_TERM -> searchClient.updateChildren(
          GLOBAL_SEARCH_ALIAS,
          new ImmutablePair<>("tags.tagFQN", entity.getFullyQualifiedName()),
          new ImmutablePair<>(REMOVE_TAGS_CHILDREN_SCRIPT, null));
      case Entity.TEST_SUITE -> {
        TestSuite testSuite = (TestSuite) entity;
        if (Boolean.TRUE.equals(testSuite.getExecutable())) {
          searchClient.deleteEntityByFields(
              indexMapping.getAlias(clusterAlias),
              List.of(new ImmutablePair<>("testSuites.id", docId)));
        } else {
          searchClient.updateChildren(
              indexMapping.getAlias(clusterAlias),
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
          indexMapping.getAlias(clusterAlias), List.of(new ImmutablePair<>("service.id", docId)));
      default -> searchClient.deleteEntityByFields(
          indexMapping.getAlias(clusterAlias),
          List.of(new ImmutablePair<>(entityType + ".id", docId)));
    }
  }

  public void softDeleteOrRestoredChildren(
      EntityInterface entity, IndexMapping indexMapping, boolean delete) {
    String docId = entity.getId().toString();
    String entityType = entity.getEntityReference().getType();
    String scriptTxt = String.format(SOFT_DELETE_RESTORE_SCRIPT, delete);
    switch (entityType) {
      case Entity.DASHBOARD_SERVICE,
          Entity.DATABASE_SERVICE,
          Entity.MESSAGING_SERVICE,
          Entity.PIPELINE_SERVICE,
          Entity.MLMODEL_SERVICE,
          Entity.STORAGE_SERVICE,
          Entity.SEARCH_SERVICE -> searchClient.softDeleteOrRestoreChildren(
          indexMapping.getAlias(clusterAlias),
          scriptTxt,
          List.of(new ImmutablePair<>("service.id", docId)));
      default -> searchClient.softDeleteOrRestoreChildren(
          indexMapping.getAlias(clusterAlias),
          scriptTxt,
          List.of(new ImmutablePair<>(entityType + ".id", docId)));
    }
  }

  public String getScriptWithParams(EntityInterface entity, Map<String, Object> fieldAddParams) {
    ChangeDescription changeDescription = entity.getChangeDescription();

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
    }
    return scriptTxt.toString();
  }

  public Response search(SearchRequest request) throws IOException {
    return searchClient.search(request);
  }

  public Response searchBySourceUrl(String sourceUrl) throws IOException {
    return searchClient.searchBySourceUrl(sourceUrl);
  }

  public Response searchLineage(
      String fqn,
      int upstreamDepth,
      int downstreamDepth,
      String queryFilter,
      boolean deleted,
      String entityType)
      throws IOException {
    return searchClient.searchLineage(
        fqn, upstreamDepth, downstreamDepth, queryFilter, deleted, entityType);
  }

  public Response searchByField(String fieldName, String fieldValue, String index)
      throws IOException {
    return searchClient.searchByField(fieldName, fieldValue, index);
  }

  public Response aggregate(String index, String fieldName, String value, String query)
      throws IOException {
    return searchClient.aggregate(index, fieldName, value, query);
  }

  public JsonObject aggregate(String query, String index, JsonObject aggregationJson)
      throws IOException {
    return searchClient.aggregate(query, index, aggregationJson);
  }

  public Response suggest(SearchRequest request) throws IOException {
    return searchClient.suggest(request);
  }

  public SortedMap<Long, List<Object>> getSortedDate(
      String team,
      Long scheduleTime,
      Long currentTime,
      DataInsightChartResult.DataInsightChartType chartType,
      String indexName)
      throws IOException, ParseException {
    return searchClient.getSortedDate(team, scheduleTime, currentTime, chartType, indexName);
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
      throws IOException, ParseException {
    return searchClient.listDataInsightChartResult(
        startTs, endTs, tier, team, dataInsightChartName, size, from, queryFilter, dataReportIndex);
  }
}
