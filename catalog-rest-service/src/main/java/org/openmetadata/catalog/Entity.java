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

package org.openmetadata.catalog;

import java.io.IOException;
import java.net.URI;
import java.text.ParseException;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import javax.ws.rs.core.UriInfo;
import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.exception.UnhandledServerException;
import org.openmetadata.catalog.jdbi3.EntityDAO;
import org.openmetadata.catalog.jdbi3.EntityRepository;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;

@Slf4j
public final class Entity {
  // Lower case entity name to canonical entity name map
  private static final Map<String, String> CANONICAL_ENTITY_NAME_MAP = new HashMap<>();

  // Canonical entity name to corresponding EntityDAO map
  private static final Map<String, EntityDAO<?>> DAO_MAP = new HashMap<>();

  // Canonical entity name to corresponding EntityRepository map
  private static final Map<String, EntityRepository<?>> ENTITY_REPOSITORY_MAP = new HashMap<>();

  // Entity class to entity repository map
  private static final Map<Class<?>, EntityRepository<?>> CLASS_ENTITY_REPOSITORY_MAP = new HashMap<>();

  //
  // Services
  //
  public static final String DATABASE_SERVICE = "databaseService";
  public static final String MESSAGING_SERVICE = "messagingService";
  public static final String DASHBOARD_SERVICE = "dashboardService";
  public static final String PIPELINE_SERVICE = "pipelineService";
  public static final String STORAGE_SERVICE = "storageService";

  //
  // Data assets
  //
  public static final String TABLE = "table";
  public static final String DATABASE = "database";
  public static final String METRICS = "metrics";
  public static final String DASHBOARD = "dashboard";
  public static final String PIPELINE = "pipeline";
  public static final String CHART = "chart";
  public static final String REPORT = "report";
  public static final String TOPIC = "topic";
  public static final String MLMODEL = "mlmodel";
  // Not deleted to ensure the ordinal value of the entities after this remains the same
  public static final String UNUSED = "unused";
  public static final String BOTS = "bots";
  public static final String LOCATION = "location";
  public static final String GLOSSARY = "glossary";
  public static final String GLOSSARY_TERM = "glossaryTerm";
  public static final String THREAD = "thread";

  //
  // Policies
  //
  public static final String POLICY = "policy";

  //
  // Role, team and user
  //
  public static final String ROLE = "role";
  public static final String USER = "user";
  public static final String TEAM = "team";

  //
  // Operations
  //
  public static final String AIRFLOW_PIPELINE = "airflowPipeline";
  public static final String WEBHOOK = "webhook";

  private Entity() {}

  public static <T> void registerEntity(
      Class<T> clazz, String entity, EntityDAO<T> dao, EntityRepository<T> entityRepository) {
    DAO_MAP.put(entity, dao);
    ENTITY_REPOSITORY_MAP.put(entity, entityRepository);
    CANONICAL_ENTITY_NAME_MAP.put(entity.toLowerCase(Locale.ROOT), entity);
    CLASS_ENTITY_REPOSITORY_MAP.put(clazz, entityRepository);
    LOG.info(
        "Registering entity {} {} {} {}",
        clazz,
        entity,
        dao.getEntityClass().getSimpleName(),
        entityRepository.getClass().getSimpleName());
  }

  public static EntityReference getEntityReference(EntityReference ref) throws IOException {
    return getEntityReferenceById(ref.getType(), ref.getId());
  }

