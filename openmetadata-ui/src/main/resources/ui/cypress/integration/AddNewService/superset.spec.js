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

describe('Superset Ingestion', () => {
  it('add and ingest data', () => {
    goToAddNewServicePage();

    // Select Dashboard services
    cy.get('[data-testid="service-category"]').select('dashboardServices');

    const connectionInput = () => {
      cy.get('#root_username').type(Cypress.env('supersetUsername'));
      cy.get('#root_password')
        .scrollIntoView()
        .type(Cypress.env('supersetPassword'));
      cy.get('#root_hostPort')
        .scrollIntoView()
        .focus()
        .clear()
        .type(Cypress.env('supersetHostPort'));
    };

    const addIngestionInput = () => {
      // no filters
    };

    testServiceCreationAndIngestion(
      'Superset',
      connectionInput,
      addIngestionInput,
      'dashboard'
    );
  });
});
