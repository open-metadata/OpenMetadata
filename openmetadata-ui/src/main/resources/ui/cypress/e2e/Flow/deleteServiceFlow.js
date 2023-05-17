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
import {
  createDataWithApi,
  visitServiceDetailsPage,
} from '../../common/serviceUtils';
import { DELETE_TERM } from '../../constants/constants';
import {
  DASHBOARD_SERVICE_API,
  DATABASE_SERVICE_API,
  MESSAGING_SERVICE_API,
  ML_MODAL_SERVICE_API,
  PIPELINE_SERVICE_API,
  SERVICES,
  STORAGE_SERVICE_API,
} from '../../constants/updateDisplayName.constant';

describe('Delete service flow', () => {
  beforeEach(() => {
    cy.login();
  });

  it('Preparing data', () => {
    const token = localStorage.getItem('oidcIdToken');
    createDataWithApi(DATABASE_SERVICE_API, token);
    createDataWithApi(MESSAGING_SERVICE_API, token);
    createDataWithApi(DASHBOARD_SERVICE_API, token);
    createDataWithApi(PIPELINE_SERVICE_API, token);
    createDataWithApi(ML_MODAL_SERVICE_API, token);
    createDataWithApi(STORAGE_SERVICE_API, token);
  });

  Object.entries(SERVICES).map(([type, service]) => {
    it(`for ${type}`, () => {
      visitServiceDetailsPage(service);
      // Clicking on permanent delete radio button and checking the service name
      cy.get('[data-testid="manage-button"]')
        .should('exist')
        .should('be.visible')
        .click();

      cy.get('[data-menu-id*="delete-button"]')
        .should('exist')
        .should('be.visible');
      cy.get('[data-testid="delete-button-title"]')
        .should('be.visible')
        .click()
        .as('deleteBtn');

      // Clicking on permanent delete radio button and checking the service name
      cy.get('[data-testid="hard-delete-option"]')
        .contains(service.name)
        .should('be.visible')
        .click();

      cy.get('[data-testid="confirmation-text-input"]')
        .should('be.visible')
        .type(DELETE_TERM);
      interceptURL('DELETE', `/api/v1/services/${type}/*`, 'deleteService');
      interceptURL(
        'GET',
        '/api/v1/services/*/name/*?fields=owner',
        'serviceDetails'
      );

      cy.get('[data-testid="confirm-button"]').should('be.visible').click();
      verifyResponseStatusCode('@deleteService', 200);
    });
  });
});
