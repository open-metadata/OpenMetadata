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
  visitEntityDetailsPage,
} from '../../common/Utils/Entity';
import { EntityType } from '../../constants/Entity.interface';
import {
  DATABASE_SERVICE,
  DATABASE_SERVICE_DETAILS,
} from '../../constants/EntityConstant';
import { GlobalSettingOptions } from '../../constants/settings.constant';
import { getToken } from '../Utils/LocalStorage';
import {
  addOwner,
  removeOwner,
  updateOwner,
  validateOwnerAndTeamCounts,
} from '../Utils/Owner';
import EntityClass from './EntityClass';

class DatabaseClass extends EntityClass {
  databaseName: string;
  tableName: string;
  databaseSchemaName: string;

  constructor() {
    const databaseName = `cypress-database-${Date.now()}`;
    const tableName = `cypress-table-${Date.now()}`;
    const databaseSchemaName = `cypress-database-schema-${Date.now()}`;

    super(databaseName, DATABASE_SERVICE.database, EntityType.Database);

    this.databaseName = databaseName;
    this.tableName = tableName;
    this.databaseSchemaName = databaseSchemaName;
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
        type: GlobalSettingOptions.DATABASES,
      },
      false
    );

    cy.get(`[data-testid="${this.databaseName}"]`).click();
    verifyResponseStatusCode('@fetchDatabase', 200);
  }

  followUnfollowEntity() {
    // Skiping this since not supported for database
  }

  // Creation

  createEntity() {
    // Handle creation here

    cy.getAllLocalStorage().then((data) => {
      const token = getToken(data);

      createEntityTableViaREST({
        token,
        ...DATABASE_SERVICE,
        database: { ...DATABASE_SERVICE.database, name: this.databaseName },
        tables: [
          {
            ...DATABASE_SERVICE.entity,
            name: this.tableName,
            databaseSchema: `${DATABASE_SERVICE_DETAILS.name}.${this.databaseName}.${this.databaseSchemaName}`,
          },
        ],
        schema: {
          name: this.databaseSchemaName,
          database: `${DATABASE_SERVICE_DETAILS.name}.${this.databaseName}`,
        },
      });
    });
  }

  // Check owner is propogated to table entity and perform update and delete owner
  verifyOwnerPropogation(newOwnerName: string) {
    cy.goToHomePage();
    // Visit table entity details page
    visitEntityDetailsPage({
      term: this.tableName,
      serviceName: DATABASE_SERVICE.service.name,
      entity: EntityType.Table,
    });

    updateOwner(newOwnerName);
    cy.reload();
    removeOwner(newOwnerName);
    // Visit Database page again
    this.visitEntity();
  }

  override userOwnerFlow(ownerName: string, newOwnerName: string) {
    validateOwnerAndTeamCounts();
    addOwner(ownerName);
    // Verify Owner propogated to table entity
    this.verifyOwnerPropogation('Alex Pollard');
    updateOwner(newOwnerName);
    removeOwner(newOwnerName);
  }

  // Cleanup
  override cleanup() {
    super.cleanup();
    cy.getAllLocalStorage().then((data) => {
      const token = getToken(data);
      deleteEntityViaREST({
        token,
        endPoint: EntityType.DatabaseService,
        entityName: DATABASE_SERVICE.service.name,
      });
    });
  }
}

export default DatabaseClass;
