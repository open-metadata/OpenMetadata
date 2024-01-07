/*
 *  Copyright 2023 Collate.
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
import { createSingleLevelEntity } from '../../common/EntityUtils';
import {
  deleteEntityViaREST,
  visitEntityDetailsPage,
} from '../../common/Utils/Entity';
import { EntityType } from '../../constants/Entity.interface';
import {
  DASHBOARD_SERVICE,
  DASHBOARD_SERVICE_DETAILS,
} from '../../constants/EntityConstant';
import EntityClass from './EntityClass';

class DashboardClass extends EntityClass {
  dashboardName: string;

  constructor() {
    const dashboardName = `cypress-dashboard-${Date.now()}`;
    super(dashboardName, DASHBOARD_SERVICE.entity, EntityType.Dashboard);

    this.dashboardName = dashboardName;
    this.name = 'Dashboard';
  }

  visitEntity() {
    visitEntityDetailsPage({
      term: this.dashboardName,
      serviceName: DASHBOARD_SERVICE.service.name,
      entity: this.endPoint,
    });
  }

  // Creation

  createEntity() {
    // Handle creation here

    cy.getAllLocalStorage().then((data) => {
      const token = Object.values(data)[0].oidcIdToken as string;

      createSingleLevelEntity({
        token,
        ...DASHBOARD_SERVICE,
        entity: [
          {
            ...DASHBOARD_SERVICE.entity,
            name: this.dashboardName,
            displayName: this.dashboardName,
          },
        ],
      });
    });
  }

  // Cleanup
  override cleanup() {
    super.cleanup();
    cy.getAllLocalStorage().then((data) => {
      const token = Object.values(data)[0].oidcIdToken as string;
      deleteEntityViaREST({
        token,
        endPoint: EntityType.DashboardService,
        entityName: DASHBOARD_SERVICE_DETAILS.name,
      });
    });
  }
}

export default DashboardClass;
