package org.openmetadata.service.jdbi3;

import static org.openmetadata.schema.type.EventType.ENTITY_UPDATED;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.service.Entity.getEntityFields;
import static org.openmetadata.service.util.jdbi.JdbiUtils.getAfterOffset;
import static org.openmetadata.service.util.jdbi.JdbiUtils.getBeforeOffset;
import static org.openmetadata.service.util.jdbi.JdbiUtils.getOffset;

import jakarta.json.JsonObject;
import jakarta.json.JsonPatch;
import jakarta.ws.rs.core.Response;
import java.beans.IntrospectionException;
import java.io.IOException;
import java.lang.reflect.InvocationTargetException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.Getter;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.EntityTimeSeriesInterface;
import org.openmetadata.schema.system.EntityError;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.search.SearchAggregation;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.SearchListFilter;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.SearchResultListMapper;
import org.openmetadata.service.search.SearchSortFilter;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

@Getter
@Repository
public abstract class EntityTimeSeriesRepository<T extends EntityTimeSeriesInterface> {
  protected final String collectionPath;
  protected final EntityTimeSeriesDAO timeSeriesDao;
  protected final SearchRepository searchRepository;
  protected final String entityType;
  protected final Class<T> entityClass;
  protected final CollectionDAO daoCollection;
  protected final Set<String> allowedFields;

  public EntityTimeSeriesRepository(
      String collectionPath,
      EntityTimeSeriesDAO timeSeriesDao,
      Class<T> entityClass,
      String entityType) {
    this.collectionPath = collectionPath;
    this.timeSeriesDao = timeSeriesDao;
    this.entityClass = entityClass;
    this.entityType = entityType;
    this.searchRepository = Entity.getSearchRepository();
    this.daoCollection = Entity.getCollectionDAO();
    this.allowedFields = getEntityFields(entityClass);
    Entity.registerEntity(entityClass, entityType, this);
  }

  @Transaction
  public T createNewRecord(T recordEntity, String recordFQN) {
    return createNewRecord(recordEntity, null, recordFQN);
  }

  @Transaction
  public T createNewRecord(T recordEntity, String extension, String recordFQN) {
    recordEntity.setId(UUID.randomUUID());
    storeInternal(recordEntity, recordFQN, extension);
    storeRelationshipInternal(recordEntity);
    postCreate(recordEntity);
    return recordEntity;
  }

  @Transaction
  protected void storeInternal(T recordEntity, String recordFQN) {
    storeInternal(recordEntity, recordFQN, null);
  }

  @Transaction
  protected void storeInternal(T recordEntity, String recordFQN, String extension) {
    if (extension != null) {
      timeSeriesDao.insert(recordFQN, extension, entityType, JsonUtils.pojoToJson(recordEntity));
    } else {
      timeSeriesDao.insert(recordFQN, entityType, JsonUtils.pojoToJson(recordEntity));
    }
  }

  public final EntityUtil.Fields getFields(String fields) {
    if ("*".equals(fields)) {
      return new EntityUtil.Fields(allowedFields, String.join(",", allowedFields));
    }
    return new EntityUtil.Fields(allowedFields, fields);
  }

  protected void storeRelationshipInternal(T recordEntity) {
    storeRelationship(recordEntity);
  }

  protected void storeRelationship(T recordEntity) {
    // Nothing to do in the default implementation
  }

  protected void setInheritedFields(T recordEntity) {
    // Nothing to do in the default implementation
  }

  protected T setFieldsInternal(T recordEntity, EntityUtil.Fields fields) {
    setFields(recordEntity, fields);
    return recordEntity;
  }

  protected void setFields(T recordEntity, EntityUtil.Fields fields) {
    // Nothing to do in the default implementation
  }

  protected void clearFieldsInternal(T recordEntity, EntityUtil.Fields fields) {
    clearFields(recordEntity, fields);
  }

  protected void clearFields(T recordEntity, EntityUtil.Fields fields) {
    // Nothing to do in the default implementation
  }

  protected void setUpdatedFields(T updated, String user) {
    // Nothing to do in the default implementation
  }

  protected void validatePatchFields(T updated, T original) {
    // Nothing to do in the default implementation
  }

