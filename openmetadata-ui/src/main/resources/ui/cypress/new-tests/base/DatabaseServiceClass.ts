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

import { createEntityTable } from '../../common/EntityUtils';
import { visitServiceDetailsPage } from '../../common/serviceUtils';
import { SERVICE_TYPE } from '../../constants/constants';
import { DATABASE_SERVICE } from '../../constants/EntityConstant';
import EntityClass, { EntityType } from './EntityClass';

class DatabaseServiceClass extends EntityClass {
  databaseName: string;

  constructor() {
    const databaseName = `cypress-database-service-${Date.now()}`;
    super(databaseName, DATABASE_SERVICE.entity, EntityType.DatabaseService);

    this.databaseName = databaseName;
    this.name = 'Database Service';
  }

  visitEntity() {
    visitServiceDetailsPage(
      {
        name: this.databaseName,
        type: SERVICE_TYPE.Database,
      },
      false
    );
  }

  // Creation

  createEntity() {
    // Handle creation here

    cy.getAllLocalStorage().then((data) => {
      const token = Object.values(data)[0].oidcIdToken as string;

      createEntityTable({
        ...DATABASE_SERVICE,
        service: { ...DATABASE_SERVICE.service, name: this.databaseName },
        database: { ...DATABASE_SERVICE.database, service: this.databaseName },
        schema: {
          ...DATABASE_SERVICE.schema,
          database: `${this.databaseName}.${DATABASE_SERVICE.database.name}`,
        },
        tables: [
          {
            ...DATABASE_SERVICE.entity,
            databaseSchema: `${this.databaseName}.${DATABASE_SERVICE.database.name}.${DATABASE_SERVICE.schema.name}`,
          },
        ],
        token,
      });
    });
  }
}

export default DatabaseServiceClass;
