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
import { interceptURL, verifyResponseStatusCode } from '../../common/common';
import { visitServiceDetailsPage } from '../../common/serviceUtils';
import {
  createEntityTableViaREST,
  deleteEntityViaREST,
} from '../../common/Utils/Entity';
import { SERVICE_TYPE } from '../../constants/constants';
import { DATABASE_SERVICE } from '../../constants/EntityConstant';
import EntityClass, { EntityType } from './EntityClass';

class DatabaseClass extends EntityClass {
  databaseName: string;

  constructor() {
    const databaseName = `cypress-database-${Date.now()}`;
    super(databaseName, DATABASE_SERVICE.database, EntityType.Database);

    this.databaseName = databaseName;
    this.name = 'Database';
  }

  visitEntity() {
    interceptURL(
      'GET',
      `/api/v1/databases/name/*${this.databaseName}?**`,
      'fetchDatabase'
    );
    visitServiceDetailsPage(
      {
        name: DATABASE_SERVICE.service.name,
        type: SERVICE_TYPE.Database,
      },
      false
    );

    cy.get(`[data-testid="${this.databaseName}"]`).click();
    verifyResponseStatusCode('@fetchDatabase', 200);
  }

  // Creation

  createEntity() {
    // Handle creation here

    cy.getAllLocalStorage().then((data) => {
      const token = Object.values(data)[0].oidcIdToken as string;

      createEntityTableViaREST({
        token,
        ...DATABASE_SERVICE,
        database: { ...DATABASE_SERVICE.database, name: this.databaseName },
        tables: [],
        schema: undefined,
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
        endPoint: EntityType.DatabaseService,
        entityName: DATABASE_SERVICE.service.name,
      });
    });
  }
}

export default DatabaseClass;
