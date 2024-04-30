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
  visitDataModelPage,
} from '../../common/common';
import { hardDeleteService } from '../../common/EntityUtils';
import { getToken } from '../../common/Utils/LocalStorage';
import { addOwner } from '../../common/Utils/Owner';
import { addTier } from '../../common/Utils/Tier';
import { visitDataModelVersionPage } from '../../common/VersionUtils';
import { DELETE_TERM } from '../../constants/constants';
import { DASHBOARD_SERVICE_DETAILS } from '../../constants/EntityConstant';
import { SERVICE_CATEGORIES } from '../../constants/service.constants';
import {
  DATA_MODEL_DETAILS,
  DATA_MODEL_DETAILS_FOR_VERSION_TEST,
  DATA_MODEL_PATCH_PAYLOAD,
  OWNER_DETAILS,
  TIER,
} from '../../constants/Version.constants';

describe(
  'Data model version page should work properly',
  { tags: 'DataAssets' },
  () => {
    const data = {
      user: { id: '', displayName: '' },
      dataModel: { id: '', fullyQualifiedName: '', name: '' },
    };

    before(() => {
      cy.login();
      cy.getAllLocalStorage().then((responseData) => {
        const token = getToken(responseData);
        cy.request({
          method: 'POST',
          url: `/api/v1/services/dashboardServices`,
          headers: { Authorization: `Bearer ${token}` },
          body: DASHBOARD_SERVICE_DETAILS,
        }).then((response) => {
          cy.request({
            method: 'PUT',
            url: `/api/v1/dashboard/datamodels`,
            headers: { Authorization: `Bearer ${token}` },
            body: DATA_MODEL_DETAILS_FOR_VERSION_TEST,
          }).then((response) => {
            data.dataModel = response.body;

            cy.request({
              method: 'PATCH',
              url: `/api/v1/dashboard/datamodels/${data.dataModel.id}`,
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json-patch+json',
              },
              body: DATA_MODEL_PATCH_PAYLOAD,
            });
          });
        });

        // Create user
        cy.request({
          method: 'POST',
          url: `/api/v1/users/signup`,
          headers: { Authorization: `Bearer ${token}` },
          body: OWNER_DETAILS,
        }).then((response) => {
          data.user = response.body;
        });
      });
    });

    after(() => {
      cy.login();
      cy.getAllLocalStorage().then((responseData) => {
        const token = getToken(responseData);

        // Delete created user
        cy.request({
          method: 'DELETE',
          url: `/api/v1/users/${data.user.id}?hardDelete=true&recursive=false`,
          headers: { Authorization: `Bearer ${token}` },
        });

        hardDeleteService({
          token,
          serviceFqn: DASHBOARD_SERVICE_DETAILS.name,
          serviceType: SERVICE_CATEGORIES.DASHBOARD_SERVICES,
        });
      });
    });

    beforeEach(() => {
      cy.login();
    });

    it('Data model version page should show description and tag changes properly', () => {
      visitDataModelVersionPage(
        data.dataModel.fullyQualifiedName,
        data.dataModel.id,
        data.dataModel.name,
        DASHBOARD_SERVICE_DETAILS.name,
        '0.2'
      );

      cy.get(
        `[data-testid="asset-description-container"] [data-testid="diff-added"]`
      ).should('be.visible');

      cy.get(
        `[data-testid="entity-right-panel"] .diff-added [data-testid="tag-PersonalData.SpecialCategory"]`
      )
        .scrollIntoView()
        .should('be.visible');

      cy.get(
        `[data-row-key="${DATA_MODEL_DETAILS.updatedTagEntityChildName}"] .diff-added [data-testid="tag-PersonalData.Personal"]`
      )
        .scrollIntoView()
        .should('be.visible');

      cy.get(
        `[data-row-key="${DATA_MODEL_DETAILS.updatedTagEntityChildName}"] .diff-added [data-testid="tag-PII.Sensitive"]`
      )
        .scrollIntoView()
        .should('be.visible');

      cy.get(`[data-row-key="column_2"] [data-testid="diff-removed"]`)
        .scrollIntoView()
        .should('be.visible');

      cy.get(`[data-row-key="column_3"] [data-testid="diff-added"]`)
        .scrollIntoView()
        .should('be.visible');
    });

    it(`Data model version page should show owner changes properly`, () => {
      visitDataModelPage(
        data.dataModel.fullyQualifiedName,
        data.dataModel.name,
        DASHBOARD_SERVICE_DETAILS.name
      );

      cy.get('[data-testid="version-button"]').as('versionButton');

      cy.get('@versionButton').contains('0.2');

      addOwner(data.user.displayName);

      interceptURL(
        'GET',
        `/api/v1/dashboard/datamodels/name/${data.dataModel.fullyQualifiedName}*`,
        `getDataModelDetails`
      );
      interceptURL(
        'GET',
        `/api/v1/dashboard/datamodels/${data.dataModel.id}/versions`,
        'getVersionsList'
      );
      interceptURL(
        'GET',
        `/api/v1/dashboard/datamodels/${data.dataModel.id}/versions/0.2`,
        'getSelectedVersionDetails'
      );

      cy.get('@versionButton').contains('0.2').click();

      verifyResponseStatusCode(`@getDataModelDetails`, 200);
      verifyResponseStatusCode('@getVersionsList', 200);
      verifyResponseStatusCode('@getSelectedVersionDetails', 200);

      cy.get('[data-testid="owner-link"] > [data-testid="diff-added"]')
        .scrollIntoView()
        .should('be.visible');
    });

    it(`Data model version page should show tier changes properly`, () => {
      visitDataModelPage(
        data.dataModel.fullyQualifiedName,
        data.dataModel.name,
        DASHBOARD_SERVICE_DETAILS.name
      );

      cy.get('[data-testid="version-button"]').as('versionButton');

      cy.get('@versionButton').contains('0.2');

      addTier(TIER);

      interceptURL(
        'GET',
        `/api/v1/dashboard/datamodels/name/${data.dataModel.fullyQualifiedName}*`,
        `getDataModelDetails`
      );
      interceptURL(
        'GET',
        `/api/v1/dashboard/datamodels/${data.dataModel.id}/versions`,
        'getVersionsList'
      );
      interceptURL(
        'GET',
        `/api/v1/dashboard/datamodels/${data.dataModel.id}/versions/0.2`,
        'getSelectedVersionDetails'
      );

      cy.get('@versionButton').contains('0.2').click();

      verifyResponseStatusCode(`@getDataModelDetails`, 200);
      verifyResponseStatusCode('@getVersionsList', 200);
      verifyResponseStatusCode('@getSelectedVersionDetails', 200);

      cy.get('[data-testid="Tier"] > [data-testid="diff-added"]')
        .scrollIntoView()
        .should('be.visible');
    });

    it('Data model version page should show version details after soft deleted', () => {
      visitDataModelPage(
        data.dataModel.fullyQualifiedName,
        data.dataModel.name,
        DASHBOARD_SERVICE_DETAILS.name
      );

      cy.get('[data-testid="manage-button"]').click();

      cy.get('[data-menu-id*="delete-button"]').should('be.visible');
      cy.get('[data-testid="delete-button-title"]').click();

      // Clicking on permanent delete radio button and checking the service name
      cy.get('[data-testid="soft-delete-option"]')
        .contains(DATA_MODEL_DETAILS.name)
        .click();

      cy.get('[data-testid="confirmation-text-input"]').type(DELETE_TERM);

      interceptURL(
        'DELETE',
        `/api/v1/dashboard/datamodels/*`,
        'deleteDataModel'
      );

      cy.get('[data-testid="confirm-button"]').should('be.visible').click();

      verifyResponseStatusCode('@deleteDataModel', 200);

      // Closing the toast notification
      toastNotification(`"${DATA_MODEL_DETAILS.name}" deleted successfully!`);

      interceptURL(
        'GET',
        `/api/v1/dashboard/datamodels/name/${data.dataModel.fullyQualifiedName}*`,
        `getDataModelDetails`
      );
      interceptURL(
        'GET',
        `/api/v1/dashboard/datamodels/${data.dataModel.id}/versions`,
        'getVersionsList'
      );
      interceptURL(
        'GET',
        `/api/v1/dashboard/datamodels/${data.dataModel.id}/versions/0.3`,
        'getSelectedVersionDetails'
      );

      cy.get('[data-testid="version-button"]').as('versionButton');

      cy.get('@versionButton').contains('0.3').click();

      verifyResponseStatusCode(`@getDataModelDetails`, 200);
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

      interceptURL(
        'PUT',
        `/api/v1/dashboard/datamodels/restore`,
        'restoreDataModel'
      );

      cy.get('.ant-modal-footer .ant-btn-primary').contains('Restore').click();

      verifyResponseStatusCode('@restoreDataModel', 200);

      toastNotification(`Data Model restored successfully`);

      cy.get('@versionButton').should('contain', '0.4');
    });
  }
);
