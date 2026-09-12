package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.EventType.ENTITY_FIELDS_CHANGED;
import static org.openmetadata.schema.type.EventType.ENTITY_UPDATED;
import static org.openmetadata.service.Entity.FIELD_DOMAINS;
import static org.openmetadata.service.Entity.USER;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.EntityModuleFactory;
import org.openmetadata.service.entity.metadata.EntityRelationshipUpdates;
import org.openmetadata.service.entity.metadata.EntityRelationshipWriter;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.read.EntityCollectionReader;
import org.openmetadata.service.entity.read.EntityRelationshipReader;
import org.openmetadata.service.entity.write.EntityCommandActor;
import org.openmetadata.service.entity.write.EntityOperation;
import org.openmetadata.service.entity.write.EntityPutService;
import org.openmetadata.service.entity.write.EntitySpecificMutation;
import org.openmetadata.service.entity.write.EntityUpdateRequest;
import org.openmetadata.service.entity.write.EntityUpdater;
import org.openmetadata.service.resources.query.QueryResource;
import org.openmetadata.service.search.vector.QueryBodyTextContributor;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil;

@Slf4j
@Repository()
public class QueryRepository implements EntityPolicy<Query> {

  private static final String QUERY_USED_IN_FIELD = "queryUsedIn";

  private static final String QUERY_USERS_FIELD = "users";

  private static final String QUERY_PATCH_FIELDS = "users,query,queryUsedIn,processedLineage";

  private static final String QUERY_UPDATE_FIELDS = "users,queryUsedIn,processedLineage";

  static final int DOMAIN_REINDEX_BATCH_SIZE = 100;

  private static final String INITIAL_QUERY_ID_CURSOR = "";

  private static final Set<String> QUERY_ANCESTOR_DOMAIN_SOURCE_TYPES =
      Set.of(Entity.DATABASE_SERVICE, Entity.DATABASE, Entity.DATABASE_SCHEMA);

