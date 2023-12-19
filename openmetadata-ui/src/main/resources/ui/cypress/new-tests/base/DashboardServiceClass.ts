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
import { visitServiceDetailsPage } from '../../common/serviceUtils';
import { SERVICE_TYPE } from '../../constants/constants';
import { DASHBOARD_SERVICE } from '../../constants/EntityConstant';
import EntityClass, { EntityType } from './EntityClass';

class DashboardServiceClass extends EntityClass {
  dashboardName: string;

  constructor() {
    const dashboardName = `cypress-dashboard-service-${Date.now()}`;
    super(dashboardName, DASHBOARD_SERVICE.entity, EntityType.DashboardService);

    this.dashboardName = dashboardName;
    this.name = 'Dashboard Service';
  }

  visitEntity() {
    visitServiceDetailsPage(
      {
        name: this.dashboardName,
        type: SERVICE_TYPE.Dashboard,
      },
      false
    );
  }

  // Creation

  createEntity() {
    // Handle creation here

    cy.getAllLocalStorage().then((data) => {
      const token = Object.values(data)[0].oidcIdToken as string;

      createSingleLevelEntity({
        ...DASHBOARD_SERVICE,
        service: { ...DASHBOARD_SERVICE.service, name: this.dashboardName },
        entity: {
          ...DASHBOARD_SERVICE.entity,
          service: this.dashboardName,
        },
        token,
      });
    });
  }
}

export default DashboardServiceClass;
