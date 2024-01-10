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
/// <reference types="cypress" />

import {
  addAnnouncement,
  addTableFieldTags,
  deleteEntity,
  interceptURL,
  login,
  removeTableFieldTags,
  updateTableFieldDescription,
  verifyResponseStatusCode,
  visitEntityDetailsPage,
} from '../../common/common';
import { BASE_URL, uuid } from '../../constants/constants';
import {
  SEARCH_INDEX_DETAILS_FOR_ANNOUNCEMENT,
  SEARCH_INDEX_DETAILS_FOR_DETAILS_PAGE_TEST,
  SEARCH_INDEX_DISPLAY_NAME,
  TAG_1,
  UPDATE_FIELD_DESCRIPTION,
  USER_CREDENTIALS,
  USER_NAME,
} from '../../constants/SearchIndexDetails.constants';

const policy = {
  name: `cy-data-steward-policy-${uuid()}`,
  rules: [
    {
      name: 'DataStewardPolicy-EditRule',
      resources: ['All'],
      operations: [
        'EditDescription',
        'EditDisplayName',
        'EditOwner',
        'EditLineage',
        'EditTags',
        'ViewAll',
      ],
      effect: 'allow',
    },
  ],
};
let policyId = '';

const role = {
  name: `cy-data-steward-role-${uuid()}`,
  policies: [policy.name],
};
let roleId = '';

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

describe('Prerequisite for search index details page test', () => {
  before(() => {
    cy.login();
  });

  it('Prerequisites', () => {
    const token = localStorage.getItem('oidcIdToken');

    // Create search index entity
    cy.request({
      method: 'PUT',
      url: `/api/v1/searchIndexes`,
      headers: { Authorization: `Bearer ${token}` },
      body: SEARCH_INDEX_DETAILS_FOR_DETAILS_PAGE_TEST,
    }).then((response) => {
      expect(response.status).to.eq(201);

      SEARCH_INDEX_DETAILS_FOR_DETAILS_PAGE_TEST.id = response.body.id;
      SEARCH_INDEX_DETAILS_FOR_DETAILS_PAGE_TEST.fullyQualifiedName =
        response.body.fullyQualifiedName;
    });

    // Create Data Steward Policy
    cy.request({
      method: 'POST',
      url: `/api/v1/policies`,
      headers: { Authorization: `Bearer ${token}` },
      body: policy,
    }).then((response) => {
      policyId = response.body.id;

      expect(response.status).to.eq(201);

      cy.request({
        method: 'POST',
        url: `/api/v1/roles`,
        headers: { Authorization: `Bearer ${token}` },
        body: role,
      }).then((response) => {
        roleId = response.body.id;

        expect(response.status).to.eq(201);
      });
    });

    // Create a new user
    cy.request({
      method: 'POST',
      url: `/api/v1/users/signup`,
      headers: { Authorization: `Bearer ${token}` },
      body: USER_CREDENTIALS,
    }).then((response) => {
      expect(response.status).to.eq(201);

      USER_CREDENTIALS.id = response.body.id;
    });
  });
});

