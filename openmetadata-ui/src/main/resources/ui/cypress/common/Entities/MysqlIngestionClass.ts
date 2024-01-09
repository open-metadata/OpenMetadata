/*
 *  Copyright 2024 Collate.
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
import { checkServiceFieldSectionHighlighting } from '../common';
import { Services } from '../Utils/Services';
import ServiceBaseClass from './ServiceBaseClass';

class MysqlIngestionClass extends ServiceBaseClass {
  name: string;
  constructor() {
    super(Services.Databases, 'cypress-mysql', 'Database', 'team_entity');
  }

  createService() {
    super.createService();
  }

  fillConnectionDetails() {
    cy.get('#root\\/username').type(Cypress.env('mysqlUsername'));
    checkServiceFieldSectionHighlighting('username');
    cy.get('#root\\/authType\\/password').type(Cypress.env('mysqlPassword'));
    checkServiceFieldSectionHighlighting('password');
    cy.get('#root\\/hostPort').type(Cypress.env('mysqlHostPort'));
    checkServiceFieldSectionHighlighting('hostPort');
    cy.get('#root\\/databaseSchema').type(Cypress.env('mysqlDatabaseSchema'));
    checkServiceFieldSectionHighlighting('databaseSchema');
  }

  fillIngestionDetails() {
    cy.get('#root\\/schemaFilterPattern\\/includes')
      .scrollIntoView()
      .type(`${Cypress.env('mysqlDatabaseSchema')}{enter}`);
  }

  validateIngestionDetails() {
    cy.get('.ant-select-selection-item-content')
      .scrollIntoView()
      .contains(`${Cypress.env('mysqlDatabaseSchema')}`);
  }
}

export default MysqlIngestionClass;
