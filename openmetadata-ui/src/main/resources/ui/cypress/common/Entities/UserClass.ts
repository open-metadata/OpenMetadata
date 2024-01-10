/*
 *  Copyright 2022 Collate.
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
  descriptionBox,
  interceptURL,
  uuid,
  verifyResponseStatusCode,
} from '../../common/common';
import { VISIT_SERVICE_PAGE_DETAILS } from '../../constants/service.constants';
import { addOwner, removeOwner } from '../Utils/Owner';
import {
  addUser,
  deleteSoftDeletedUser,
  restoreUser,
  softDeleteUser,
} from '../Utils/Users';

const editedUserName = `Edited${uuid()}`;
const teamName = `Applications`;
const updatedDescription = 'This is updated description';
const userName = `Usercttest${uuid()}`;
const userEmail = `${userName}@gmail.com`;
const stewardRole = `Data Steward`;
const consumerRole = `Data Consumer`;
const stewardRoleClass = `DataSteward`;

const stewardUserName = `StewardUsercttest${uuid()}`;
const stewardEmail = `${stewardUserName}@gmail.com`;
const stewardPassword = `Steward@${uuid()}`;
const stewardDescription = 'Adding Steward user';
const consumerDescription = 'Adding Consumer user';

const consumerName = `ConsumerUsercttest${uuid()}`;
const consumerEmail = `${consumerName}@gmail.com`;
const consumerPassword = `Consumer@${uuid()}`;

class UsersTestClass {
  protected name: string;

  createUser() {
    cy.get('[data-testid="add-user"]').click();
    addUser(userName, userEmail);
    verifyResponseStatusCode('@getUsers', 200);
  }
  public getName() {
    return this.name;
  }

  visitUser() {
    cy.get('[data-testid="app-bar-item-settings"]')
      .should('exist')
      .should('be.visible')
      .click();
    interceptURL('GET', '/api/v1/users?*', 'getUsers');
    cy.get('[data-testid="settings-left-panel"]').contains('Users').click();
  }

  visitConsumerUser() {
    cy.get('#email').should('be.visible').type(consumerEmail);
    cy.get('#password').should('be.visible').type(consumerPassword);
    interceptURL('POST', '/api/v1/users/login', 'login');
    cy.get('[data-testid="login"]').contains('Login').click();
    verifyResponseStatusCode('@login', 200);
  }

  visitStewardUser() {
    cy.get('#email').should('be.visible').type(stewardEmail);
    cy.get('#password').should('be.visible').type(stewardPassword);
    interceptURL('POST', '/api/v1/users/login', 'login');
    cy.get('[data-testid="login"]').contains('Login').click();
    verifyResponseStatusCode('@login', 200);
  }
  softDeleteUser() {
    softDeleteUser(userName);
  }

  restoreSoftDeletedUser() {
    restoreUser(userName, editedUserName);
  }

  permanentlyDeleteSoftDeletedUser() {
    deleteSoftDeletedUser(userName);
    cy.logout();
    Cypress.session.clearAllSavedSessions();
  }

  editDisplayName() {
    interceptURL('GET', '/api/v1/users?*', 'getUsers');
    verifyResponseStatusCode('@getUsers', 200);
    cy.get('[data-testid="searchbar"]')
      .should('exist')
      .should('be.visible')
      .type(userName);
    cy.get(`[data-testid="${userName}"]`).click();
    cy.get('[data-testid="edit-displayName"]').should('be.visible');
    cy.get('[data-testid="edit-displayName"]').click();
    cy.get('[data-testid="displayName"]').clear();
    cy.get('[data-testid="displayName"]').type(editedUserName);
    cy.get('[data-testid="inline-save-btn"]').click();
    cy.get('[data-testid="edit-displayName"]').scrollIntoView();
    cy.get('[data-testid="user-name"]')
      .should('contain', editedUserName)
      .scrollTo('top', {
        ensureScrollable: false,
      });
  }

  editTeams() {
    cy.get('.ant-collapse-expand-icon > .anticon > svg').scrollIntoView();
    cy.get('.ant-collapse-expand-icon > .anticon > svg').click();
    cy.get('[data-testid="edit-teams-button"]').click();
    cy.get('.ant-select-selection-item-remove > .anticon').click();
    cy.get('[data-testid="team-select"]').click();
    cy.get('[data-testid="team-select"]').type(teamName);
    cy.get('.filter-node > .ant-select-tree-node-content-wrapper').click();
    cy.get('[data-testid="inline-save-btn"]').click();
    cy.get('[data-testid="edit-teams-button"]').scrollIntoView();
    cy.get(`[data-testid="${teamName}"]`).should('exist').and('be.visible');
  }

  editRoles() {
    cy.get('[data-testid="edit-roles-button"]').click();
    cy.get('[data-testid="select-user-roles"] > .ant-select-selector')
      .click()
      .type(stewardRole);
    cy.get('.ant-select-item-option-content').click();
    cy.get('[data-testid="inline-save-btn"]').click();
    cy.get('[data-testid="edit-roles-button"]').scrollIntoView();
    cy.get(`[data-testid="${stewardRoleClass}"]`).and('be.visible');
  }

  editDescription() {
    cy.get('[data-testid="edit-description"]').click();
    cy.get(descriptionBox).clear().type(updatedDescription);
    interceptURL('PATCH', '/api/v1/users/*', 'patchDescription');
    cy.get('[data-testid="save"]').should('be.visible').click();
    verifyResponseStatusCode('@patchDescription', 200);
    cy.get(
      ':nth-child(2) > :nth-child(1) > [data-testid="viewer-container"] > [data-testid="markdown-parser"] > :nth-child(1) > .toastui-editor-contents > p'
    ).should('contain', updatedDescription);
  }

  visitProfileSection() {
    interceptURL('GET', '/api/v1/users?*', 'getUsers');
    verifyResponseStatusCode('@getUsers', 200);
    cy.get('[data-testid="dropdown-profile"]').click({ force: true });
    cy.get('[data-testid="user-name"] > .ant-typography').click({
      force: true,
    });
    cy.get('[data-testid="access-token"] > .ant-space-item').click();
  }

  addDataStewardUser() {
    cy.get('[data-testid="add-user"]').click();
    cy.get('[data-testid="email"]')
      .scrollIntoView()
      .should('exist')
      .should('be.visible')
      .type(stewardEmail);
    cy.get('[data-testid="displayName"]')
      .should('exist')
      .should('be.visible')
      .type(stewardUserName);
    cy.get(descriptionBox)
      .should('exist')
      .should('be.visible')
      .type(stewardDescription);
    cy.get(':nth-child(2) > .ant-radio > .ant-radio-input').click();
    cy.get('#password').type(stewardPassword);
    cy.get('#confirmPassword').type(stewardPassword);
    cy.get('[data-testid="roles-dropdown"] > .ant-select-selector')
      .click()
      .type(stewardRole);
    cy.get('.ant-select-item-option-content').click();
    cy.get('[data-testid="roles-dropdown"] > .ant-select-selector').click();
    interceptURL('POST', ' /api/v1/users', 'add-user');
    cy.get('[data-testid="save-user"]').scrollIntoView().click();
    verifyResponseStatusCode('@add-user', 201);
    cy.logout();
    cy.get('#email').should('be.visible').type(stewardEmail);
    cy.get('#password').should('be.visible').type(stewardPassword);
    interceptURL('POST', '/api/v1/users/login', 'login');
    cy.get('[data-testid="login"]').contains('Login').click();
    verifyResponseStatusCode('@login', 200);
    this.visitProfileSection();
    cy.get('.ant-collapse-expand-icon > .anticon > svg').scrollIntoView();
    cy.get('.ant-collapse-expand-icon > .anticon > svg').click();
    cy.get('[data-testid="DataSteward"] > .ant-typography').should(
      'have.text',
      stewardRole
    );
  }

  addDataConsumerUser() {
    cy.get('[data-testid="add-user"]').click();
    cy.get('[data-testid="email"]')
      .scrollIntoView()
      .should('exist')
      .should('be.visible')
      .type(consumerEmail);
    cy.get('[data-testid="displayName"]')
      .should('exist')
      .should('be.visible')
      .type(consumerName);
    cy.get(descriptionBox)
      .should('exist')
      .should('be.visible')
      .type(consumerDescription);
    cy.get(':nth-child(2) > .ant-radio > .ant-radio-input').click();
    cy.get('#password').type(consumerPassword);
    cy.get('#confirmPassword').type(consumerPassword);
    cy.get('[data-testid="roles-dropdown"] > .ant-select-selector')
      .click()
      .type(consumerRole);
    cy.get('.ant-select-item-option-content').click();
    cy.get('[data-testid="roles-dropdown"] > .ant-select-selector').click();
    interceptURL('POST', ' /api/v1/users', 'add-user');
    cy.get('[data-testid="save-user"]').scrollIntoView().click();
    verifyResponseStatusCode('@add-user', 201);
    cy.logout();
    cy.get('#email').should('be.visible').type(consumerEmail);
    cy.get('#password').should('be.visible').type(consumerPassword);
    interceptURL('POST', '/api/v1/users/login', 'login');
    cy.get('[data-testid="login"]').contains('Login').click();
    verifyResponseStatusCode('@login', 200);
    interceptURL('GET', '/api/v1/users?*', 'getUsers');
    verifyResponseStatusCode('@getUsers', 200);
    cy.get('[data-testid="dropdown-profile"]').click({ force: true });
    cy.get('[data-testid="user-name"] > .ant-typography').click({
      force: true,
    });
    cy.get('.ant-collapse-expand-icon > .anticon > svg').scrollIntoView();
    cy.get('.ant-collapse-expand-icon > .anticon > svg').click();
    cy.get(
      '.m-b-md > [data-testid="chip-container"] > [data-testid="DataConsumer"] > .ant-typography'
    ).should('have.text', consumerRole);
  }
  checkConsumerButtonVisibility() {
    cy.get('[data-testid="app-bar-item-explore"]').click();
    interceptURL(
      'GET',
      `/api/v1/tables/name/*?fields=testSuite&include=all`,
      'getTables'
    );
    verifyResponseStatusCode('@getTables', 200);
    cy.get('[data-testid="searchBox"]').click().type('dim.shop');
    cy.get(
      '[data-testid="global-search-suggestion-box"] > [data-testid="sample_data-dim.shop"]'
    ).click();
    // check Add domain permission
    cy.get('[data-testid="add-domain"]').should('not.be.exist');
    cy.get('[data-testid="edit-displayName-button"]').should('not.be.exist');
    // check edit owner permission
    cy.get('[data-testid="edit-owner"]').should('not.be.exist');
    // check edit description permission
    cy.get('[data-testid="edit-description"]').should('be.exist');
    // check edit tier permission
    cy.get('[data-testid="edit-tier"]').should('be.exist');
    // check add tags button
    cy.get(
      ':nth-child(2) > [data-testid="tags-container"] > [data-testid="entity-tags"] > .m-t-xss > .ant-tag'
    ).should('be.exist');
    // check add glossary term button
    cy.get(
      ':nth-child(3) > [data-testid="glossary-container"] > [data-testid="entity-tags"] > .m-t-xss > .ant-tag'
    ).should('be.exist');
    // check edit tier permission
    cy.get('[data-testid="manage-button"]').should('not.be.exist');
    cy.get('[data-testid="lineage"] > .ant-space-item').click();
    cy.get('[data-testid="edit-lineage"]').should('be.disabled');
  }

  checkStewardButtonVisibility() {
    cy.get('[data-testid="app-bar-item-explore"]').click();
    interceptURL(
      'GET',
      `/api/v1/tables/name/*?fields=testSuite&include=all`,
      'getTables'
    );
    verifyResponseStatusCode('@getTables', 200);
    cy.get('[data-testid="searchBox"]').click().type('dim.shop');
    cy.get(
      '[data-testid="global-search-suggestion-box"] > [data-testid="sample_data-dim.shop"]'
    ).click();
    // check Add domain permission
    cy.get('[data-testid="add-domain"]').should('not.be.exist');
    cy.get('[data-testid="edit-displayName-button"]').should('not.be.exist');
    // check edit owner permission
    cy.get('[data-testid="edit-owner"]').should('not.be.exist');
    // check edit description permission
    cy.get('[data-testid="edit-description"]').should('be.exist');
    // check edit tier permission
    cy.get('[data-testid="edit-tier"]').should('be.exist');
    // check add tags button
    cy.get(
      ':nth-child(2) > [data-testid="tags-container"] > [data-testid="entity-tags"] > .m-t-xss > .ant-tag'
    ).should('be.exist');
    // check add glossary term button
    cy.get(
      ':nth-child(3) > [data-testid="glossary-container"] > [data-testid="entity-tags"] > .m-t-xss > .ant-tag'
    ).should('be.exist');
    // check edit tier permission
    cy.get('[data-testid="manage-button"]').should('be.exist');
    cy.get('[data-testid="lineage"] > .ant-space-item').click();
    cy.get('[data-testid="edit-lineage"]').should('be.enabled');
  }

  cleanupConsumer() {
    cy.get('[data-testid="app-bar-item-explore"]').click();
    interceptURL(
      'GET',
      `/api/v1/tables/name/*?fields=testSuite&include=all`,
      'getTables'
    );
    verifyResponseStatusCode('@getTables', 200);
    cy.get('[data-testid="searchBox"]').click().type('dim.shop');
    cy.get(
      '[data-testid="global-search-suggestion-box"] > [data-testid="sample_data-dim.shop"]'
    ).click();
    removeOwner('Aaron Warren');
    this.visitUser();
    deleteSoftDeletedUser(consumerName);
  }

  cleanupSteward() {
    cy.get('[data-testid="app-bar-item-explore"]').click();
    interceptURL(
      'GET',
      `/api/v1/tables/name/*?fields=testSuite&include=all`,
      'getTables'
    );
    verifyResponseStatusCode('@getTables', 200);
    interceptURL(
      'GET',
      `/api/v1/search/query?q=**&from=*&size=*&index=all`,
      'searchTables'
    );
    cy.get('[data-testid="searchBox"]').click().type('dim.shop');
    verifyResponseStatusCode('@searchTables', 200);
    cy.get(
      '[data-testid="global-search-suggestion-box"] > [data-testid="sample_data-dim.shop"]'
    ).click();
    removeOwner('Aaron Warren');
    this.visitUser();
    deleteSoftDeletedUser(stewardUserName);
  }

  checkStewardPermissions() {
    this.visitStewardUser();
    cy.get('[data-testid="app-bar-item-explore"]').click();
    Object.values(VISIT_SERVICE_PAGE_DETAILS).forEach((service) => {
      cy.get('[data-testid="app-bar-item-settings"]').click();
      cy.get(`[data-menu-id*="${service.settingsMenuId}"]`).click();
      cy.get('[data-testid="add-service-button"] > span').should('not.exist');
    });
    cy.get('[data-testid="app-bar-item-explore"]').click();
    cy.get('[data-testid="tables-tab"] > .ant-space').click();
    cy.get(
      '.ant-drawer-title > [data-testid="entity-link"] > .ant-typography'
    ).click();
    cy.get('[data-testid="edit-tier"]').should('be.visible');
    cy.logout();
    Cypress.session.clearAllSavedSessions();
  }

  checkStewardServicesPermissions() {
    this.visitStewardUser();
    cy.get('[data-testid="app-bar-item-explore"]').click();
    Object.values(VISIT_SERVICE_PAGE_DETAILS).forEach((service) => {
      cy.get('[data-testid="app-bar-item-settings"]').click();
      cy.get(`[data-menu-id*="${service.settingsMenuId}"]`).click();
      cy.get('[data-testid="add-service-button"] > span').should('not.exist');
    });
    cy.get('[data-testid="app-bar-item-explore"]').click();
    cy.get('[data-testid="tables-tab"] > .ant-space').click();
    cy.get(
      '.ant-drawer-title > [data-testid="entity-link"] > .ant-typography'
    ).click();
    cy.get('[data-testid="edit-tier"]').should('be.visible');
  }

  checkConsumerServicesPermissions() {
    this.visitConsumerUser();
    cy.get('[data-testid="app-bar-item-explore"]').click();
    Object.values(VISIT_SERVICE_PAGE_DETAILS).forEach((service) => {
      cy.get('[data-testid="app-bar-item-settings"]').click();
      cy.get(`[data-menu-id*="${service.settingsMenuId}"]`).click();
      cy.get('[data-testid="add-service-button"] > span').should('not.exist');
    });
    cy.get('[data-testid="app-bar-item-explore"]').click();
    cy.get('[data-testid="tables-tab"] > .ant-space').click();
    cy.get(
      '.ant-drawer-title > [data-testid="entity-link"] > .ant-typography'
    ).click();
    cy.get('[data-testid="edit-tier"]').should('be.visible');
  }

  assignOwner() {
    cy.get('[data-testid="app-bar-item-explore"]').click();
    interceptURL(
      'GET',
      `/api/v1/tables/name/*?fields=testSuite&include=all`,
      'getTables'
    );
    verifyResponseStatusCode('@getTables', 200);

    cy.get('[data-testid="searchBox"]').click().type('dim.shop');
    cy.get(
      '[data-testid="global-search-suggestion-box"] > [data-testid="sample_data-dim.shop"]'
    ).click();
    addOwner('Aaron Warren');
  }
}

export default UsersTestClass;
