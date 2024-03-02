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
import static org.openmetadata.service.resources.tags.TagLabelUtil.addDerivedTags;
import static org.openmetadata.service.util.EntityUtil.getFlattenedEntityField;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import io.github.classgraph.ClassGraph;
import io.github.classgraph.ClassInfoList;
import io.github.classgraph.ScanResult;
import java.lang.reflect.Modifier;
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
import java.util.TreeSet;
import java.util.UUID;
import javax.ws.rs.BadRequestException;
import javax.ws.rs.core.UriInfo;
import lombok.Getter;
import lombok.NonNull;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.EntityTimeSeriesInterface;
import org.openmetadata.schema.FieldInterface;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.ChangeEventRepository;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.EntityTimeSeriesRepository;
import org.openmetadata.service.jdbi3.FeedRepository;
import org.openmetadata.service.jdbi3.LineageRepository;
import org.openmetadata.service.jdbi3.PolicyRepository;
import org.openmetadata.service.jdbi3.Repository;
import org.openmetadata.service.jdbi3.RoleRepository;
import org.openmetadata.service.jdbi3.SuggestionRepository;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.jdbi3.TokenRepository;
import org.openmetadata.service.jdbi3.UsageRepository;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.indexes.SearchIndex;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public final class Entity {
  private static volatile boolean initializedRepositories = false;
  @Getter @Setter private static CollectionDAO collectionDAO;
  public static final String SEPARATOR = "."; // Fully qualified name separator

  // Canonical entity name to corresponding EntityRepository map
  private static final Map<String, EntityRepository<? extends EntityInterface>>
      ENTITY_REPOSITORY_MAP = new HashMap<>();
  private static final Map<String, EntityTimeSeriesRepository<? extends EntityTimeSeriesInterface>>
      ENTITY_TS_REPOSITORY_MAP = new HashMap<>();

  @Getter @Setter private static TokenRepository tokenRepository;
  @Getter @Setter private static PolicyRepository policyRepository;
  @Getter @Setter private static RoleRepository roleRepository;
  @Getter @Setter private static FeedRepository feedRepository;
  @Getter @Setter private static LineageRepository lineageRepository;
  @Getter @Setter private static UsageRepository usageRepository;
  @Getter @Setter private static SystemRepository systemRepository;
  @Getter @Setter private static ChangeEventRepository changeEventRepository;
  @Getter @Setter private static SearchRepository searchRepository;
  @Getter @Setter private static SuggestionRepository suggestionRepository;
  // List of all the entities
  private static final Set<String> ENTITY_LIST = new TreeSet<>();

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
  public static final String FIELD_CHILDREN = "children";
  public static final String FIELD_PARENT = "parent";
  public static final String FIELD_REVIEWERS = "reviewers";
  public static final String FIELD_EXPERTS = "experts";
  public static final String FIELD_DOMAIN = "domain";
  public static final String FIELD_DATA_PRODUCTS = "dataProducts";
  public static final String FIELD_ASSETS = "assets";

  public static final String FIELD_STYLE = "style";

  public static final String FIELD_LIFE_CYCLE = "lifeCycle";

  public static final String FIELD_DISABLED = "disabled";

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
  public static final String STORED_PROCEDURE = "storedProcedure";
  public static final String DATABASE = "database";
  public static final String DATABASE_SCHEMA = "databaseSchema";
  public static final String METRICS = "metrics";
  public static final String DASHBOARD = "dashboard";
  public static final String DASHBOARD_DATA_MODEL = "dashboardDataModel";
  public static final String PIPELINE = "pipeline";
  public static final String TASK = "task";
  public static final String CHART = "chart";
  public static final String APPLICATION = "app";
  public static final String APP_MARKET_PLACE_DEF = "appMarketPlaceDefinition";
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
  public static final String PERSONA = "persona";
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
  public static final String SUGGESTION = "SUGGESTION";
  public static final String WORKFLOW = "workflow";

  //
  // Time series entities
  public static final String ENTITY_REPORT_DATA = "entityReportData";
  public static final String TEST_CASE_RESOLUTION_STATUS = "testCaseResolutionStatus";
  public static final String WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA =
      "webAnalyticEntityViewReportData";
  public static final String WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA =
      "webAnalyticUserActivityReportData";
  public static final String RAW_COST_ANALYSIS_REPORT_DATA = "rawCostAnalysisReportData";
  public static final String AGGREGATED_COST_ANALYSIS_REPORT_DATA =
      "aggregatedCostAnalysisReportData";

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

  public static final String DOCUMENT = "document";
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
    SERVICE_TYPE_ENTITY_MAP.put(ServiceType.SEARCH, SEARCH_SERVICE);
  }

  private Entity() {}

  public static void initializeRepositories(OpenMetadataApplicationConfig config, Jdbi jdbi) {
    if (!initializedRepositories) {
      tokenRepository = new TokenRepository();
      policyRepository = new PolicyRepository();
      roleRepository = new RoleRepository();
      List<Class<?>> repositories = getRepositories();
      for (Class<?> clz : repositories) {
        if (Modifier.isAbstract(clz.getModifiers())) {
          continue; // Don't instantiate abstract classes
        }
        try {
          clz.getDeclaredConstructor().newInstance();
        } catch (Exception e) {
          try {
            clz.getDeclaredConstructor(OpenMetadataApplicationConfig.class).newInstance(config);
          } catch (Exception ex) {
            try {
              clz.getDeclaredConstructor(Jdbi.class).newInstance(jdbi);
            } catch (Exception exception) {
              LOG.warn("Exception encountered", exception);
            }
          }
        }
      }
      initializedRepositories = true;
    }
  }

  public static void cleanup() {
    initializedRepositories = false;
    collectionDAO = null;
    searchRepository = null;
    ENTITY_REPOSITORY_MAP.clear();
  }

  public static <T extends EntityInterface> void registerEntity(
      Class<T> clazz, String entity, EntityRepository<T> entityRepository) {
    ENTITY_REPOSITORY_MAP.put(entity, entityRepository);
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put(entity.toLowerCase(Locale.ROOT), entity);
    EntityInterface.ENTITY_TYPE_TO_CLASS_MAP.put(entity.toLowerCase(Locale.ROOT), clazz);
    ENTITY_LIST.add(entity);

    LOG.debug("Registering entity {} {}", clazz, entity);
  }

  public static <T extends EntityTimeSeriesInterface> void registerEntity(
      Class<T> clazz, String entity, EntityTimeSeriesRepository<T> entityRepository) {
    ENTITY_TS_REPOSITORY_MAP.put(entity, entityRepository);
    EntityTimeSeriesInterface.CANONICAL_ENTITY_NAME_MAP.put(
        entity.toLowerCase(Locale.ROOT), entity);
    EntityTimeSeriesInterface.ENTITY_TYPE_TO_CLASS_MAP.put(entity.toLowerCase(Locale.ROOT), clazz);
    ENTITY_LIST.add(entity);

    LOG.debug("Registering entity time series {} {}", clazz, entity);
  }

  public static void registerResourcePermissions(
      String entity, List<MetadataOperation> entitySpecificOperations) {
    // Set up entity operations for permissions
    Class<?> clazz = getEntityClassFromType(entity);
    ResourceRegistry.addResource(entity, entitySpecificOperations, getEntityFields(clazz));
  }

  public static void registerTimeSeriesResourcePermissions(String entity) {
    // Set up entity operations for permissions
    Class<?> clazz = getEntityTimeSeriesClassFromType(entity);
    ResourceRegistry.addResource(entity, null, getEntityFields(clazz));
  }

  public static Set<String> getEntityList() {
    return Collections.unmodifiableSet(ENTITY_LIST);
  }

  public static EntityReference getEntityReference(EntityReference ref, Include include) {
    if (ref == null) {
      return null;
    }
    return ref.getId() != null
        ? getEntityReferenceById(ref.getType(), ref.getId(), include)
        : getEntityReferenceByName(ref.getType(), ref.getFullyQualifiedName(), include);
  }

  public static EntityReference getEntityReferenceById(
      @NonNull String entityType, @NonNull UUID id, Include include) {
    EntityRepository<? extends EntityInterface> repository = getEntityRepository(entityType);
    include = repository.supportsSoftDelete ? Include.ALL : include;
    return repository.getReference(id, include);
  }

  public static EntityReference getEntityReferenceByName(
      @NonNull String entityType, String fqn, Include include) {
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
  public static <T> T getEntity(
      String entityType, UUID id, String fields, Include include, boolean fromCache) {
    EntityRepository<?> entityRepository = Entity.getEntityRepository(entityType);
    @SuppressWarnings("unchecked")
    T entity =
        (T) entityRepository.get(null, id, entityRepository.getFields(fields), include, fromCache);
    return entity;
  }

  public static <T> T getEntity(String entityType, UUID id, String fields, Include include) {
    return getEntity(entityType, id, fields, include, true);
  }

  /** Retrieve the entity using id from given entity reference and fields */
  public static <T> T getEntityByName(
      String entityType, String fqn, String fields, Include include, boolean fromCache) {
    EntityRepository<?> entityRepository = Entity.getEntityRepository(entityType);
    @SuppressWarnings("unchecked")
    T entity =
        (T)
            entityRepository.getByName(
                null, fqn, entityRepository.getFields(fields), include, fromCache);
    return entity;
  }

  public static <T> T getEntityByName(
      String entityType, String fqn, String fields, Include include) {
    return getEntityByName(entityType, fqn, fields, include, true);
  }

  /** Retrieve the corresponding entity repository for a given entity name. */
  public static EntityRepository<? extends EntityInterface> getEntityRepository(
      @NonNull String entityType) {
    EntityRepository<? extends EntityInterface> entityRepository =
        ENTITY_REPOSITORY_MAP.get(entityType);
    if (entityRepository == null) {
      throw EntityNotFoundException.byMessage(
          CatalogExceptionMessage.entityRepositoryNotFound(entityType));
    }
    return entityRepository;
  }

  public static EntityTimeSeriesRepository<? extends EntityTimeSeriesInterface>
      getEntityTimeSeriesRepository(@NonNull String entityType) {
    EntityTimeSeriesRepository<? extends EntityTimeSeriesInterface> entityTimeSeriesRepository =
        ENTITY_TS_REPOSITORY_MAP.get(entityType);
    if (entityTimeSeriesRepository == null) {
      throw EntityNotFoundException.byMessage(
          CatalogExceptionMessage.entityTypeNotFound(entityType));
    }
    return entityTimeSeriesRepository;
  }

  /** Retrieve the corresponding entity repository for a given entity name. */
  public static EntityRepository<? extends EntityInterface> getServiceEntityRepository(
      @NonNull ServiceType serviceType) {
    EntityRepository<? extends EntityInterface> entityRepository =
        ENTITY_REPOSITORY_MAP.get(SERVICE_TYPE_ENTITY_MAP.get(serviceType));
    if (entityRepository == null) {
      throw EntityNotFoundException.byMessage(
          CatalogExceptionMessage.entityTypeNotFound(serviceType.value()));
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
    try {
      dao.find(entityId, Include.ALL);
      dao.delete(updatedBy, entityId, recursive, hardDelete);
    } catch (EntityNotFoundException e) {
      LOG.warn("Entity {} is already deleted.", entityId);
    }
  }

  public static void restoreEntity(String updatedBy, String entityType, UUID entityId) {
    EntityRepository<?> dao = getEntityRepository(entityType);
    dao.restoreEntity(updatedBy, entityType, entityId);
  }

  public static <T> String getEntityTypeFromClass(Class<T> clz) {
    return EntityInterface.CANONICAL_ENTITY_NAME_MAP.get(
        clz.getSimpleName().toLowerCase(Locale.ROOT));
  }

  public static String getEntityTypeFromObject(Object object) {
    return EntityInterface.CANONICAL_ENTITY_NAME_MAP.get(
        object.getClass().getSimpleName().toLowerCase(Locale.ROOT));
  }

  public static Class<? extends EntityInterface> getEntityClassFromType(String entityType) {
    return EntityInterface.ENTITY_TYPE_TO_CLASS_MAP.get(entityType.toLowerCase(Locale.ROOT));
  }

  public static Class<? extends EntityTimeSeriesInterface> getEntityTimeSeriesClassFromType(
      String entityType) {
    return EntityTimeSeriesInterface.ENTITY_TYPE_TO_CLASS_MAP.get(
        entityType.toLowerCase(Locale.ROOT));
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
          throw new IllegalArgumentException(
              String.format("Invalid entity %s in query param %s", entity, name));
        }
      }
    }
  }

  /** Compile a list of REST collections based on Resource classes marked with {@code Repository} annotation */
  private static List<Class<?>> getRepositories() {
    try (ScanResult scanResult = new ClassGraph().enableAnnotationInfo().scan()) {
      ClassInfoList classList = scanResult.getClassesWithAnnotation(Repository.class);
      return classList.loadClasses();
    }
  }

  public static <T extends FieldInterface> void populateEntityFieldTags(
      String entityType, List<T> fields, String fqnPrefix, boolean setTags) {
    EntityRepository<?> repository = Entity.getEntityRepository(entityType);
    // Get Flattened Fields
    List<T> flattenedFields = getFlattenedEntityField(fields);

    // Fetch All tags belonging to Prefix
    Map<String, List<TagLabel>> allTags = repository.getTagsByPrefix(fqnPrefix, ".%");
    for (T c : listOrEmpty(flattenedFields)) {
      if (setTags) {
        List<TagLabel> columnTag =
            allTags.get(FullyQualifiedName.buildHash(c.getFullyQualifiedName()));
        if (columnTag == null) {
          c.setTags(new ArrayList<>());
        } else {
          c.setTags(addDerivedTags(columnTag));
        }
      } else {
        c.setTags(c.getTags());
      }
    }
  }

  public static SearchIndex buildSearchIndex(String entityType, Object entity) {
    if (searchRepository != null) {
      return searchRepository.getSearchIndexFactory().buildIndex(entityType, entity);
    }
    throw new BadRequestException("searchrepository not initialized");
  }

  public static <T> T getDao() {
    return (T) collectionDAO;
  }
}
