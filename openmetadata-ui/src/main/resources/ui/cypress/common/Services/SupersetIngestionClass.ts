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
import ServiceBaseClass from '../Entities/ServiceBaseClass';
import { Services } from '../Utils/Services';

class SupersetIngestionClass extends ServiceBaseClass {
  constructor() {
    super(
      Services.Dashboard,
      'cypress-Superset',
      'Superset',
      "World Bank's Data"
    );
  }

  createService() {
    super.createService();
  }

  updateService() {
    // Issue with searching ingested data
  }

  fillConnectionDetails() {
    cy.get('#root\\/connection\\/username')
      .scrollIntoView()
      .type(Cypress.env('supersetUsername'));
    cy.get('#root\\/connection\\/password')
      .scrollIntoView()
      .type(Cypress.env('supersetPassword'));
    cy.get('#root\\/hostPort')
      .scrollIntoView()
      .focus()
      .clear()
      .type(Cypress.env('supersetHostPort'));
  }

  fillIngestionDetails() {
    cy.get('#root\\/dashboardFilterPattern\\/includes')
      .scrollIntoView()
      .type(`${this.entityName}{enter}`);
  }

  deleteService() {
    super.deleteService();
  }
}

export default SupersetIngestionClass;
