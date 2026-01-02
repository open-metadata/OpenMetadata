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

import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.AppMarketPlaceDefinition;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.AppMarketPlaceRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.EntityBaseService;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.resources.apps.AppMarketPlaceMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.AppMarketPlaceUtil;

@Slf4j
@Singleton
@Service(entityType = Entity.APP_MARKET_PLACE_DEF)
public class AppMarketPlaceService
    extends EntityBaseService<AppMarketPlaceDefinition, AppMarketPlaceRepository> {

  @Getter private final AppMarketPlaceMapper mapper;
  public static final String FIELDS = "owners,tags";

  @Inject
  public AppMarketPlaceService(
      AppMarketPlaceRepository repository,
      Authorizer authorizer,
      AppMarketPlaceMapper mapper,
      Limits limits) {
    super(
        new ResourceEntityInfo<>(Entity.APP_MARKET_PLACE_DEF, AppMarketPlaceDefinition.class),
        repository,
        authorizer,
        limits);
    this.mapper = mapper;
  }

  @Override
  public void initialize(org.openmetadata.service.OpenMetadataApplicationConfig config) {
    try {
      AppMarketPlaceUtil.createAppMarketPlaceDefinitions(repository, mapper);
    } catch (Exception ex) {
      LOG.error("Failed in initializing App MarketPlace Service", ex);
    }
  }

  public static class AppMarketPlaceDefinitionList extends ResultList<AppMarketPlaceDefinition> {
    /* Required for serde */
  }
}
