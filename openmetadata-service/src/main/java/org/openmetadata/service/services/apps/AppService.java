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

package org.openmetadata.service.services.apps;

import static org.openmetadata.schema.entity.app.ScheduleTimeline.HOURLY;
import static org.openmetadata.schema.entity.app.ScheduleTimeline.MONTHLY;
import static org.openmetadata.schema.entity.app.ScheduleTimeline.WEEKLY;
import static org.openmetadata.service.Entity.APPLICATION;
import static org.openmetadata.service.resources.EntityBaseService.getEntitiesFromSeedData;
import static org.openmetadata.service.security.mask.PIIMasker.ADMIN_USER_NAME;

import jakarta.ws.rs.core.UriInfo;
import java.util.List;
import java.util.Set;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppExtension;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.ScheduleTimeline;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.apps.ApplicationContext;
import org.openmetadata.service.apps.ApplicationHandler;
import org.openmetadata.service.apps.scheduler.AppScheduler;
import org.openmetadata.service.exception.AppException;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.resources.apps.AppMapper;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.services.AbstractEntityService;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.EntityUtil;

/**
 * Service layer for App entity operations.
 *
 * <p>Extends AbstractEntityService to inherit all standard CRUD operations with proper
 * authorization and repository delegation.
 */
@Slf4j
@Singleton
@Service(entityType = Entity.APPLICATION)
public class AppService extends AbstractEntityService<App> {

  @Getter private final AppMapper mapper;
  private final AppRepository appRepository;

  @Inject
  public AppService(
      AppRepository repository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      AppMapper mapper) {
    super(repository, searchRepository, authorizer, Entity.APPLICATION);
    this.appRepository = repository;
    this.mapper = mapper;
  }

  public List<EntityReference> listAllAppsReference() {
    return appRepository.listAllAppsReference();
  }

  public App getByName(
      UriInfo uriInfo, String name, EntityUtil.Fields fields, Include include, boolean fromCache) {
    return appRepository.getByName(uriInfo, name, fields, include, fromCache);
  }

  public App getByName(UriInfo uriInfo, String name, EntityUtil.Fields fields) {
    return appRepository.getByName(uriInfo, name, fields);
  }

  public App get(
      UriInfo uriInfo,
      java.util.UUID id,
      EntityUtil.Fields fields,
      Include include,
      boolean fromCache) {
    return appRepository.get(uriInfo, id, fields, include, fromCache);
  }

  public ResultList<AppRunRecord> listAppRuns(App app, int limit, int offset) {
    return appRepository.listAppRuns(app, limit, offset);
  }

  public AppRunRecord getLatestAppRuns(App app) {
    return appRepository.getLatestAppRuns(app);
  }

  public ResultList<AppExtension> listAppExtensionAfterTimeByName(
      App app,
      Long startTs,
      int limit,
      int offset,
      Class<AppExtension> clazz,
      AppExtension.ExtensionType extensionType) {
    return appRepository.listAppExtensionAfterTimeByName(
        app, startTs, limit, offset, clazz, extensionType);
  }

  public ResultList<AppExtension> listAppExtensionAfterTimeById(
      App app,
      Long startTs,
      int limit,
      int offset,
      Class<AppExtension> clazz,
      AppExtension.ExtensionType extensionType) {
    return appRepository.listAppExtensionAfterTimeById(
        app, startTs, limit, offset, clazz, extensionType);
  }

  public ResultList<AppExtension> listAppExtensionByName(
      App app,
      int limit,
      int offset,
      Class<AppExtension> clazz,
      AppExtension.ExtensionType extensionType) {
    return appRepository.listAppExtensionByName(app, limit, offset, clazz, extensionType);
  }

  public ResultList<AppExtension> listAppExtensionById(
      App app,
      int limit,
      int offset,
      Class<AppExtension> clazz,
      AppExtension.ExtensionType extensionType) {
    return appRepository.listAppExtensionById(app, limit, offset, clazz, extensionType);
  }

  public void initializeEntity(App app) {
    appRepository.initializeEntity(app);
  }

  public EntityUtil.Fields getFields(String fieldsParam) {
    return appRepository.getFields(fieldsParam);
  }

  public java.util.Set<String> getAllowedFields() {
    return appRepository.getAllowedFields();
  }

  public org.openmetadata.service.jdbi3.CollectionDAO getDaoCollection() {
    return appRepository.getDaoCollection();
  }

  public org.openmetadata.service.util.RestUtil.DeleteResponse<App> delete(
      String userName, java.util.UUID id, boolean recursive, boolean hardDelete) {
    return appRepository.delete(userName, id, recursive, hardDelete);
  }

  private static final Set<ScheduleTimeline> SCHEDULED_TYPES = Set.of(HOURLY, WEEKLY, MONTHLY);

  public void initialize(OpenMetadataApplicationConfig config) {
    try {
      CollectionDAO dao = Entity.getCollectionDAO();
      SearchRepository searchRepo = Entity.getSearchRepository();
      AppScheduler.initialize(config, dao, searchRepo);

      // Initialize Default Apps
      List<org.openmetadata.schema.entity.app.CreateApp> createAppsReq =
          getEntitiesFromSeedData(
              APPLICATION,
              String.format(".*json/data/%s/.*\\.json$", Entity.APPLICATION),
              org.openmetadata.schema.entity.app.CreateApp.class);
      loadDefaultApplications(createAppsReq, searchRepo);
      ApplicationContext.initialize();
    } catch (Exception ex) {
      LOG.error("Failed in Create App Requests", ex);
    }
  }

  private void loadDefaultApplications(
      List<org.openmetadata.schema.entity.app.CreateApp> defaultAppCreateRequests,
      SearchRepository searchRepo) {
    for (org.openmetadata.schema.entity.app.CreateApp createApp : defaultAppCreateRequests) {
      try {
        App app = getAppForInit(createApp.getName());
        if (app == null) {
          app = mapper.createToEntity(createApp, ADMIN_USER_NAME);
          scheduleAppIfNeeded(app, searchRepo);
          appRepository.initializeEntity(app);
        } else {
          scheduleAppIfNeeded(app, searchRepo);
        }
      } catch (AppException ex) {
        LOG.warn(
            "We could not install the application {}. Error: {}",
            createApp.getName(),
            ex.getMessage());
      } catch (Exception ex) {
        LOG.error("Failed in Creation/Initialization of Application : {}", createApp.getName(), ex);
      }
    }
  }

  private void scheduleAppIfNeeded(App app, SearchRepository searchRepo) {
    if (SCHEDULED_TYPES.contains(app.getScheduleType())) {
      ApplicationHandler.getInstance()
          .installApplication(app, Entity.getCollectionDAO(), searchRepo, ADMIN_USER_NAME);
    }
  }

  private App getAppForInit(String appName) {
    try {
      return appRepository.getByName(
          null, appName, appRepository.getFields("bot,pipelines"), Include.ALL, false);
    } catch (org.openmetadata.service.exception.EntityNotFoundException ex) {
      return null;
    }
  }
}
