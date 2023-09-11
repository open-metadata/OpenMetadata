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

package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.resources.EntityResource.searchClient;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.type.DashboardConnection;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.services.dashboard.DashboardServiceResource;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil;

@Slf4j
public class DashboardServiceRepository extends ServiceEntityRepository<DashboardService, DashboardConnection> {

  public DashboardServiceRepository(CollectionDAO dao) {
    super(
        DashboardServiceResource.COLLECTION_PATH,
        Entity.DASHBOARD_SERVICE,
        dao,
        dao.dashboardServiceDAO(),
        DashboardConnection.class,
        ServiceType.DASHBOARD);
    supportsSearchIndex = true;
  }

  @Override
  public void deleteFromSearch(DashboardService entity, String changeType) {
    if (supportsSearchIndex) {
      if (changeType.equals(RestUtil.ENTITY_SOFT_DELETED) || changeType.equals(RestUtil.ENTITY_RESTORED)) {
        searchClient.softDeleteOrRestoreEntityFromSearch(
            JsonUtils.deepCopy(entity, DashboardService.class),
            changeType.equals(RestUtil.ENTITY_SOFT_DELETED),
            "service.fullyQualifiedName");
      } else {
        searchClient.updateSearchEntityDeleted(
            JsonUtils.deepCopy(entity, DashboardService.class), "", "service.fullyQualifiedName");
      }
    }
  }

  @Override
  public void restoreFromSearch(DashboardService entity) {
    if (supportsSearchIndex) {
      searchClient.softDeleteOrRestoreEntityFromSearch(
          JsonUtils.deepCopy(entity, DashboardService.class), false, "service.fullyQualifiedName");
    }
  }
}
