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
import { interceptURL, verifyResponseStatusCode } from './common';

export const searchServiceFromSettingPage = (service) => {
  interceptURL(
    'GET',
    'api/v1/search/query?q=*&from=0&size=15&index=*',
    'searchService'
  );
  cy.get('[data-testid="searchbar"]').type(service);

  verifyResponseStatusCode('@searchService', 200);
};

export const visitServiceDetailsPage = (service, verifyHeader = true) => {
  // Click on settings page
  interceptURL(
    'GET',
    'api/v1/teams/name/Organization?fields=*',
    'getSettingsPage'
  );
  cy.get('[data-testid="app-bar-item-settings"]').should('be.visible').click();

  verifyResponseStatusCode('@getSettingsPage', 200);
  // Services page
  interceptURL('GET', '/api/v1/services/*', 'getServices');

  cy.get('.ant-menu-title-content').contains(service.type).click();

  cy.wait('@getServices');

  searchServiceFromSettingPage(service.name);

  // click on created service
  cy.get(`[data-testid="service-name-${service.name}"]`).click();

  if (verifyHeader) {
    cy.get(`[data-testid="entity-header-display-name"]`)
      .invoke('text')
      .then((text) => {
        expect(text).to.equal(service.displayName);
      });
  }

  verifyResponseStatusCode('@getServices', 200);
};

export const createDataWithApi = (data, token) => {
  data.map(({ method, url, body }) => {
    cy.request({
      method,
      url,
      auth: {
        bearer: token,
      },
      body,
    });
  });
};
