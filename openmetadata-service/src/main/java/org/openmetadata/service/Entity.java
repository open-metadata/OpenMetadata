/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service;

import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import java.net.URI;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import javax.ws.rs.core.UriInfo;
import lombok.Getter;
import lombok.NonNull;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.FeedRepository;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.util.EntityUtil.Fields;

@Slf4j
public final class Entity {
  // Fully qualified name separator
  public static final String SEPARATOR = ".";

  // Canonical entity name to corresponding EntityRepository map
  private static final Map<String, EntityRepository<? extends EntityInterface>> ENTITY_REPOSITORY_MAP = new HashMap<>();

  @Getter @Setter private static FeedRepository feedRepository;

  // List of all the entities
  private static final List<String> ENTITY_LIST = new ArrayList<>();

  // Common field names
  public static final String FIELD_OWNER = "owner";
  public static final String FIELD_NAME = "name";
  public static final String FIELD_DESCRIPTION = "description";
  public static final String FIELD_FOLLOWERS = "followers";
  public static final String FIELD_VOTES = "votes";
  public static final String FIELD_TAGS = "tags";
  public static final String FIELD_DELETED = "deleted";
  public static final String FIELD_PIPELINE_STATUS = "pipelineStatus";
  public static final String FIELD_DISPLAY_NAME = "displayName";
  public static final String FIELD_EXTENSION = "extension";
  public static final String FIELD_USAGE_SUMMARY = "usageSummary";
  public static final String FIELD_REVIEWERS = "reviewers";
  public static final String FIELD_DOMAIN = "domain";
  public static final String FIELD_DATA_PRODUCTS = "dataProducts";

  //
  // Service entities
  //
  public static final String DATABASE_SERVICE = "databaseService";
  public static final String MESSAGING_SERVICE = "messagingService";
  public static final String DASHBOARD_SERVICE = "dashboardService";
  public static final String PIPELINE_SERVICE = "pipelineService";
  public static final String STORAGE_SERVICE = "storageService";
  public static final String MLMODEL_SERVICE = "mlmodelService";
  public static final String METADATA_SERVICE = "metadataService";
  public static final String SEARCH_SERVICE = "searchService";
  //
  // Data asset entities
  //
  public static final String TABLE = "table";
  public static final String DATABASE = "database";
  public static final String DATABASE_SCHEMA = "databaseSchema";
  public static final String METRICS = "metrics";
  public static final String DASHBOARD = "dashboard";
  public static final String DASHBOARD_DATA_MODEL = "dashboardDataModel";
  public static final String PIPELINE = "pipeline";
  public static final String CHART = "chart";
  public static final String REPORT = "report";
  public static final String TOPIC = "topic";
  public static final String SEARCH_INDEX = "searchIndex";
  public static final String MLMODEL = "mlmodel";
  public static final String CONTAINER = "container";
  public static final String QUERY = "query";

  public static final String GLOSSARY = "glossary";
  public static final String GLOSSARY_TERM = "glossaryTerm";
  public static final String TAG = "tag";
  public static final String CLASSIFICATION = "classification";
  public static final String TYPE = "type";
  public static final String TEST_DEFINITION = "testDefinition";
  public static final String TEST_CONNECTION_DEFINITION = "testConnectionDefinition";
  public static final String TEST_SUITE = "testSuite";
  public static final String KPI = "kpi";
  public static final String TEST_CASE = "testCase";
  public static final String WEB_ANALYTIC_EVENT = "webAnalyticEvent";
  public static final String DATA_INSIGHT_CHART = "dataInsightChart";

  //
  // Policy entity
  //
  public static final String POLICY = "policy";
  public static final String POLICIES = "policies";

  //
  // Role, team and user entities
  //
  public static final String ROLE = "role";
  public static final String USER = "user";
  public static final String TEAM = "team";
  public static final String BOT = "bot";

  //
  // Operation related entities
  //
  public static final String INGESTION_PIPELINE = "ingestionPipeline";

  //
  // Domain related entities
  //
  public static final String DOMAIN = "domain";
  public static final String DATA_PRODUCT = "dataProduct";

  //
  // Other entities
  public static final String EVENT_SUBSCRIPTION = "eventsubscription";
  public static final String THREAD = "THREAD";
  public static final String WORKFLOW = "workflow";

  //
  // Reserved names in OpenMetadata
  //
  public static final String ADMIN_USER_NAME = "admin";
  public static final String ORGANIZATION_NAME = "Organization";
  public static final String ORGANIZATION_POLICY_NAME = "OrganizationPolicy";
  public static final String INGESTION_BOT_NAME = "ingestion-bot";
  public static final String INGESTION_BOT_ROLE = "IngestionBotRole";
  public static final String PROFILER_BOT_NAME = "profiler-bot";
  public static final String PROFILER_BOT_ROLE = "ProfilerBotRole";
  public static final String QUALITY_BOT_NAME = "quality-bot";
  public static final String QUALITY_BOT_ROLE = "QualityBotRole";
  public static final String ALL_RESOURCES = "All";

