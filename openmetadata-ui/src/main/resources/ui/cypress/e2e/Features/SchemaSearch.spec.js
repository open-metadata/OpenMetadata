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
// eslint-disable-next-line spaced-comment
/// <reference types="Cypress" />

import { interceptURL, verifyResponseStatusCode } from '../../common/common';
import { searchServiceFromSettingPage } from '../../common/serviceUtils';

const schemaNames = ['sales', 'admin', 'anonymous', 'dip', 'gsmadmin_internal'];
let serviceId;
const serviceName = 'cypress_mysql_schema_test';

describe('Schema search', () => {
  beforeEach(() => {
    cy.login();
  });

  it('Prerequisite', () => {
    const token = localStorage.getItem('oidcIdToken');
    cy.request({
      method: 'POST',
      url: `/api/v1/services/databaseServices`,
      headers: { Authorization: `Bearer ${token}` },
      body: {
        name: serviceName,
        serviceType: 'Mysql',
        connection: {
          config: {
            type: 'Mysql',
            scheme: 'mysql+pymysql',
            username: 'test',
            authType: { password: 'test' },
            hostPort: 'test',
            supportsMetadataExtraction: true,
            supportsDBTExtraction: true,
            supportsProfiler: true,
            supportsQueryComment: true,
          },
        },
      },
    }).then((response) => {
      expect(response.status).to.eq(201);

      const service = response.body.fullyQualifiedName;
      serviceId = response.body.id;

      cy.request({
        method: 'POST',
        url: `/api/v1/databases`,
        headers: { Authorization: `Bearer ${token}` },
        body: {
          name: 'default',
          service,
        },
      }).then((response) => {
        const database = response.body.fullyQualifiedName;
        schemaNames.map((schema) => {
          cy.request({
            method: 'POST',
            url: `/api/v1/databaseSchemas`,
            headers: { Authorization: `Bearer ${token}` },
            body: {
              name: schema,
              database,
            },
          });
        });
      });
    });
  });

  it('Search schema in database page', () => {
    // Click on settings page
    interceptURL(
      'GET',
      'api/v1/teams/name/Organization?fields=*',
      'getSettingsPage'
    );
    cy.get('[data-testid="app-bar-item-settings"]')
      .should('be.visible')
      .click();
    verifyResponseStatusCode('@getSettingsPage', 200);
    // Services page
    interceptURL('GET', '/api/v1/services/*', 'getServices');

    cy.get('.ant-menu-title-content').contains('Databases').click();

    verifyResponseStatusCode('@getServices', 200);

    searchServiceFromSettingPage(serviceName);

    // click on created service
    cy.get(`[data-testid="service-name-${serviceName}"]`).click();

    cy.get(`[data-testid="entity-header-display-name"]`)
      .should('exist')
      .should('be.visible')
      .invoke('text')
      .then((text) => {
        expect(text).to.equal(serviceName);
      });

    verifyResponseStatusCode('@getServices', 200);
    interceptURL(
      'GET',
      `/api/v1/permissions/database/name/${serviceName}.default`,
      'databasePermission'
    );
    interceptURL(
      'GET',
      `/api/v1/databaseSchemas?fields=*&database=${serviceName}.default&include=non-deleted`,
      'databaseSchema'
    );
    interceptURL(
      'GET',
      `/api/v1/search/query?q=*sales*&index=database_schema_search_index*`,
      'searchSchema'
    );

    cy.get('[data-testid="table-container"]').contains('default').click();
    verifyResponseStatusCode('@databasePermission', 200);
    verifyResponseStatusCode('@databaseSchema', 200);

    cy.get('[data-testid="searchbar"]').type(schemaNames[0]);
    verifyResponseStatusCode('@searchSchema', 200);
    cy.get('[data-testid="database-databaseSchemas"]').should(
      'contain',
      schemaNames[0]
    );
  });

  it('Cleanup', () => {
    const token = localStorage.getItem('oidcIdToken');

    cy.request({
      method: 'DELETE',
      url: `/api/v1/services/databaseServices/${serviceId}?hardDelete=true&recursive=true`,
      headers: { Authorization: `Bearer ${token}` },
    }).then((response) => {
      expect(response.status).to.eq(200);
    });
  });
});
