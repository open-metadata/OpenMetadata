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

class MetabaseIngestionClass extends ServiceBaseClass {
  name: string;
  tableName = 'jaffle_shop dashboard';
  constructor() {
    super(
      Services.Storages,
      'cypress-Metabase',
      'Metabase',
      'jaffle_shop dashboard'
    );
    this.tableName = 'jaffle_shop dashboard';
  }

  createService() {
    super.createService();
  }

  updateService() {
    super.updateService();
  }

  fillConnectionDetails() {
    cy.get('#root\\/username')
      .scrollIntoView()
      .type(Cypress.env('metabaseUsername'));
    checkServiceFieldSectionHighlighting('username');
    cy.get('#root\\/password')
      .scrollIntoView()
      .type(Cypress.env('metabasePassword'));
    checkServiceFieldSectionHighlighting('password');
    cy.get('#root\\/hostPort')
      .scrollIntoView()
      .type(Cypress.env('metabaseHostPort'));
    checkServiceFieldSectionHighlighting('hostPort');
  }

  fillIngestionDetails() {
    cy.get('#root\\/dashboardFilterPattern\\/includes')
      .scrollIntoView()
      .type(`${this.tableName}{enter}`);
  }

  deleteService() {
    super.deleteService('cypress-Metabase');
  }
}

export default MetabaseIngestionClass;