  // ServiceType - Service Entity name map
  static final Map<ServiceType, String> SERVICE_TYPE_ENTITY_MAP = new EnumMap<>(ServiceType.class);

  static {
    SERVICE_TYPE_ENTITY_MAP.put(ServiceType.DATABASE, DATABASE_SERVICE);
    SERVICE_TYPE_ENTITY_MAP.put(ServiceType.MESSAGING, MESSAGING_SERVICE);
    SERVICE_TYPE_ENTITY_MAP.put(ServiceType.DASHBOARD, DASHBOARD_SERVICE);
    SERVICE_TYPE_ENTITY_MAP.put(ServiceType.PIPELINE, PIPELINE_SERVICE);
    SERVICE_TYPE_ENTITY_MAP.put(ServiceType.ML_MODEL, MLMODEL_SERVICE);
    SERVICE_TYPE_ENTITY_MAP.put(ServiceType.METADATA, METADATA_SERVICE);
    SERVICE_TYPE_ENTITY_MAP.put(ServiceType.STORAGE, STORAGE_SERVICE);
  }

  //
  // List of entities whose changes should not be published to the Activity Feed
  //
  public static final List<String> ACTIVITY_FEED_EXCLUDED_ENTITIES =
      List.of(
          USER,
          TEAM,
          ROLE,
          POLICY,
          BOT,
          INGESTION_PIPELINE,
          DATABASE_SERVICE,
          PIPELINE_SERVICE,
          DASHBOARD_SERVICE,
          MESSAGING_SERVICE,
          WORKFLOW,
          TEST_SUITE);

  private Entity() {}

  public static <T extends EntityInterface> void registerEntity(
      Class<T> clazz,
      String entity,
      EntityRepository<T> entityRepository,
      List<MetadataOperation> entitySpecificOperations) {
    ENTITY_REPOSITORY_MAP.put(entity, entityRepository);
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put(entity.toLowerCase(Locale.ROOT), entity);
    EntityInterface.ENTITY_TYPE_TO_CLASS_MAP.put(entity.toLowerCase(Locale.ROOT), clazz);
    ENTITY_LIST.add(entity);
    Collections.sort(ENTITY_LIST);

    // Set up entity operations for permissions
    ResourceRegistry.addResource(entity, entitySpecificOperations, getEntityFields(clazz));
    LOG.info("Registering entity {} {}", clazz, entity);
  }

  public static List<String> getEntityList() {
    return Collections.unmodifiableList(ENTITY_LIST);
  }

  public static EntityReference getEntityReference(EntityReference ref, Include include) {
    if (ref == null) {
      return null;
    }
    return ref.getId() != null
        ? getEntityReferenceById(ref.getType(), ref.getId(), include)
        : getEntityReferenceByName(ref.getType(), ref.getFullyQualifiedName(), include);
  }

  public static EntityReference getEntityReferenceById(@NonNull String entityType, @NonNull UUID id, Include include) {
    EntityRepository<? extends EntityInterface> repository = getEntityRepository(entityType);
    include = repository.supportsSoftDelete ? Include.ALL : include;
    return repository.getReference(id, include);
  }

  public static EntityReference getEntityReferenceByName(@NonNull String entityType, String fqn, Include include) {
    if (fqn == null) {
      return null;
    }
    EntityRepository<? extends EntityInterface> repository = getEntityRepository(entityType);
    return repository.getReferenceByName(fqn, include);
  }

  public static EntityReference getOwner(@NonNull EntityReference reference) {
    EntityRepository<?> repository = getEntityRepository(reference.getType());
    return repository.getOwner(reference);
  }

  public static void withHref(UriInfo uriInfo, List<EntityReference> list) {
    listOrEmpty(list).forEach(ref -> withHref(uriInfo, ref));
  }

  public static void withHref(UriInfo uriInfo, EntityReference ref) {
    if (ref == null) {
      return;
    }
    String entityType = ref.getType();
    EntityRepository<?> entityRepository = getEntityRepository(entityType);
    URI href = entityRepository.getHref(uriInfo, ref.getId());
    ref.withHref(href);
  }

  /** Returns true if the change events of the given entity type should be published to the activity feed. */
  public static boolean shouldDisplayEntityChangeOnFeed(@NonNull String entityType) {
    return !ACTIVITY_FEED_EXCLUDED_ENTITIES.contains(entityType);
  }

  public static Fields getFields(String entityType, List<String> fields) {
    EntityRepository<?> entityRepository = Entity.getEntityRepository(entityType);
    return entityRepository.getFields(String.join(",", fields));
  }

  public static <T> T getEntity(EntityReference ref, String fields, Include include) {
    return ref.getId() != null
        ? getEntity(ref.getType(), ref.getId(), fields, include)
        : getEntityByName(ref.getType(), ref.getFullyQualifiedName(), fields, include);
  }

  public static <T> T getEntity(EntityLink link, String fields, Include include) {
    return getEntityByName(link.getEntityType(), link.getEntityFQN(), fields, include);
  }

