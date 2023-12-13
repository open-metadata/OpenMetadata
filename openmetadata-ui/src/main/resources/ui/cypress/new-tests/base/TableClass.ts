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
import { visitEntityDetailsPage } from '../../common/common';
import { createEntityTable } from '../../common/EntityUtils';
import { DATABASE_SERVICE } from '../../constants/EntityConstant';
import EntityClass from './EntityClass';

class TableClass extends EntityClass {
  tableName: string;

  constructor() {
    const tableName = `cypress-table-${Date.now()}`;
    super(tableName, {});

    this.tableName = tableName;
  }

  visitEntity() {
    visitEntityDetailsPage({
      term: this.tableName,
      serviceName: DATABASE_SERVICE.service.name,
      entity: 'tables',
      dataTestId: null,
      entityFqn: null,
      entityType: null,
    });
  }

  // Creation

  createEntity() {
    // Handle creation here

    cy.getAllLocalStorage().then((data) => {
      const token = Object.values(data)[0].oidcIdToken;

      createEntityTable({
        token,
        ...DATABASE_SERVICE,
        tables: [{ ...DATABASE_SERVICE.entity, name: this.tableName }],
      });
    });
  }
}

export default TableClass;
