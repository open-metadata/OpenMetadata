/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog;

import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.jdbi3.EntityDAO;
import org.openmetadata.catalog.jdbi3.EntityRepository;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.EntityInterface;

import javax.ws.rs.core.UriInfo;
import java.io.IOException;
import java.net.URI;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

public final class Entity {
  private static final Map<String, EntityDAO<?>> DAO_MAP = new HashMap<>();
  private static final Map<String, EntityRepository> ENTITY_REPOSITORY_MAP = new HashMap<>();
  private static final Map<String, String> CANONICAL_ENTITY_NAME_MAP = new HashMap<>();

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
  public static final String DBTMODEL = "dbtmodel";
  public static final String BOTS = "bots";
  public static final String LOCATION = "location";

  //
  // Policies
  //
  public static final String POLICY = "policy";

  //
  // Team/user
  //
  public static final String USER = "user";
  public static final String TEAM = "team";

  // Operations
  public static final String INGESTION = "ingestion";

  private Entity() {
  }

  public static void registerEntity(String entity, EntityDAO<?> dao,
                                    EntityRepository<?> entityRepository) {
    DAO_MAP.put(entity, dao);
    ENTITY_REPOSITORY_MAP.put(entity, entityRepository);
    CANONICAL_ENTITY_NAME_MAP.put(entity.toLowerCase(Locale.ROOT), entity);
    System.out.println("Registering entity " + entity);
  }

  public static EntityReference getEntityReference(String entity, UUID id) throws IOException {
    EntityDAO<?> dao = DAO_MAP.get(entity);
    if (dao == null) {
      throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityTypeNotFound(entity));
    }
    return dao.findEntityReferenceById(id);
  }

  public static EntityReference getEntityReferenceByName(String entity, String fqn) throws IOException {
    EntityDAO<?> dao = DAO_MAP.get(entity);
    if (dao == null) {
      throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityTypeNotFound(entity));
    }
    return dao.findEntityReferenceByName(fqn);
  }

  public static EntityReference getEntityReference(Object entity) {
    String entityName = getEntityNameFromObject(entity);
    EntityRepository entityRepository = ENTITY_REPOSITORY_MAP.get(entityName);
    if (entityRepository == null) {
      throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityTypeNotFound(entityName));
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
    String entityName = ref.getType();
    EntityRepository<?> entityRepository = ENTITY_REPOSITORY_MAP.get(entityName);
    if (entityRepository == null) {
      throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityTypeNotFound(entityName));
    }
    URI href = entityRepository.getHref(uriInfo, ref.getId());
    return ref.withHref(href);
  }

  public static EntityInterface getEntityInterface(Object entity) {
    if (entity == null) {
      return null;
    }
    String entityName = getEntityNameFromObject(entity);
    EntityRepository entityRepository = ENTITY_REPOSITORY_MAP.get(entityName);
    if (entityRepository == null) {
      throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityTypeNotFound(entityName));
    }
    return entityRepository.getEntityInterface(entity);
  }

  public static String getEntityNameFromObject(Object object) {
    return CANONICAL_ENTITY_NAME_MAP.get(object.getClass().getSimpleName().toLowerCase(Locale.ROOT));
  }

  public static class EntityList {

    public static List<String> getEntityList(String name, String entitiesParam) {
      if (entitiesParam == null) {
        return null;
      }
      List<String> list = Arrays.asList(entitiesParam.replaceAll("\\s", "").split(","));
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