  public static EntityReference getEntityReferenceById(@NonNull String entity, @NonNull UUID id) throws IOException {
    EntityDAO<?> dao = DAO_MAP.get(entity);
    if (dao == null) {
      throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityTypeNotFound(entity));
    }
    return dao.findEntityReferenceById(id);
  }

  public static EntityReference getEntityReferenceByName(@NonNull String entity, @NonNull String fqn)
      throws IOException {
    EntityDAO<?> dao = DAO_MAP.get(entity);
    if (dao == null) {
      throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityTypeNotFound(entity));
    }
    return dao.findEntityReferenceByName(fqn);
  }

  public static <T> EntityReference getEntityReference(T entity) {
    String entityType = getEntityTypeFromObject(entity);

    @SuppressWarnings("unchecked")
    EntityRepository<T> entityRepository = (EntityRepository<T>) ENTITY_REPOSITORY_MAP.get(entityType);
    if (entityRepository == null) {
      throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityTypeNotFound(entityType));
    }
    return entityRepository.getEntityInterface(entity).getEntityReference();
  }

  public static void withHref(UriInfo uriInfo, List<EntityReference> list) {
    Optional.ofNullable(list).orElse(Collections.emptyList()).forEach(ref -> withHref(uriInfo, ref));
  }

  public static EntityReference withHref(UriInfo uriInfo, EntityReference ref) {
    if (ref == null) {
      return null;
    }
    String entityType = ref.getType();
    EntityRepository<?> entityRepository = ENTITY_REPOSITORY_MAP.get(entityType);
    if (entityRepository == null) {
      throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityTypeNotFound(entityType));
    }
    URI href = entityRepository.getHref(uriInfo, ref.getId());
    return ref.withHref(href);
  }

  public static <T> EntityInterface<T> getEntityInterface(T entity) {
    if (entity == null) {
      return null;
    }
    String entityType = getEntityTypeFromObject(entity);
    EntityRepository<T> entityRepository = getEntityRepository(entityType);
    return entityRepository.getEntityInterface(entity);
  }

  /**
   * Retrieve the entity using id from given entity reference and fields
   *
   * @return entity object eg: {@link org.openmetadata.catalog.entity.data.Table}, {@link
   *     org.openmetadata.catalog.entity.data.Topic}, etc
   */
  public static <T> T getEntity(EntityReference entityReference, EntityUtil.Fields fields)
      throws IOException, ParseException {
    return getEntity(entityReference, fields, Include.NON_DELETED);
  }

  /**
   * Retrieve the entity using id from given entity reference and fields
   *
   * @return entity object eg: {@link org.openmetadata.catalog.entity.data.Table}, {@link
   *     org.openmetadata.catalog.entity.data.Topic}, etc
   */
  public static <T> T getEntity(EntityReference entityReference, EntityUtil.Fields fields, Include include)
      throws IOException, ParseException {
    if (entityReference == null) {
      return null;
    }

    EntityRepository<?> entityRepository = Entity.getEntityRepository(entityReference.getType());
    @SuppressWarnings("unchecked")
    T entity = (T) entityRepository.get(null, entityReference.getId().toString(), fields, include);
    if (entity == null) {
      throw EntityNotFoundException.byMessage(
          CatalogExceptionMessage.entityNotFound(entityReference.getType(), entityReference.getId()));
    }
    return entity;
  }

  /**
   * Retrieve the corresponding entity repository for a given entity name.
   *
   * @param entityType type of entity, eg: {@link Entity#TABLE}, {@link Entity#TOPIC}, etc
   * @return entity repository corresponding to the entity name
   */
  public static <T> EntityRepository<T> getEntityRepository(@NonNull String entityType) {
    @SuppressWarnings("unchecked")
    EntityRepository<T> entityRepository = (EntityRepository<T>) ENTITY_REPOSITORY_MAP.get(entityType);
    if (entityRepository == null) {
      throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityTypeNotFound(entityType));
    }
    return entityRepository;
  }

  public static void deleteEntity(String updatedBy, String entity, UUID entityId, boolean recursive)
      throws IOException, ParseException {
    EntityRepository<?> dao = ENTITY_REPOSITORY_MAP.get(entity);
    if (dao == null) {
      throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityTypeNotFound(entity));
    }
    dao.delete(updatedBy, entityId.toString(), recursive);
  }

  public static <T> EntityRepository<T> getEntityRepositoryForClass(@NonNull Class<T> clazz) {
    @SuppressWarnings("unchecked")
    EntityRepository<T> entityRepository = (EntityRepository<T>) CLASS_ENTITY_REPOSITORY_MAP.get(clazz);
    if (entityRepository == null) {
      throw new UnhandledServerException(
          String.format(
              "Class %s is not an Entity class and it doesn't have a EntityRepository companion",
              clazz.getSimpleName()));
    }
    return entityRepository;
  }

  /**
   * Utility method to create the decorator from an Entity or EntityReference instance. By Entity class we don't mean
   * Entity.java but the entity classes generated from JSONSchema files like DatabaseService, Database, Table, and so
   * on.
   *
   * @param object must be an Entity class instance with a companion EntityRepository or an EntityReference
   * @param <T> must be the Entity class of this entity or object if multiple results are possible.
   * @return the decorator
   */
  public static <T> EntityRepository<T>.EntityHelper helper(@NonNull Object object) throws IOException, ParseException {
    T entity = (T) object;
    if (object instanceof EntityReference) {
      entity = getEntity((EntityReference) object, Fields.EMPTY_FIELDS);
    }
    EntityRepository<T> entityRepository = (EntityRepository<T>) getEntityRepositoryForClass(entity.getClass());
    return entityRepository.getEntityHandler(entity);
  }

  public static <T> String getEntityTypeFromClass(Class<T> clz) {
    return CANONICAL_ENTITY_NAME_MAP.get(clz.getSimpleName().toLowerCase(Locale.ROOT));
  }

  public static String getEntityTypeFromObject(Object object) {
    return CANONICAL_ENTITY_NAME_MAP.get(object.getClass().getSimpleName().toLowerCase(Locale.ROOT));
  }

  /** Class for getting validated entity list from a queryParam with list of entities. */
  public static class EntityList {
    private EntityList() {}

    public static List<String> getEntityList(String name, String entitiesParam) {
      if (entitiesParam == null) {
        return null;
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