  @Transaction
  public final void addRelationship(
      UUID fromId,
      UUID toId,
      String fromEntity,
      String toEntity,
      Relationship relationship,
      String json,
      boolean bidirectional) {
    UUID from = fromId;
    UUID to = toId;
    if (bidirectional && fromId.compareTo(toId) > 0) {
      // For bidirectional relationship, instead of adding two row fromId -> toId and toId ->
      // fromId, just add one row where fromId is alphabetically less than toId
      from = toId;
      to = fromId;
    }
    daoCollection
        .relationshipDAO()
        .insert(from, to, fromEntity, toEntity, relationship.ordinal(), json);
  }

  protected void postCreate(T recordEntity) {
    searchRepository.createTimeSeriesEntity(JsonUtils.deepCopy(recordEntity, entityClass));
  }

  protected void postDelete(T recordEntity) {
    searchRepository.deleteTimeSeriesEntityById(JsonUtils.deepCopy(recordEntity, entityClass));
  }

  protected void postUpdate(T updated) {
    searchRepository.updateTimeSeriesEntity(updated);
  }

  // Database Repository Methods
  // -------------------------
  public final List<CollectionDAO.EntityRelationshipRecord> findFromRecords(
      UUID toId, String toEntityType, Relationship relationship, String fromEntityType) {
    // When fromEntityType is null, all the relationships from any entity is returned
    return fromEntityType == null
        ? daoCollection.relationshipDAO().findFrom(toId, toEntityType, relationship.ordinal())
        : daoCollection
            .relationshipDAO()
            .findFrom(toId, toEntityType, relationship.ordinal(), fromEntityType);
  }

  protected EntityReference getFromEntityRef(
      UUID toId, Relationship relationship, String fromEntityType, boolean mustHaveRelationship) {
    List<CollectionDAO.EntityRelationshipRecord> records =
        findFromRecords(toId, entityType, relationship, fromEntityType);
    EntityRepository.ensureSingleRelationship(
        entityType, toId, records, relationship.value(), fromEntityType, mustHaveRelationship);
    return !records.isEmpty()
        ? Entity.getEntityReferenceById(records.get(0).getType(), records.get(0).getId(), ALL)
        : null;
  }

  public final ResultList<T> getResultList(
      List<T> entities,
      String beforeCursor,
      String afterCursor,
      int total,
      List<EntityError> errors) {
    if (errors == null) {
      return new ResultList<>(entities, beforeCursor, afterCursor, total);
    }
    return new ResultList<>(entities, errors, beforeCursor, afterCursor, total);
  }

  public final ResultList<T> getResultList(
      List<T> entities, String beforeCursor, String afterCursor, int total) {
    return getResultList(entities, beforeCursor, afterCursor, total, null);
  }

  /**
   * Forward paginate a list of entities ordered and paginated by timestamp
   *
   * @return ResultList
   */
  public ResultList<T> listWithOffset(
      String offset,
      ListFilter filter,
      int limitParam,
      Long startTs,
      Long endTs,
      boolean latest,
      boolean skipErrors) {
    int total = timeSeriesDao.listCount(filter, startTs, endTs, latest);
    return listWithOffsetInternal(
        offset, filter, limitParam, startTs, endTs, latest, skipErrors, total);
  }

  public ResultList<T> listWithOffset(
      String offset, ListFilter filter, int limitParam, boolean skipErrors) {
    int total = timeSeriesDao.listCount(filter);
    return listWithOffsetInternal(offset, filter, limitParam, null, null, false, skipErrors, total);
  }

  private ResultList<T> listWithOffsetInternal(
      String offset,
      ListFilter filter,
      int limitParam,
      Long startTs,
      Long endTs,
      boolean latest,
      boolean skipErrors,
      int total) {
    List<T> entityList = new ArrayList<>();
    List<EntityError> errors = null;

    int offsetInt = getOffset(offset);
    String afterOffset = getAfterOffset(offsetInt, limitParam, total);
    String beforeOffset = getBeforeOffset(offsetInt, limitParam);
    if (limitParam > 0) {
      List<String> jsons =
          (startTs != null && endTs != null)
              ? timeSeriesDao.listWithOffset(filter, limitParam, offsetInt, startTs, endTs, latest)
              : timeSeriesDao.listWithOffset(filter, limitParam, offsetInt);
      Map<String, List<?>> entityListMap = getEntityList(jsons, skipErrors);
      entityList = (List<T>) entityListMap.get("entityList");
      if (skipErrors) {
        errors = (List<EntityError>) entityListMap.get("errors");
      }
      return getResultList(entityList, beforeOffset, afterOffset, total, errors);
    } else {
      return getResultList(entityList, null, null, total);
    }
  }