describe('SearchIndexDetails page should work properly for data consumer role', () => {
  beforeEach(() => {
    // Login with the created user
    login(USER_CREDENTIALS.email, USER_CREDENTIALS.password);
    cy.goToHomePage(true);
    cy.url().should('eq', `${BASE_URL}/my-data`);
  });

  it('All permissible actions on search index details page should work properly', () => {
    visitEntityDetailsPage({
      term: SEARCH_INDEX_DETAILS_FOR_DETAILS_PAGE_TEST.name,
      serviceName: SEARCH_INDEX_DETAILS_FOR_DETAILS_PAGE_TEST.service,
      entity: 'searchIndexes',
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
  });
});

describe('Prerequisite for data steward role tests', () => {
  it('Add data steward role to the user', () => {
    cy.login();

    // Assign data steward role to the created user
    cy.get('[data-testid="app-bar-item-settings"]').click();

    interceptURL('GET', `/api/v1/users?*`, 'getUsersList');

    cy.get('[data-testid="settings-left-panel"]').contains('Users').click();

    verifyResponseStatusCode('@getUsersList', 200);

    cy.get('[data-testid="searchbar"]').type(
      `${USER_CREDENTIALS.firstName}${USER_CREDENTIALS.lastName}`
    );

    interceptURL('GET', `/api/v1/users/name/${USER_NAME}*`, 'getUserDetails');

    cy.get(
      `[data-row-key="${USER_CREDENTIALS.id}"] [data-testid="${USER_NAME}"]`
    ).click();

    verifyResponseStatusCode('@getUserDetails', 200);

    cy.get('[data-testid="user-profile"] .ant-collapse-arrow').click();

    cy.get('[data-testid="edit-roles-button"]').click();

    cy.get('[data-testid="inline-edit-container"] #select-role')
      .click()
      .type(role.name);

    cy.get(`[title=${role.name}]`).click();

    cy.clickOutside();

    interceptURL('PATCH', `/api/v1/users/${USER_CREDENTIALS.id}`, 'updateRole');

    cy.get('[data-testid="inline-save-btn"]').click();

    verifyResponseStatusCode('@updateRole', 200);
  });
});

describe('SearchIndexDetails page should work properly for data steward role', () => {
  beforeEach(() => {
    // Login with the created user
    login(USER_CREDENTIALS.email, USER_CREDENTIALS.password);
    cy.goToHomePage(true);
    cy.url().should('eq', `${BASE_URL}/my-data`);
  });

  it('All permissible actions on search index details page should work properly', () => {
    visitEntityDetailsPage({
      term: SEARCH_INDEX_DETAILS_FOR_DETAILS_PAGE_TEST.name,
      serviceName: SEARCH_INDEX_DETAILS_FOR_DETAILS_PAGE_TEST.service,
      entity: 'searchIndexes',
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

    interceptURL(
      'PATCH',
      `/api/v1/searchIndexes/${SEARCH_INDEX_DETAILS_FOR_DETAILS_PAGE_TEST.id}`,
      'updateDisplayName'
    );

    cy.get('[data-testid="save-button"]').click();

    verifyResponseStatusCode('@updateDisplayName', 200);

    cy.get('[data-testid="entity-header-display-name"]').contains(
      SEARCH_INDEX_DISPLAY_NAME
    );

    performCommonOperations();
  });
});

describe('SearchIndexDetails page should work properly for admin role', () => {
  beforeEach(() => {
    cy.login();
  });

  it('All permissible actions on search index details page should work properly', () => {
    // Add announcement workflow should work properly
    addAnnouncement(SEARCH_INDEX_DETAILS_FOR_ANNOUNCEMENT);

    // Rename search index flow should work properly
    cy.get('[data-testid="manage-button"]').click();

    cy.get('[data-testid="rename-button"]').click({ waitForAnimations: true });

    cy.get('#displayName').clear().type(SEARCH_INDEX_DISPLAY_NAME);

    interceptURL(
      'PATCH',
      `/api/v1/searchIndexes/${SEARCH_INDEX_DETAILS_FOR_DETAILS_PAGE_TEST.id}`,
      'updateDisplayName'
    );

    cy.get('[data-testid="save-button"]').click();

    verifyResponseStatusCode('@updateDisplayName', 200);

    cy.get('[data-testid="entity-header-display-name"]').contains(
      SEARCH_INDEX_DISPLAY_NAME
    );

    performCommonOperations();
  });

  it('Soft delete workflow should work properly', () => {
    deleteEntity(
      SEARCH_INDEX_DETAILS_FOR_DETAILS_PAGE_TEST.name,
      SEARCH_INDEX_DETAILS_FOR_DETAILS_PAGE_TEST.service,
      'searchIndexes',
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
    deleteEntity(
      SEARCH_INDEX_DETAILS_FOR_DETAILS_PAGE_TEST.name,
      SEARCH_INDEX_DETAILS_FOR_DETAILS_PAGE_TEST.service,
      'searchIndexes',
      'Search Index'
    );
  });
});

describe('Cleanup', () => {
  before(() => {
    Cypress.session.clearAllSavedSessions();
    cy.login();
  });

  it('Delete user, role and policy', () => {
    const token = localStorage.getItem('oidcIdToken');

    // Delete created user
    cy.request({
      method: 'DELETE',
      url: `/api/v1/users/${USER_CREDENTIALS.id}?hardDelete=true&recursive=false`,
      headers: { Authorization: `Bearer ${token}` },
    }).then((response) => {
      expect(response.status).to.eq(200);
    });

    // Delete policy
    cy.request({
      method: 'DELETE',
      url: `/api/v1/policies/${policyId}?hardDelete=true&recursive=false`,
      headers: { Authorization: `Bearer ${token}` },
    }).then((response) => {
      expect(response.status).to.eq(200);
    });

    // Delete role
    cy.request({
      method: 'DELETE',
      url: `/api/v1/roles/${roleId}?hardDelete=true&recursive=false`,
      headers: { Authorization: `Bearer ${token}` },
    }).then((response) => {
      expect(response.status).to.eq(200);
    });
  });
});