  public QueryRepository() {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                QueryResource.COLLECTION_PATH,
                Entity.QUERY,
                Query.class,
                Entity.getCollectionDAO().queryDAO()),
            new EntityPolicyContext.WriteFields(QUERY_PATCH_FIELDS, QUERY_UPDATE_FIELDS, Set.of()),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, true);
    context().options().setSupportsSearch(true);
    QueryBodyTextContributor.INSTANCE.register();
  }

  @Override
  public void setFullyQualifiedName(Query query) {
    query.setFullyQualifiedName(
        FullyQualifiedName.add(query.getService().getFullyQualifiedName(), query.getName()));
  }

  @Override
  public void entitySpecificCleanup(Query entityInterface) {
    context()
        .dependencies()
        .daos()
        .queryCostRecordTimeSeriesDAO()
        .deleteWithEntityFqnHash(entityInterface.getFullyQualifiedName());
  }

  @Override
  public void setFields(Query entity, EntityUtil.Fields fields, RelationIncludes relationIncludes) {
    entity.setQueryUsedIn(getQueryUsageForFields(entity, fields));
    entity.withUsers(fields.contains("users") ? getQueryUsers(entity) : entity.getUsers());
  }

  @Override
  public void setInheritedFields(Query query, EntityUtil.Fields fields) {
    setInheritedFields(List.of(query), fields);
  }

  @Override
  public void setInheritedFields(List<Query> queries, EntityUtil.Fields fields) {
    if (fields.contains(FIELD_DOMAINS) && !nullOrEmpty(queries)) {
      final Map<UUID, Table> tablesById = loadTablesWithDomains(queries);
      queries.forEach(query -> query.setDomains(QueryDomainInheritance.resolve(query, tablesById)));
    }
  }

  @Override
  public void clearFields(Query entity, EntityUtil.Fields fields) {
    entity.withQueryUsedIn(fields.contains(QUERY_USED_IN_FIELD) ? entity.getQueryUsedIn() : null);
    entity.withUsers(fields.contains("users") ? this.getQueryUsers(entity) : null);
  }

  @Override
  public void setFieldsInBulk(EntityUtil.Fields fields, List<Query> entities) {
    if (entities == null || entities.isEmpty()) {
      return;
    }
    // Bulk fetch and set services for all queries first
    fetchAndSetServices(entities);
    // Bulk fetch and set query-specific fields
    fetchAndSetQueryUsage(entities, fields);
    fetchAndSetQueryUsers(entities, fields);
    // Then call parent's implementation which handles standard fields
    EntityPolicy.super.setFieldsInBulk(fields, entities);
  }

  private void fetchAndSetServices(List<Query> queries) {
    if (queries == null || queries.isEmpty()) {
      return;
    }
    // Many queries already have service set from when they were created
    // For those that don't, we need to fetch it
    var queriesNeedingService = queries.stream().filter(q -> q.getService() == null).toList();
    if (!queriesNeedingService.isEmpty()) {
      // For queries, service information is stored differently
      // Query doesn't have a direct CONTAINS relationship with service
      // Instead, it has the service reference stored in its JSON
      queriesNeedingService.forEach(
          query -> {
            try {
              // The service should already be set in setFields for individual entities
              // This is a fallback for bulk operations
              var service =
                  Entity.getEntityReferenceByName(
                      Entity.DATABASE_SERVICE, query.getService().getName(), Include.NON_DELETED);
              query.withService(service);
            } catch (Exception e) {
              LOG.warn("Could not fetch service for query: {}", query.getId(), e);
            }
          });
    }
  }

  private void fetchAndSetQueryUsage(List<Query> queries, EntityUtil.Fields fields) {
    if (!needsQueryUsage(fields) || queries == null || queries.isEmpty()) {
      return;
    }
    final boolean queryUsageRequested = fields.contains(QUERY_USED_IN_FIELD);
    final List<String> queryIds = queries.stream().map(q -> q.getId().toString()).toList();
    final List<CollectionDAO.EntityRelationshipObject> relationships =
        queryUsageRequested
            ? context()
                .dependencies()
                .daos()
                .relationshipDAO()
                .findFromBatch(queryIds, Entity.QUERY, Relationship.MENTIONED_IN.ordinal())
            : findActiveTableUsageRelationships(queryIds);
    final Map<String, Map<UUID, EntityReference>> referencesByType =
        queryUsageRequested ? loadQueryUsageReferences(relationships) : Map.of();
    Map<UUID, List<EntityReference>> queryUsageMap = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject record : relationships) {
      final String usageType = record.getFromEntity();
      if (!queryUsageRequested && !Entity.TABLE.equals(usageType)) {
        continue;
      }
      final UUID usageId = UUID.fromString(record.getFromId());
      final EntityReference entityRef =
          queryUsageRequested
              ? referencesByType.getOrDefault(usageType, Map.of()).get(usageId)
              : new EntityReference().withId(usageId).withType(Entity.TABLE);
      if (entityRef != null) {
        final UUID queryId = UUID.fromString(record.getToId());
        queryUsageMap.computeIfAbsent(queryId, ignored -> new ArrayList<>()).add(entityRef);
      }
    }
    queries.forEach(
        query -> {
          List<EntityReference> usage = queryUsageMap.getOrDefault(query.getId(), List.of());
          query.setQueryUsedIn(usage);
        });
  }

  private Map<String, Map<UUID, EntityReference>> loadQueryUsageReferences(
      List<CollectionDAO.EntityRelationshipObject> relationships) {
    final Map<String, Set<UUID>> idsByType = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject record : relationships) {
      idsByType
          .computeIfAbsent(record.getFromEntity(), ignored -> new HashSet<>())
          .add(UUID.fromString(record.getFromId()));
    }
    final Map<String, Map<UUID, EntityReference>> referencesByType = new HashMap<>();
    idsByType.forEach(
        (type, ids) -> {
          final List<EntityReference> references =
              Entity.getEntityReferencesByIds(type, new ArrayList<>(ids), Include.ALL);
          referencesByType.put(
              type,
              references.stream()
                  .collect(Collectors.toMap(EntityReference::getId, Function.identity())));
        });
    return referencesByType;
  }

  private boolean needsQueryUsage(EntityUtil.Fields fields) {
    return fields.contains(QUERY_USED_IN_FIELD) || fields.contains(FIELD_DOMAINS);
  }

  private List<EntityReference> getQueryUsageForFields(Query query, EntityUtil.Fields fields) {
    if (fields.contains(QUERY_USED_IN_FIELD)) {
      return getQueryUsage(query);
    }
    if (fields.contains(FIELD_DOMAINS)) {
      return findActiveTableUsageRelationships(List.of(query.getId().toString())).stream()
          .map(
              record ->
                  new EntityReference()
                      .withId(UUID.fromString(record.getFromId()))
                      .withType(record.getFromEntity()))
          .toList();
    }
    return query.getQueryUsedIn();
  }

  private List<CollectionDAO.EntityRelationshipObject> findActiveTableUsageRelationships(
      List<String> queryIds) {
    return context()
        .dependencies()
        .daos()
        .relationshipDAO()
        .findFromBatch(queryIds, Relationship.MENTIONED_IN.ordinal(), Entity.TABLE, Entity.QUERY);
  }

  private Map<UUID, Table> loadTablesWithDomains(List<Query> queries) {
    final Set<UUID> tableIds = getUsedTableIds(queries);
    Map<UUID, Table> result = Map.of();
    if (!tableIds.isEmpty()) {
      final TableRepository repository = (TableRepository) Entity.getEntityRepository(Entity.TABLE);
      final List<Table> tables =
          repository
              .collections()
              .byIds(
                  new ArrayList<>(tableIds),
                  new EntityCollectionReader.Projection(
                      null, repository.fieldPolicy().parse(FIELD_DOMAINS), Include.NON_DELETED));
      result = tables.stream().collect(Collectors.toMap(Table::getId, Function.identity()));
    }
    return result;
  }

  private Set<UUID> getUsedTableIds(List<Query> queries) {
    return queries.stream()
        .filter(query -> !QueryDomainInheritance.hasExplicitDomains(query))
        .flatMap(query -> listOrEmpty(query.getQueryUsedIn()).stream())
        .filter(reference -> Entity.TABLE.equals(reference.getType()))
        .map(EntityReference::getId)
        .filter(Objects::nonNull)
        .collect(Collectors.toSet());
  }

  private void fetchAndSetQueryUsers(List<Query> queries, EntityUtil.Fields fields) {
    if (!fields.contains("users") || queries == null || queries.isEmpty()) {
      return;
    }
    List<String> queryIds = queries.stream().map(q -> q.getId().toString()).toList();
    List<CollectionDAO.EntityRelationshipObject> relationships =
        context()
            .dependencies()
            .daos()
            .relationshipDAO()
            .findFromBatch(queryIds, Entity.QUERY, Relationship.USES.ordinal());
    // Group relationships by query ID
    Map<UUID, List<EntityReference>> queryUsersMap = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject record : relationships) {
      UUID queryId = UUID.fromString(record.getToId());
      EntityReference entityRef =
          Entity.getEntityReferenceById(
              record.getFromEntity(), UUID.fromString(record.getFromId()), Include.ALL);
      queryUsersMap.computeIfAbsent(queryId, k -> new ArrayList<>()).add(entityRef);
    }
    queries.forEach(
        query -> {
          List<EntityReference> users = queryUsersMap.getOrDefault(query.getId(), List.of());
          query.withUsers(users);
        });
  }

  public List<EntityReference> getQueryUsage(Query queryEntity) {
    return queryEntity == null
        ? Collections.emptyList()
        : relationships()
            .from(
                new EntityRelationshipReader.Selection(
                    queryEntity.getId(), Entity.QUERY, Relationship.MENTIONED_IN, null),
                Include.NON_DELETED);
  }

  public List<EntityReference> getQueryUsers(Query queryEntity) {
    return queryEntity == null
        ? Collections.emptyList()
        : relationships()
            .from(
                new EntityRelationshipReader.Selection(
                    queryEntity.getId(), Entity.QUERY, Relationship.USES, USER),
                Include.NON_DELETED);
  }

  public void forEachQueryBatchForDomainSource(
      String sourceType,
      UUID sourceId,
      String sourceFqn,
      Consumer<List<EntityReference>> batchConsumer) {
    String afterQueryId = INITIAL_QUERY_ID_CURSOR;
    List<String> queryIds =
        getQueryIdsForDomainSource(sourceType, sourceId, sourceFqn, afterQueryId);
    while (!queryIds.isEmpty()) {
      batchConsumer.accept(toQueryReferences(queryIds));
      afterQueryId = queryIds.getLast();
      queryIds =
          queryIds.size() == DOMAIN_REINDEX_BATCH_SIZE
              ? getQueryIdsForDomainSource(sourceType, sourceId, sourceFqn, afterQueryId)
              : List.of();
    }
  }

  private List<String> getQueryIdsForDomainSource(
      String sourceType, UUID sourceId, String sourceFqn, String afterQueryId) {
    List<String> queryIds = List.of();
    if (Entity.TABLE.equals(sourceType)) {
      queryIds =
          context()
              .dependencies()
              .daos()
              .relationshipDAO()
              .findQueryIdsForTableAfter(
                  sourceId,
                  Relationship.MENTIONED_IN.ordinal(),
                  afterQueryId,
                  DOMAIN_REINDEX_BATCH_SIZE);
    } else if (QUERY_ANCESTOR_DOMAIN_SOURCE_TYPES.contains(sourceType) && !nullOrEmpty(sourceFqn)) {
      queryIds =
          context()
              .dependencies()
              .daos()
              .relationshipDAO()
              .findQueryIdsForTableFqnPrefixAfter(
                  FullyQualifiedName.buildHash(sourceFqn) + ".%",
                  Relationship.MENTIONED_IN.ordinal(),
                  afterQueryId,
                  DOMAIN_REINDEX_BATCH_SIZE);
    }
    return queryIds;
  }

  private List<EntityReference> toQueryReferences(List<String> queryIds) {
    return queryIds.stream()
        .map(UUID::fromString)
        .map(queryId -> new EntityReference().withId(queryId).withType(Entity.QUERY))
        .toList();
  }

  @Override
  @SneakyThrows
  public void prepare(Query entity, boolean update) {
    if (nullOrEmpty(entity.getName())) {
      String checkSum = EntityUtil.hash(entity.getQuery());
      entity.setChecksum(checkSum);
      entity.setName(checkSum);
    }
    entity.setUsers(EntityUtil.populateEntityReferences(entity.getUsers()));
    DatabaseService service = Entity.getEntity(entity.getService(), "", Include.ALL);
    entity.setService(service.getEntityReference());
  }

  @Override
  public List<String> getFieldsStrippedFromStorageJson() {
    return List.of("queryUsedIn", "users");
  }

  @Override
  public void storeEntity(Query queryEntity, boolean update) {
    persistence().store(queryEntity, update);
  }

  @Override
  public void storeEntities(List<Query> entities) {
    persistence().insertMany(entities);
  }

  @Override
  public void clearEntitySpecificRelationshipsForMany(List<Query> entities) {
    if (entities.isEmpty()) return;
    List<UUID> ids = entities.stream().map(Query::getId).toList();
    deleteToMany(ids, Entity.QUERY, Relationship.USES, Entity.USER);
    deleteToMany(ids, context().schema().entityType(), Relationship.CONTAINS, null);
    deleteFromMany(ids, Entity.QUERY, Relationship.MENTIONED_IN, null);
  }

  @Override
  public void storeRelationships(Query queryEntity) {
    // Store Query Users Relation
    if (queryEntity.getUsers() != null) {
      for (EntityReference entityRef : queryEntity.getUsers()) {
        relationshipWrites()
            .add(
                new EntityRelationshipWriter.Edge(
                    entityRef.getId(), queryEntity.getId(), USER, Entity.QUERY, Relationship.USES),
                EntityRelationshipWriter.Value.EMPTY,
                false);
      }
    }
    // Store Query Used in Relation
    storeQueryUsedIn(queryEntity.getId(), queryEntity.getQueryUsedIn(), null);
    // The service contains the query
    addServiceRelationship(queryEntity, queryEntity.getService());
  }

  @Override
  public EntityUpdater<Query> getUpdater(
      Query original, Query updated, EntityOperation operation, ChangeSource changeSource) {
    return new QueryUpdater(original, updated, operation).mutation();
  }

  private void storeQueryUsedIn(
      UUID queryId, List<EntityReference> addQueryUsedIn, List<EntityReference> deleteQueryUsedIn) {
    for (EntityReference entityRef : listOrEmpty(addQueryUsedIn)) {
      relationshipWrites()
          .add(
              new EntityRelationshipWriter.Edge(
                  entityRef.getId(),
                  queryId,
                  entityRef.getType(),
                  Entity.QUERY,
                  Relationship.MENTIONED_IN),
              EntityRelationshipWriter.Value.EMPTY,
              false);
    }
    for (EntityReference entityRef : listOrEmpty(deleteQueryUsedIn)) {
      relationshipWrites()
          .delete(
              new EntityRelationshipWriter.Edge(
                  entityRef.getId(),
                  queryId,
                  entityRef.getType(),
                  Entity.QUERY,
                  Relationship.MENTIONED_IN));
    }
  }

  public RestUtil.PutResponse<?> addQueryUser(
      UriInfo uriInfo, String updatedBy, UUID queryId, List<String> userFqnList) {
    Query query = Entity.getEntity(Entity.QUERY, queryId, QUERY_USERS_FIELD, Include.NON_DELETED);
    List<EntityReference> oldValue = query.getUsers();
    for (String userFqn : userFqnList) {
      User user = Entity.getEntityByName(USER, userFqn, "", Include.NON_DELETED);
      EntityReference entityRef = user.getEntityReference();
      relationshipWrites()
          .add(
              new EntityRelationshipWriter.Edge(
                  entityRef.getId(), queryId, entityRef.getType(), Entity.QUERY, Relationship.USES),
              EntityRelationshipWriter.Value.EMPTY,
              false);
    }
    // Populate Fields
    setFieldsInternal(query, new EntityUtil.Fields(context().allowedFields(), QUERY_USERS_FIELD));
    Entity.withHref(uriInfo, query.getUsers());
    ChangeEvent changeEvent =
        getQueryChangeEvent(
            updatedBy, QUERY_USERS_FIELD, oldValue, query.getUsers(), withHref(uriInfo, query));
    return new RestUtil.PutResponse<>(Response.Status.CREATED, changeEvent, ENTITY_FIELDS_CHANGED);
  }

  public RestUtil.PutResponse<?> addQueryUsedBy(
      UriInfo uriInfo, String updatedBy, UUID queryId, List<String> userList) {
    Query query = Entity.getEntity(Entity.QUERY, queryId, QUERY_UPDATE_FIELDS, Include.NON_DELETED);
    Query oldQuery = JsonUtils.readValue(JsonUtils.pojoToJson(query), Query.class);
    query.getUsedBy().addAll(userList);
    ChangeEvent changeEvent =
        getQueryChangeEvent(
            updatedBy,
            QUERY_USERS_FIELD,
            oldQuery.getUsedBy(),
            query.getUsers(),
            withHref(uriInfo, query));
    puts()
        .update(
            uriInfo,
            oldQuery,
            query,
            new EntityCommandActor(updatedBy, null),
            EntityPutService.Mode.NORMAL);
    return new RestUtil.PutResponse<>(Response.Status.CREATED, changeEvent, ENTITY_FIELDS_CHANGED);
  }

  public RestUtil.PutResponse<?> addQueryUsage(
      UriInfo uriInfo, String updatedBy, UUID queryId, List<EntityReference> entityIds) {
    Query query = Entity.getEntity(Entity.QUERY, queryId, QUERY_USED_IN_FIELD, Include.NON_DELETED);
    List<EntityReference> oldValue = query.getQueryUsedIn();
    // Create Relationships
    entityIds.forEach(
        entityRef ->
            relationshipWrites()
                .add(
                    new EntityRelationshipWriter.Edge(
                        entityRef.getId(),
                        queryId,
                        entityRef.getType(),
                        Entity.QUERY,
                        Relationship.MENTIONED_IN),
                    EntityRelationshipWriter.Value.EMPTY,
                    false));
    // Populate Fields
    populateQueryUsageAndDomains(query);
    Entity.withHref(uriInfo, query.getQueryUsedIn());
    ChangeEvent changeEvent =
        getQueryChangeEvent(
            updatedBy,
            QUERY_USED_IN_FIELD,
            oldValue,
            query.getQueryUsedIn(),
            withHref(uriInfo, query));
    dispatchQueryUsageUpdate(query, changeEvent);
    return new RestUtil.PutResponse<>(Response.Status.CREATED, changeEvent, ENTITY_FIELDS_CHANGED);
  }

  public RestUtil.PutResponse<?> removeQueryUsedIn(
      UriInfo uriInfo, String updatedBy, UUID queryId, List<EntityReference> entityIds) {
    Query query = Entity.getEntity(Entity.QUERY, queryId, QUERY_USED_IN_FIELD, Include.NON_DELETED);
    List<EntityReference> oldValue = query.getQueryUsedIn();
    for (EntityReference ref : entityIds) {
      relationshipWrites()
          .delete(
              new EntityRelationshipWriter.Edge(
                  ref.getId(), queryId, ref.getType(), Entity.QUERY, Relationship.MENTIONED_IN));
    }
    // Populate Fields
    populateQueryUsageAndDomains(query);
    Entity.withHref(uriInfo, query.getQueryUsedIn());
    ChangeEvent changeEvent =
        getQueryChangeEvent(
            updatedBy,
            QUERY_USED_IN_FIELD,
            oldValue,
            query.getQueryUsedIn(),
            withHref(uriInfo, query));
    dispatchQueryUsageUpdate(query, changeEvent);
    return new RestUtil.PutResponse<>(Response.Status.CREATED, changeEvent, ENTITY_FIELDS_CHANGED);
  }

  private void dispatchQueryUsageUpdate(final Query query, final ChangeEvent changeEvent) {
    query.setIncrementalChangeDescription(changeEvent.getChangeDescription());
    query.setChangeDescription(changeEvent.getChangeDescription());
    postUpdate(query, query);
  }

  @Override
  public void postUpdate(Query original, Query updated) {
    populateQueryUsageAndDomains(updated);
    EntityPolicy.super.postUpdate(original, updated);
  }

  private void populateQueryUsageAndDomains(Query query) {
    EntityUtil.Fields fields =
        new EntityUtil.Fields(context().allowedFields(), QUERY_USED_IN_FIELD + "," + FIELD_DOMAINS);
    setFieldsInternal(query, fields);
    setInheritedFields(query, fields);
  }

  private ChangeEvent getQueryChangeEvent(
      String updatedBy, String fieldUpdated, Object oldValue, Object newValue, Query updatedQuery) {
    FieldChange fieldChange =
        new FieldChange().withName(fieldUpdated).withNewValue(newValue).withOldValue(oldValue);
    ChangeDescription change =
        new ChangeDescription().withPreviousVersion(updatedQuery.getVersion());
    change.getFieldsUpdated().add(fieldChange);
    return new ChangeEvent()
        .withId(UUID.randomUUID())
        .withEntity(updatedQuery)
        .withChangeDescription(change)
        .withEventType(ENTITY_UPDATED)
        .withEntityType(context().schema().entityType())
        .withEntityId(updatedQuery.getId())
        .withEntityFullyQualifiedName(updatedQuery.getFullyQualifiedName())
        .withUserName(updatedBy)
        .withTimestamp(System.currentTimeMillis())
        .withCurrentVersion(updatedQuery.getVersion())
        .withPreviousVersion(updatedQuery.getVersion());
  }

  public class QueryUpdater implements EntitySpecificMutation<Query> {

    public QueryUpdater(Query original, Query updated, EntityOperation operation) {
      this.entityUpdate =
          new EntityUpdater<>(
              context().services().getUpdaterServices(),
              new EntityUpdateRequest<>(original, updated, operation, null, false),
              this);
    }

    @Transaction
    @Override
    public void update(EntityUpdater<Query> entityUpdate, boolean consolidatingChanges) {
      entityUpdate.compareAndUpdate(
          "users",
          () ->
              entityUpdate.updateFromRelationships(
                  new EntityRelationshipUpdates.Target(
                      "users",
                      entityUpdate.getOriginal().getId(),
                      Entity.QUERY,
                      USER,
                      Relationship.USES),
                  new EntityRelationshipUpdates.References(
                      entityUpdate.getOriginal().getUsers(),
                      entityUpdate.getUpdated().getUsers() == null
                          ? new ArrayList<>()
                          : entityUpdate.getUpdated().getUsers())));
      entityUpdate.compareAndUpdate(
          "queryUsedIn",
          () -> {
            List<EntityReference> added = new ArrayList<>();
            List<EntityReference> deleted = new ArrayList<>();
            entityUpdate.recordListChange(
                "queryUsedIn",
                entityUpdate.getOriginal().getQueryUsedIn(),
                entityUpdate.getUpdated().getQueryUsedIn(),
                added,
                deleted,
                EntityUtil.entityReferenceMatch);
            storeQueryUsedIn(entityUpdate.getUpdated().getId(), added, deleted);
          });
      entityUpdate.compareAndUpdate(
          "processedLineage",
          () ->
              entityUpdate.recordChange(
                  "processedLineage",
                  entityUpdate.getOriginal().getProcessedLineage(),
                  entityUpdate.getUpdated().getProcessedLineage()));
      entityUpdate.compareAndUpdate(
          "usedBy",
          () ->
              entityUpdate.recordChange(
                  "usedBy",
                  entityUpdate.getOriginal().getUsedBy(),
                  entityUpdate.getUpdated().getUsedBy(),
                  true));
      entityUpdate.compareAndUpdate(
          "query",
          () -> {
            // Query is a required field. Cannot be removed.
            if (entityUpdate.getUpdated().getQuery() != null) {
              String originalChecksum = EntityUtil.hash(entityUpdate.getOriginal().getQuery());
              String updatedChecksum = EntityUtil.hash(entityUpdate.getUpdated().getQuery());
              if (!originalChecksum.equals(updatedChecksum)) {
                entityUpdate.getUpdated().setChecksum(updatedChecksum);
                entityUpdate.recordChange(
                    "query",
                    entityUpdate.getOriginal().getQuery(),
                    entityUpdate.getUpdated().getQuery());
                entityUpdate.recordChange(
                    "checksum",
                    entityUpdate.getOriginal().getChecksum(),
                    entityUpdate.getUpdated().getChecksum());
              }
            }
          });
    }

    private final EntityUpdater<Query> entityUpdate;

    public EntityUpdater<Query> mutation() {
      return entityUpdate;
    }
  }

  private final EntityPolicyContext<Query> entityContext;

  @Override
  public final EntityPolicyContext<Query> context() {
    return entityContext;
  }
}
