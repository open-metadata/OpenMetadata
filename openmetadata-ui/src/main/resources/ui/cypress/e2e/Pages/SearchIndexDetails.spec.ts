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
  addTableFieldTags,
  deleteEntity,
  interceptURL,
  removeTableFieldTags,
  updateTableFieldDescription,
  verifyResponseStatusCode,
} from '../../common/common';
import {
  createSingleLevelEntity,
  hardDeleteService,
} from '../../common/EntityUtils';
import { visitEntityDetailsPage } from '../../common/Utils/Entity';
import { getToken } from '../../common/Utils/LocalStorage';
import { BASE_URL } from '../../constants/constants';
import { EntityType } from '../../constants/Entity.interface';
import {
  POLICY_DETAILS,
  ROLE_DETAILS,
  SEARCH_INDEX_DETAILS_FOR_DETAILS_PAGE_TEST,
  SEARCH_INDEX_DISPLAY_NAME,
  SEARCH_SERVICE_DETAILS,
  TAG_1,
  UPDATE_FIELD_DESCRIPTION,
  USER_CREDENTIALS,
} from '../../constants/SearchIndexDetails.constants';

const performCommonOperations = () => {
  // User should be able to edit search index field tags
  addTableFieldTags(
    SEARCH_INDEX_DETAILS_FOR_DETAILS_PAGE_TEST.fields[0].fullyQualifiedName,
    TAG_1.classification,
    TAG_1.tag,
    'searchIndexes'
  );
  removeTableFieldTags(
    SEARCH_INDEX_DETAILS_FOR_DETAILS_PAGE_TEST.fields[0].fullyQualifiedName,
    TAG_1.classification,
    TAG_1.tag,
    'searchIndexes'
  );

  // User should be able to edit search index field description
  updateTableFieldDescription(
    SEARCH_INDEX_DETAILS_FOR_DETAILS_PAGE_TEST.fields[0].fullyQualifiedName,
    UPDATE_FIELD_DESCRIPTION,
    'searchIndexes'
  );

  cy.get(
    `[data-row-key="${SEARCH_INDEX_DETAILS_FOR_DETAILS_PAGE_TEST.fields[0].fullyQualifiedName}"] [data-testid="description"]`
  ).contains(UPDATE_FIELD_DESCRIPTION);

  updateTableFieldDescription(
    SEARCH_INDEX_DETAILS_FOR_DETAILS_PAGE_TEST.fields[0].fullyQualifiedName,
    ' ',
    'searchIndexes'
  );

  cy.get(
    `[data-row-key="${SEARCH_INDEX_DETAILS_FOR_DETAILS_PAGE_TEST.fields[0].fullyQualifiedName}"] [data-testid="description"]`
  ).contains('No Description');
};

describe(
  'SearchIndexDetails page should work properly for data consumer role',
  { tags: 'DataAssets' },
  () => {
    const data = { user: { id: '' } };

    before(() => {
      cy.login();
      cy.getAllLocalStorage().then((storageData) => {
        const token = getToken(storageData);

        // Create search index entity
        createSingleLevelEntity({
          token,
          ...SEARCH_SERVICE_DETAILS,
        });

        // Create a new user
        cy.request({
          method: 'POST',
          url: `/api/v1/users/signup`,
          headers: { Authorization: `Bearer ${token}` },
          body: USER_CREDENTIALS,
        }).then((response) => {
          data.user = response.body;
        });

        cy.logout();
      });
    });

    after(() => {
      cy.login();

      cy.getAllLocalStorage().then((storageData) => {
        const token = getToken(storageData);

        // Delete search index
        hardDeleteService({
          token,
          serviceFqn: SEARCH_SERVICE_DETAILS.service.name,
          serviceType: SEARCH_SERVICE_DETAILS.serviceType,
        });

        // Delete created user
        cy.request({
          method: 'DELETE',
          url: `/api/v1/users/${data.user.id}?hardDelete=true&recursive=false`,
          headers: { Authorization: `Bearer ${token}` },
        });
      });
    });

    beforeEach(() => {
      // Login with the created user
      cy.login(USER_CREDENTIALS.email, USER_CREDENTIALS.password);

      cy.url().should('eq', `${BASE_URL}/my-data`);
    });

    it('All permissible actions on search index details page should work properly', () => {
      visitEntityDetailsPage({
        term: SEARCH_INDEX_DETAILS_FOR_DETAILS_PAGE_TEST.name,
        serviceName: SEARCH_INDEX_DETAILS_FOR_DETAILS_PAGE_TEST.service,
        entity: EntityType.SearchIndex,
      });

      // Edit domain option should not be available
      cy.get(
        `[data-testid="entity-page-header"] [data-testid="add-domain"]`
      ).should('not.exist');

      // Manage button should not be visible on service page
      cy.get(
        '[data-testid="asset-header-btn-group"] [data-testid="manage-button"]'
      ).should('not.exist');

      performCommonOperations();

      cy.logout();
    });
  }
);

