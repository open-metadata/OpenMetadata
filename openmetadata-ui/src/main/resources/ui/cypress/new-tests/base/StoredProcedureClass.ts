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
  createEntityTableViaREST,
  deleteEntityViaREST,
  visitEntityDetailsPage,
} from '../../common/Utils/Entity';
import { EntityType } from '../../constants/Entity.interface';
import {
  DATABASE_SERVICE,
  STORED_PROCEDURE_DETAILS,
} from '../../constants/EntityConstant';
import EntityClass from './EntityClass';

class StoreProcedureClass extends EntityClass {
  storeProcedureName: string;

  constructor() {
    const storeProcedureName = `cypress-store-procedure-${Date.now()}`;
    super(
      storeProcedureName,
      STORED_PROCEDURE_DETAILS,
      EntityType.StoreProcedure
    );

    this.storeProcedureName = storeProcedureName;
    this.name = 'Store Procedure';
  }

  visitEntity() {
    visitEntityDetailsPage({
      term: this.storeProcedureName,
      serviceName: DATABASE_SERVICE.service.name,
      entity: this.endPoint,
    });
  }

  // Creation

  createEntity() {
    // Handle creation here

    cy.getAllLocalStorage().then((data) => {
      const token = Object.values(data)[0].oidcIdToken as string;

      createEntityTableViaREST({
        token,
        ...DATABASE_SERVICE,
        storeProcedure: {
          ...STORED_PROCEDURE_DETAILS,
          name: this.storeProcedureName,
        },
        tables: [],
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

export default StoreProcedureClass;
