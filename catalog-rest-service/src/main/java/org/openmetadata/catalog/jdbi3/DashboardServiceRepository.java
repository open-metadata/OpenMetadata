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

package org.openmetadata.catalog.jdbi3;

import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.services.DashboardService;
import org.openmetadata.catalog.resources.services.dashboard.DashboardServiceResource;
import org.openmetadata.catalog.secrets.SecretsManager;
import org.openmetadata.catalog.type.DashboardConnection;

public class DashboardServiceRepository extends ServiceRepository<DashboardService, DashboardConnection> {

  public DashboardServiceRepository(CollectionDAO dao, SecretsManager secretsManager) {
    super(
        DashboardServiceResource.COLLECTION_PATH,
        Entity.DASHBOARD_SERVICE,
        dao,
        dao.dashboardServiceDAO(),
        secretsManager,
        DashboardConnection.class);
  }

  @Override
  protected String getServiceType(DashboardService dashboardService) {
    return dashboardService.getServiceType().value();
  }
}