describe('SearchIndexDetails page should work properly for data steward role', () => {
  const data = {
    user: { id: '' },
    policy: { id: '' },
    role: { id: '', name: '' },
  };

  before(() => {
    cy.login();
    cy.getAllLocalStorage().then((storageData) => {
      const token = getToken(storageData);

      // Create search index entity
      createSingleLevelEntity({
        token,
        ...SEARCH_SERVICE_DETAILS,
      });

      // Create Data Steward Policy
      cy.request({
        method: 'POST',
        url: `/api/v1/policies`,
        headers: { Authorization: `Bearer ${token}` },
        body: POLICY_DETAILS,
      }).then((policyResponse) => {
        data.policy = policyResponse.body;

        // Create Data Steward Role
        cy.request({
          method: 'POST',
          url: `/api/v1/roles`,
          headers: { Authorization: `Bearer ${token}` },
          body: ROLE_DETAILS,
        }).then((roleResponse) => {
          data.role = roleResponse.body;

          // Create a new user
          cy.request({
            method: 'POST',
            url: `/api/v1/users/signup`,
            headers: { Authorization: `Bearer ${token}` },
            body: USER_CREDENTIALS,
          }).then((userResponse) => {
            data.user = userResponse.body;

            // Assign data steward role to the user
            cy.request({
              method: 'PATCH',
              url: `/api/v1/users/${data.user.id}`,
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json-patch+json',
              },
              body: [
                {
                  op: 'add',
                  path: '/roles/0',
                  value: {
                    id: data.role.id,
                    type: 'role',
                    name: data.role.name,
                  },
                },
              ],
            });
          });
        });
      });

      cy.logout();
    });
  });

  after(() => {
    cy.login();

    cy.getAllLocalStorage().then((storageData) => {
      const token = getToken(storageData);

      // Delete created user
      cy.request({
        method: 'DELETE',
        url: `/api/v1/users/${data.user.id}?hardDelete=true&recursive=false`,
        headers: { Authorization: `Bearer ${token}` },
      });

      // Delete policy
      cy.request({
        method: 'DELETE',
        url: `/api/v1/policies/${data.policy.id}?hardDelete=true&recursive=false`,
        headers: { Authorization: `Bearer ${token}` },
      });

      // Delete role
      cy.request({
        method: 'DELETE',
        url: `/api/v1/roles/${data.role.id}?hardDelete=true&recursive=false`,
        headers: { Authorization: `Bearer ${token}` },
      });

      // Delete search index
      hardDeleteService({
        token,
        serviceFqn: SEARCH_SERVICE_DETAILS.service.name,
        serviceType: SEARCH_SERVICE_DETAILS.serviceType,
      });
    });
  });

  beforeEach(() => {
    // Login with the created user
    cy.login(USER_CREDENTIALS.email, USER_CREDENTIALS.password);

    cy.url().should('eq', `${BASE_URL}/my-data`);
  });

  it('All permissible actions on search index details page should work properly', () => {
    visitEntityDetailsPage({
      term: SEARCH_INDEX_DETAILS_FOR_DETAILS_PAGE_TEST.name,
      serviceName: SEARCH_INDEX_DETAILS_FOR_DETAILS_PAGE_TEST.service,
      entity: EntityType.SearchIndex,
    });

    // Edit domain option should not be available
    cy.get(`[data-testid="entity-page-header"]`).then(($body) => {
      const editDomain = $body.find(`[data-testid="add-domain"]`);

      expect(editDomain.length).to.equal(0);
    });

    // Manage button should be visible on service page
    cy.get('[data-testid="manage-button"]').click();

    // Announcement and Delete options should not be visible
    cy.get('.manage-dropdown-list-container').then(($body) => {
      const announcementButton = $body.find(
        `[data-testid="announcement-button"]`
      );
      const deleteButton = $body.find(`[data-testid="delete-button"]`);

      expect(announcementButton.length).to.equal(0);
      expect(deleteButton.length).to.equal(0);
    });

    // Rename search index flow should work properly
    cy.get('[data-testid="rename-button"]').click({ waitForAnimations: true });

    cy.get('#displayName').clear().type(SEARCH_INDEX_DISPLAY_NAME);

    interceptURL('PATCH', `/api/v1/searchIndexes/*`, 'updateDisplayName');

    cy.get('[data-testid="save-button"]').click();

    verifyResponseStatusCode('@updateDisplayName', 200);

    cy.get('[data-testid="entity-header-display-name"]').contains(
      SEARCH_INDEX_DISPLAY_NAME
    );

    performCommonOperations();
  });
});