  /** Retrieve the entity using id from given entity reference and fields */
  public static <T> T getEntity(String entityType, UUID id, String fields, Include include) {
    EntityRepository<?> entityRepository = Entity.getEntityRepository(entityType);
    @SuppressWarnings("unchecked")
    T entity = (T) entityRepository.get(null, id, entityRepository.getFields(fields), include, true);
    return entity;
  }

  // TODO remove throwing IOException
  /** Retrieve the entity using id from given entity reference and fields */
  public static <T> T getEntityByName(String entityType, String fqn, String fields, Include include) {
    EntityRepository<?> entityRepository = Entity.getEntityRepository(entityType);
    @SuppressWarnings("unchecked")
    T entity = (T) entityRepository.getByName(null, fqn, entityRepository.getFields(fields), include, true);
    return entity;
  }

  /** Retrieve the corresponding entity repository for a given entity name. */
  public static EntityRepository<? extends EntityInterface> getEntityRepository(@NonNull String entityType) {
    EntityRepository<? extends EntityInterface> entityRepository = ENTITY_REPOSITORY_MAP.get(entityType);
    if (entityRepository == null) {
      throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityTypeNotFound(entityType));
    }
    return entityRepository;
  }

  /** Retrieve the corresponding entity repository for a given entity name. */
  public static EntityRepository<? extends EntityInterface> getServiceEntityRepository(
      @NonNull ServiceType serviceType) {
    EntityRepository<? extends EntityInterface> entityRepository =
        ENTITY_REPOSITORY_MAP.get(SERVICE_TYPE_ENTITY_MAP.get(serviceType));
    if (entityRepository == null) {
      throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityTypeNotFound(serviceType.value()));
    }
    return entityRepository;
  }

  public static List<TagLabel> getEntityTags(String entityType, EntityInterface entity) {
    EntityRepository<? extends EntityInterface> entityRepository = getEntityRepository(entityType);
    return listOrEmpty(entityRepository.getAllTags(entity));
  }

  public static void deleteEntity(
      String updatedBy, String entityType, UUID entityId, boolean recursive, boolean hardDelete) {
    EntityRepository<?> dao = getEntityRepository(entityType);
    dao.delete(updatedBy, entityId, recursive, hardDelete);
  }

  public static void restoreEntity(String updatedBy, String entityType, UUID entityId) {
    EntityRepository<?> dao = getEntityRepository(entityType);
    dao.restoreEntity(updatedBy, entityType, entityId);
  }

  public static <T> String getEntityTypeFromClass(Class<T> clz) {
    return EntityInterface.CANONICAL_ENTITY_NAME_MAP.get(clz.getSimpleName().toLowerCase(Locale.ROOT));
  }

  public static String getEntityTypeFromObject(Object object) {
    return EntityInterface.CANONICAL_ENTITY_NAME_MAP.get(object.getClass().getSimpleName().toLowerCase(Locale.ROOT));
  }

  public static Class<? extends EntityInterface> getEntityClassFromType(String entityType) {
    return EntityInterface.ENTITY_TYPE_TO_CLASS_MAP.get(entityType.toLowerCase(Locale.ROOT));
  }

  /**
   * Get list of all the entity field names from JsonPropertyOrder annotation from generated java class from entity.json
   */
  public static <T> Set<String> getEntityFields(Class<T> clz) {
    JsonPropertyOrder propertyOrder = clz.getAnnotation(JsonPropertyOrder.class);
    return new HashSet<>(Arrays.asList(propertyOrder.value()));
  }

  /** Returns true if the entity supports activity feeds, announcement, and tasks */
  public static boolean supportsFeed(String entityType) {
    return listOf(
            TABLE,
            DATABASE,
            DATABASE_SCHEMA,
            METRICS,
            DASHBOARD,
            DASHBOARD_DATA_MODEL,
            PIPELINE,
            CHART,
            REPORT,
            TOPIC,
            MLMODEL,
            CONTAINER,
            QUERY,
            GLOSSARY,
            GLOSSARY_TERM,
            TAG,
            CLASSIFICATION)
        .contains(entityType);
  }

  /** Class for getting validated entity list from a queryParam with list of entities. */
  public static class EntityList {
    private EntityList() {}

    public static List<String> getEntityList(String name, String entitiesParam) {
      if (entitiesParam == null) {
        return Collections.emptyList();
      }
      entitiesParam = entitiesParam.replace(" ", "");
      if (entitiesParam.equals("*")) {
        return List.of("*");
      }
      List<String> list = Arrays.asList(entitiesParam.split(","));
      validateEntities(name, list);
      return list;
    }

    private static void validateEntities(String name, List<String> list) {
      for (String entity : list) {
        if (ENTITY_REPOSITORY_MAP.get(entity) == null) {
          throw new IllegalArgumentException(String.format("Invalid entity %s in query param %s", entity, name));
        }
      }
    }
  }
}
