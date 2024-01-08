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
import {
  createEntityViaREST,
  deleteEntityViaREST,
  visitEntityDetailsPage,
} from '../../common/Utils/Entity';
import { EntityType } from '../../constants/Entity.interface';
import {
  DASHBOARD_DATA_MODEL_DETAILS,
  DASHBOARD_SERVICE_DETAILS,
} from '../../constants/EntityConstant';
import EntityClass from './EntityClass';

class DashboardDataModelClass extends EntityClass {
  dashboardDataModelName: string;

  constructor() {
    const dashboardDataModelName = `cypress-dashboard-data-model-${Date.now()}`;
    super(
      dashboardDataModelName,
      DASHBOARD_DATA_MODEL_DETAILS,
      EntityType.DataModel
    );

    this.dashboardDataModelName = dashboardDataModelName;
    this.name = 'Dashboard Data Model';
  }

  visitEntity() {
    visitEntityDetailsPage({
      term: this.dashboardDataModelName,
      serviceName: DASHBOARD_SERVICE_DETAILS.name,
      entity: this.endPoint,
    });
  }

  // Creation

  createEntity() {
    // Handle creation here

    cy.getAllLocalStorage().then((data) => {
      const token = Object.values(data)[0].oidcIdToken as string;

      createEntityViaREST({
        token,
        body: DASHBOARD_SERVICE_DETAILS,
        endPoint: EntityType.DashboardService,
      });

      createEntityViaREST({
        token,
        body: {
          ...DASHBOARD_DATA_MODEL_DETAILS,
          name: this.dashboardDataModelName,
          displayName: this.dashboardDataModelName,
        },
        endPoint: EntityType.DataModel,
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

export default DashboardDataModelClass;