  public ResultList<T> list(
      String offset, Long startTs, Long endTs, int limitParam, ListFilter filter, boolean latest) {
    return listWithOffset(offset, filter, limitParam, startTs, endTs, latest, false);
  }

  public T getLatestRecord(String recordFQN) {
    String jsonRecord = timeSeriesDao.getLatestRecord(recordFQN);
    if (jsonRecord == null) {
      return null;
    }
    T entityRecord = JsonUtils.readValue(jsonRecord, entityClass);
    setInheritedFields(entityRecord);
    return entityRecord;
  }

  public T getLatestRecord(String recordFQN, String extension) {
    String jsonRecord = timeSeriesDao.getLatestExtension(recordFQN, extension);
    if (jsonRecord == null) {
      return null;
    }
    T entityRecord = JsonUtils.readValue(jsonRecord, entityClass);
    setInheritedFields(entityRecord);
    return entityRecord;
  }

  public T getById(UUID id) {
    String jsonRecord = timeSeriesDao.getById(id);
    if (jsonRecord == null) {
      return null;
    }
    T entityRecord = JsonUtils.readValue(jsonRecord, entityClass);
    setInheritedFields(entityRecord);
    return entityRecord;
  }

  public void deleteById(UUID id, boolean hardDelete) {
    if (!hardDelete) {
      // time series entities by definition cannot be soft deleted (i.e. they do not have a state,
      // and they should be immutable) thought they can be contained inside entities that can be
      // soft deleted
      return;
    }
    T entityRecord = getById(id);
    if (entityRecord == null) {
      return;
    }
    timeSeriesDao.deleteById(id);
  }

  private Map<String, List<?>> getEntityList(List<String> jsons, boolean skipErrors) {
    List<T> entityList = new ArrayList<>();
    List<EntityError> errors = new ArrayList<>();

    Map<String, List<?>> resultList = new HashMap<>();

    for (String json : jsons) {
      try {
        T recordEntity = JsonUtils.readValue(json, entityClass);
        setInheritedFields(recordEntity);
        entityList.add(recordEntity);
      } catch (Exception e) {
        if (!skipErrors) {
          throw e;
        }
        errors.add(new EntityError().withMessage(e.getMessage()));
      }
    }
    resultList.put("entityList", entityList);
    resultList.put("errors", errors);
    return resultList;
  }

  public RestUtil.PatchResponse<T> patch(UUID id, JsonPatch patch, String user) {
    String originalJson = timeSeriesDao.getById(id);
    if (originalJson == null) {
      throw new EntityNotFoundException(String.format("Entity with id %s not found", id));
    }
    T original = JsonUtils.readValue(originalJson, entityClass);
    T updated = JsonUtils.applyPatch(original, patch, entityClass);

    setUpdatedFields(updated, user);
    validatePatchFields(updated, original);

    timeSeriesDao.update(JsonUtils.pojoToJson(updated), id);
    postUpdate(updated);
    return new RestUtil.PatchResponse<>(Response.Status.OK, updated, ENTITY_UPDATED);
  }

  // Search Repository Methods
  // -------------------------
  public ResultList<T> listFromSearchWithOffset(
      EntityUtil.Fields fields,
      SearchListFilter searchListFilter,
      int limit,
      int offset,
      SearchSortFilter searchSortFilter,
      String q,
      String queryString)
      throws IOException {
    List<T> entityList = new ArrayList<>();
    long total;

    setIncludeSearchFields(searchListFilter);
    setExcludeSearchFields(searchListFilter);
    if (limit > 0) {
      SearchResultListMapper results =
          searchRepository.listWithOffset(
              searchListFilter, limit, offset, entityType, searchSortFilter, q, queryString);
      total = results.getTotal();
      for (Map<String, Object> json : results.getResults()) {
        T entity = setFieldsInternal(JsonUtils.readOrConvertValue(json, entityClass), fields);
        setInheritedFields(entity);
        clearFieldsInternal(entity, fields);
        entityList.add(entity);
      }
      return new ResultList<>(entityList, offset, limit, (int) total);
    } else {
      SearchResultListMapper results =
          searchRepository.listWithOffset(
              searchListFilter, limit, offset, entityType, searchSortFilter, q, queryString);
      total = results.getTotal();
      return new ResultList<>(entityList, null, limit, (int) total);
    }
  }

