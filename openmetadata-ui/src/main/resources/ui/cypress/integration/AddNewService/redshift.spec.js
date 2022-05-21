/*
 *  Copyright 2021 Collate
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

import { goToAddNewServicePage, testServiceCreationAndIngestion } from '../../common/common';

describe('RedShift Ingestion', () => {
  it.skip('add and ingest data', () => {
    goToAddNewServicePage();
    const connectionInput = () => {
      cy.get('#root_username').type(Cypress.env('redshiftUsername'));
      cy.get('#root_password')
        .scrollIntoView()
        .type(Cypress.env('redshiftPassword'));
      cy.get('#root_hostPort')
        .scrollIntoView()
        .type(Cypress.env('redshiftHost'));
      cy.get('#root_database')
        .scrollIntoView()
        .type(Cypress.env('redshiftDatabase'));
    };

    const addIngestionInput = () => {
      // no schema or database filters
      cy.get('[data-testid="schema-filter-pattern-checkbox"]').check();
      cy.get('[data-testid="filter-pattern-includes-schema"]')
        .should('be.visible')
        .type('dbt_jaffle');
    };

    testServiceCreationAndIngestion(
      'Redshift',
      connectionInput,
      addIngestionInput
    );
  });
});