describe('SearchIndexDetails page should work properly for admin role', () => {
  before(() => {
    cy.login();
    cy.getAllLocalStorage().then((storageData) => {
      const token = getToken(storageData);

      // Create search index entity
      createSingleLevelEntity({
        token,
        ...SEARCH_SERVICE_DETAILS,
      });
    });
  });

  after(() => {
    cy.login();

    cy.getAllLocalStorage().then((storageData) => {
      const token = getToken(storageData);

      // Delete search index
      hardDeleteService({
        token,
        serviceFqn: SEARCH_SERVICE_DETAILS.service.name,
        serviceType: SEARCH_SERVICE_DETAILS.serviceType,
      });
    });
  });

  beforeEach(() => {
    cy.login();
  });

  it('All permissible actions on search index details page should work properly', () => {
    visitEntityDetailsPage({
      term: SEARCH_INDEX_DETAILS_FOR_DETAILS_PAGE_TEST.name,
      serviceName: SEARCH_INDEX_DETAILS_FOR_DETAILS_PAGE_TEST.service,
      entity: EntityType.SearchIndex,
    });
    performCommonOperations();
  });

  it('Soft delete workflow should work properly', () => {
    visitEntityDetailsPage({
      term: SEARCH_INDEX_DETAILS_FOR_DETAILS_PAGE_TEST.name,
      serviceName: SEARCH_INDEX_DETAILS_FOR_DETAILS_PAGE_TEST.service,
      entity: EntityType.SearchIndex,
    });
    deleteEntity(
      SEARCH_INDEX_DETAILS_FOR_DETAILS_PAGE_TEST.name,
      SEARCH_INDEX_DETAILS_FOR_DETAILS_PAGE_TEST.service,
      EntityType.SearchIndex,
      'Search Index',
      'soft'
    );

    cy.get('[data-testid="deleted-badge"]').should('be.visible');

    // Edit options for domain owner and tier should not be visible
    cy.get('[data-testid="add-domain"]').should('not.exist');
    cy.get('[data-testid="edit-owner"]').should('not.exist');
    cy.get('[data-testid="edit-tier"]').should('not.exist');

    // Edit description button should not be visible
    cy.get('[data-testid="edit-description"]').should('not.exist');

    // Edit tags button should not be visible
    cy.get(
      `[data-testid="entity-right-panel"] [data-testid="tags-container"] [data-testid="add-tag"]`
    ).should('not.exist');

    // Edit description and tags button for fields should not be visible
    cy.get(
      `[data-row-key="${SEARCH_INDEX_DETAILS_FOR_DETAILS_PAGE_TEST.fields[0].fullyQualifiedName}"]`
    ).then(($body) => {
      const addTag = $body.find(
        `[data-testid="tags-container"] [data-testid="add-tag"]`
      );
      const editDescription = $body.find(
        `[data-testid="description"] [data-testid="edit-button"]`
      );

      expect(addTag.length).to.equal(0);
      expect(editDescription.length).to.equal(0);

      // Restore search index flow should work properly
      cy.get('[data-testid="manage-button"]').click();

      cy.get('[data-testid="restore-button"]').click();

      interceptURL(
        'PUT',
        `/api/v1/searchIndexes/restore`,
        'restoreSearchIndex'
      );

      cy.get('[data-testid="restore-asset-modal"] .ant-btn-primary')
        .contains('Restore')
        .click();

      verifyResponseStatusCode('@restoreSearchIndex', 200);
    });
  });

  it('Hard delete workflow should work properly', () => {
    visitEntityDetailsPage({
      term: SEARCH_INDEX_DETAILS_FOR_DETAILS_PAGE_TEST.name,
      serviceName: SEARCH_INDEX_DETAILS_FOR_DETAILS_PAGE_TEST.service,
      entity: EntityType.SearchIndex,
    });
    deleteEntity(
      SEARCH_INDEX_DETAILS_FOR_DETAILS_PAGE_TEST.name,
      SEARCH_INDEX_DETAILS_FOR_DETAILS_PAGE_TEST.service,
      EntityType.SearchIndex,
      'Search Index'
    );
  });
});
