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
import ServiceBaseClass from '../Entities/ServiceBaseClass';
import { Services } from '../Utils/Services';

class SnowflakeIngestionClass extends ServiceBaseClass {
  schema: string;
  constructor() {
    super(Services.Database, 'cypress-Snowflake', 'Snowflake', 'CUSTOMER');
    this.schema = 'TPCH_SF1000';
  }

  createService() {
    super.createService();
  }

  fillConnectionDetails() {
    cy.get('#root\\/username').type(Cypress.env('snowflakeUsername'));
    checkServiceFieldSectionHighlighting('username');
    cy.get('#root\\/password').type(Cypress.env('snowflakePassword'));
    checkServiceFieldSectionHighlighting('password');
    cy.get('#root\\/account').type(Cypress.env('snowflakeAccount'));
    checkServiceFieldSectionHighlighting('account');
    cy.get('#root\\/database').type(Cypress.env('snowflakeDatabase'));
    checkServiceFieldSectionHighlighting('database');
    cy.get('#root\\/warehouse').type(Cypress.env('snowflakeWarehouse'));
    checkServiceFieldSectionHighlighting('warehouse');
  }

  fillIngestionDetails() {
    cy.get('#root\\/schemaFilterPattern\\/includes')
      .scrollIntoView()
      .type(`${this.schema}{enter}`);
  }

  deleteService() {
    super.deleteService();
  }
}

export default SnowflakeIngestionClass;
