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
import { createEntityTableViaREST } from '../../common/Utils/Entity';
import { SERVICE_TYPE } from '../../constants/constants';
import { DATABASE_SERVICE } from '../../constants/EntityConstant';
import EntityClass, { EntityType } from './EntityClass';

class DatabaseSchemaClass extends EntityClass {
  databaseSchemaName: string;

  constructor() {
    const databaseSchemaName = `cypress-database-schema-${Date.now()}`;
    super(
      databaseSchemaName,
      DATABASE_SERVICE.schema,
      EntityType.DatabaseSchema
    );

    this.databaseSchemaName = databaseSchemaName;
    this.name = 'Database Schema';
  }

  visitEntity() {
    interceptURL(
      'GET',
      `/api/v1/databases/name/*${DATABASE_SERVICE.database.name}?*`,
      'fetchDatabase'
    );
    interceptURL(
      'GET',
      `/api/v1/databaseSchemas/name/*${this.databaseSchemaName}?*`,
      'fetchDatabaseSchema'
    );
    visitServiceDetailsPage(
      {
        name: DATABASE_SERVICE.service.name,
        type: SERVICE_TYPE.Database,
      },
      false
    );

    cy.get(`[data-testid="${DATABASE_SERVICE.database.name}"]`).click();
    verifyResponseStatusCode('@fetchDatabase', 200);

    cy.get(`[data-testid="${this.databaseSchemaName}"]`).click();
    verifyResponseStatusCode('@fetchDatabaseSchema', 200);
  }

  // Creation

  createEntity() {
    // Handle creation here

    cy.getAllLocalStorage().then((data) => {
      const token = Object.values(data)[0].oidcIdToken as string;

      createEntityTableViaREST({
        token,
        ...DATABASE_SERVICE,
        tables: [],
        schema: {
          ...DATABASE_SERVICE.schema,
          name: this.databaseSchemaName,
        },
      });
    });
  }
}

export default DatabaseSchemaClass;
