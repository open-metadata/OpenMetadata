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
  interceptURL,
  toastNotification,
  verifyResponseStatusCode,
  visitDatabaseSchemaDetailsPage,
} from '../../common/common';
import { getToken } from '../../common/Utils/LocalStorage';
import { addOwner } from '../../common/Utils/Owner';
import { addTier } from '../../common/Utils/Tier';
import {
  commonTestCleanup,
  databaseSchemaVersionPrerequisites,
} from '../../common/Utils/Versions';
import { DELETE_TERM } from '../../constants/constants';
import {
  DATABASE_DETAILS_FOR_VERSION_TEST,
  DATABASE_SCHEMA_DETAILS_FOR_VERSION_TEST,
  SERVICE_DETAILS_FOR_VERSION_TEST,
  TIER,
} from '../../constants/Version.constants';

const serviceDetails = SERVICE_DETAILS_FOR_VERSION_TEST.Database;

describe(
  `Database schema version page should work properly`,
  { tags: 'DataAssets' },
  () => {
    const data = {
      user: { displayName: '', name: '' },
      domain: { id: '' },
      database: { id: '' },
      schema: { id: '', fullyQualifiedName: '' },
    };

    before(() => {
      cy.login();
      cy.getAllLocalStorage().then((responseData) => {
        const token = getToken(responseData);

        databaseSchemaVersionPrerequisites(token, data);
      });
    });

    after(() => {
      cy.login();
      cy.getAllLocalStorage().then((responseData) => {
        const token = getToken(responseData);

        commonTestCleanup(token, data);
      });
    });

    beforeEach(() => {
      cy.login();
    });

    it(`Database Schema version page should show edited tags and description changes properly`, () => {
      visitDatabaseSchemaDetailsPage({
        settingsMenuId: serviceDetails.settingsMenuId,
        serviceCategory: serviceDetails.serviceCategory,
        serviceName: serviceDetails.serviceName,
        databaseRowKey: data.database.id,
        databaseName: DATABASE_DETAILS_FOR_VERSION_TEST.name,
        databaseSchemaRowKey: data.schema.id,
        databaseSchemaName: DATABASE_SCHEMA_DETAILS_FOR_VERSION_TEST.name,
      });

      interceptURL(
        'GET',
        `/api/v1/databaseSchemas/name/${data.schema.fullyQualifiedName}*`,
        `getDatabaseSchemaDetails`
      );
      interceptURL(
        'GET',
        `/api/v1/databaseSchemas/${data.schema.id}/versions`,
        'getVersionsList'
      );
      interceptURL(
        'GET',
        `/api/v1/databaseSchemas/${data.schema.id}/versions/0.2`,
        'getSelectedVersionDetails'
      );

      cy.get('[data-testid="version-button"]').contains('0.2').click();

      verifyResponseStatusCode(`@getDatabaseSchemaDetails`, 200);
      verifyResponseStatusCode('@getVersionsList', 200);
      verifyResponseStatusCode('@getSelectedVersionDetails', 200);

      cy.get(`[data-testid="domain-link"] [data-testid="diff-added"]`)
        .scrollIntoView()
        .should('be.visible');

      cy.get(
        `[data-testid="asset-description-container"] [data-testid="diff-added"]`
      )
        .scrollIntoView()
        .should('be.visible');

      cy.get(
        `[data-testid="entity-right-panel"] .diff-added [data-testid="tag-PersonalData.SpecialCategory"]`
      )
        .scrollIntoView()
        .should('be.visible');

      cy.get(
        `[data-testid="entity-right-panel"] .diff-added [data-testid="tag-PII.Sensitive"]`
      )
        .scrollIntoView()
        .should('be.visible');
    });

    it(`Database Schema version page should show owner changes properly`, () => {
      visitDatabaseSchemaDetailsPage({
        settingsMenuId: serviceDetails.settingsMenuId,
        serviceCategory: serviceDetails.serviceCategory,
        serviceName: serviceDetails.serviceName,
        databaseRowKey: data.database.id,
        databaseName: DATABASE_DETAILS_FOR_VERSION_TEST.name,
        databaseSchemaRowKey: data.schema.id,
        databaseSchemaName: DATABASE_SCHEMA_DETAILS_FOR_VERSION_TEST.name,
      });

      cy.get('[data-testid="version-button"]').as('versionButton');

      cy.get('@versionButton').contains('0.2');

      addOwner(data.user.displayName);

      interceptURL(
        'GET',
        `/api/v1/databaseSchemas/name/${data.schema.fullyQualifiedName}*`,
        `getDatabaseSchemaDetails`
      );
      interceptURL(
        'GET',
        `/api/v1/databaseSchemas/${data.schema.id}/versions`,
        'getVersionsList'
      );
      interceptURL(
        'GET',
        `/api/v1/databaseSchemas/${data.schema.id}/versions/0.2`,
        'getSelectedVersionDetails'
      );

      cy.get('@versionButton').contains('0.2').click();

      verifyResponseStatusCode(`@getDatabaseSchemaDetails`, 200);
      verifyResponseStatusCode('@getVersionsList', 200);
      verifyResponseStatusCode('@getSelectedVersionDetails', 200);

      cy.get('[data-testid="owner-link"] > [data-testid="diff-added"]')
        .scrollIntoView()
        .should('be.visible');
    });

    it(`Database Schema version page should show tier changes properly`, () => {
      visitDatabaseSchemaDetailsPage({
        settingsMenuId: serviceDetails.settingsMenuId,
        serviceCategory: serviceDetails.serviceCategory,
        serviceName: serviceDetails.serviceName,
        databaseRowKey: data.database.id,
        databaseName: DATABASE_DETAILS_FOR_VERSION_TEST.name,
        databaseSchemaRowKey: data.schema.id,
        databaseSchemaName: DATABASE_SCHEMA_DETAILS_FOR_VERSION_TEST.name,
      });

      cy.get('[data-testid="version-button"]').as('versionButton');

      cy.get('@versionButton').contains('0.2');

      addTier(TIER);

      interceptURL(
        'GET',
        `/api/v1/databaseSchemas/name/${data.schema.fullyQualifiedName}*`,
        `getDatabaseSchemaDetails`
      );
      interceptURL(
        'GET',
        `/api/v1/databaseSchemas/${data.schema.id}/versions`,
        'getVersionsList'
      );
      interceptURL(
        'GET',
        `/api/v1/databaseSchemas/${data.schema.id}/versions/0.2`,
        'getSelectedVersionDetails'
      );

      cy.get('@versionButton').contains('0.2').click();

      verifyResponseStatusCode(`@getDatabaseSchemaDetails`, 200);
      verifyResponseStatusCode('@getVersionsList', 200);
      verifyResponseStatusCode('@getSelectedVersionDetails', 200);

      cy.get('[data-testid="Tier"] > [data-testid="diff-added"]')
        .scrollIntoView()
        .should('be.visible');
    });

    it(`Database  Schema version page should show version details after soft deleted`, () => {
      visitDatabaseSchemaDetailsPage({
        settingsMenuId: serviceDetails.settingsMenuId,
        serviceCategory: serviceDetails.serviceCategory,
        serviceName: serviceDetails.serviceName,
        databaseRowKey: data.database.id,
        databaseName: DATABASE_DETAILS_FOR_VERSION_TEST.name,
        databaseSchemaRowKey: data.schema.id,
        databaseSchemaName: DATABASE_SCHEMA_DETAILS_FOR_VERSION_TEST.name,
      });

      // Clicking on permanent delete radio button and checking the service name
      cy.get('[data-testid="manage-button"]').click();

      cy.get('[data-menu-id*="delete-button"]').should('be.visible');
      cy.get('[data-testid="delete-button-title"]').click();

      // Clicking on permanent delete radio button and checking the service name
      cy.get('[data-testid="soft-delete-option"]')
        .contains(DATABASE_SCHEMA_DETAILS_FOR_VERSION_TEST.name)
        .click();

      cy.get('[data-testid="confirmation-text-input"]').type(DELETE_TERM);
      interceptURL('DELETE', `/api/v1/databaseSchemas/*`, 'deleteSchema');

      cy.get('[data-testid="confirm-button"]').should('be.visible').click();

      verifyResponseStatusCode('@deleteSchema', 200);

      // Closing the toast notification
      toastNotification(
        `"${DATABASE_SCHEMA_DETAILS_FOR_VERSION_TEST.name}" deleted successfully!`
      );

      interceptURL(
        'GET',
        `/api/v1/databaseSchemas/name/${data.schema.fullyQualifiedName}*`,
        `getDatabaseSchemaDetails`
      );
      interceptURL(
        'GET',
        `/api/v1/databaseSchemas/${data.schema.id}/versions`,
        'getVersionsList'
      );
      interceptURL(
        'GET',
        `/api/v1/databaseSchemas/${data.schema.id}/versions/0.3`,
        'getSelectedVersionDetails'
      );

      cy.get('[data-testid="version-button"]').as('versionButton');

      cy.get('@versionButton').contains('0.3').click();

      verifyResponseStatusCode(`@getDatabaseSchemaDetails`, 200);
      verifyResponseStatusCode('@getVersionsList', 200);
      verifyResponseStatusCode('@getSelectedVersionDetails', 200);

      // Deleted badge should be visible
      cy.get('[data-testid="deleted-badge"]')
        .scrollIntoView()
        .should('be.visible');

      cy.get('@versionButton').click();

      cy.get('[data-testid="manage-button"]')
        .should('exist')
        .should('be.visible')
        .click();

      cy.get('[data-testid="restore-button-title"]').click();

      interceptURL('PUT', `/api/v1/databaseSchemas/restore`, 'restoreSchema');

      cy.get('.ant-modal-footer .ant-btn-primary').contains('Restore').click();

      verifyResponseStatusCode('@restoreSchema', 200);

      toastNotification(`Database Schema restored successfully`);

      cy.get('@versionButton').should('contain', '0.4');
    });
  }
);