  @SuppressWarnings("unchecked")
  public ResultList<T> listLatestFromSearch(
      EntityUtil.Fields fields, SearchListFilter searchListFilter, String groupBy, String q)
      throws IOException {
    List<T> entityList = new ArrayList<>();
    setIncludeSearchFields(searchListFilter);
    setExcludeSearchFields(searchListFilter);
    String aggregationPath = "$.sterms#byTerms.buckets";
    String aggregationStr =
        "bucketName=byTerms:aggType=terms:field=%s&size=100,"
            + "bucketName=latest:aggType=top_hits:size=1&sort_field=timestamp&sort_order=desc";
    aggregationStr = String.format(aggregationStr, groupBy);
    SearchAggregation searchAggregation = SearchIndexUtils.buildAggregationTree(aggregationStr);
    JsonObject jsonObjResults =
        searchRepository.aggregate(q, entityType, searchAggregation, searchListFilter);

    Optional<List> jsonObjects =
        JsonUtils.readJsonAtPath(jsonObjResults.toString(), aggregationPath, List.class);
    jsonObjects.ifPresent(
        jsonObjectList -> {
          for (Map<String, Object> json : (List<Map<String, Object>>) jsonObjectList) {
            String bucketAggregationPath = "top_hits#latest.hits.hits";
            Optional<List> hits =
                JsonUtils.readJsonAtPath(
                    JsonUtils.pojoToJson(json), bucketAggregationPath, List.class);
            hits.ifPresent(
                hitList -> {
                  for (Map<String, Object> hit : (List<Map<String, Object>>) hitList) {
                    Map<String, Object> source = extractAndFilterSource(hit);
                    T entity =
                        setFieldsInternal(
                            JsonUtils.readOrConvertValue(source, entityClass), fields);
                    if (entity != null) {
                      setInheritedFields(entity);
                      clearFieldsInternal(entity, fields);
                      entityList.add(entity);
                    }
                  }
                });
          }
        });
    return new ResultList<>(entityList, null, null, entityList.size());
  }

  public T latestFromSearch(EntityUtil.Fields fields, SearchListFilter searchListFilter, String q)
      throws IOException {
    setIncludeSearchFields(searchListFilter);
    setExcludeSearchFields(searchListFilter);
    SearchSortFilter searchSortFilter = new SearchSortFilter("timestamp", "desc", null, null);
    SearchResultListMapper results =
        searchRepository.listWithOffset(searchListFilter, 1, 0, entityType, searchSortFilter, q);
    for (Map<String, Object> json : results.getResults()) {
      T entity = setFieldsInternal(JsonUtils.readOrConvertValue(json, entityClass), fields);
      setInheritedFields(entity);
      clearFieldsInternal(entity, fields);
      return entity;
    }
    return null;
  }

  protected void setIncludeSearchFields(SearchListFilter searchListFilter) {
    // Nothing to do in the default implementation
  }

  protected void setExcludeSearchFields(SearchListFilter searchListFilter) {
    // Nothing to do in the default implementation
  }

  protected List<String> getIncludeSearchFields() {
    return new ArrayList<>();
  }

  protected List<String> getExcludeSearchFields() {
    return new ArrayList<>();
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> extractAndFilterSource(Map<String, Object> hit) {
    List<String> includeSearchFields = getIncludeSearchFields();
    List<String> excludeSearchFields = getExcludeSearchFields();

    Map<String, Object> source = (Map<String, Object>) hit.get("_source");
    if (source == null) {
      return new HashMap<>();
    }

    if (CommonUtil.nullOrEmpty(includeSearchFields)
        && CommonUtil.nullOrEmpty(excludeSearchFields)) {
      return source;
    }

    Map<String, Object> filteredSource = new HashMap<>();
    for (Map.Entry<String, Object> entry : source.entrySet()) {
      String fieldName = entry.getKey();
      if (shouldIncludeField(fieldName, includeSearchFields, excludeSearchFields)) {
        filteredSource.put(fieldName, entry.getValue());
      }
    }

    return filteredSource;
  }

  private boolean shouldIncludeField(
      String fieldName, List<String> includeFields, List<String> excludeFields) {
    if (!CommonUtil.nullOrEmpty(includeFields)) {
      return includeFields.contains(fieldName);
    }
    if (!CommonUtil.nullOrEmpty(excludeFields)) {
      return !excludeFields.contains(fieldName);
    }
    return true;
  }
}
