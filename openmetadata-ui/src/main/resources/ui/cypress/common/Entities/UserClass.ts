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
  verifyResponseStatusCode,
} from '../../common/common';
import { VISIT_SERVICE_PAGE_DETAILS } from '../../constants/service.constants';
import {
  permanentDeleteUser,
  restoreUser,
  softDeleteUser,
} from '../Utils/Users';

class UsersTestClass {
  protected name: string;

  public getName() {
    return this.name;
  }

  visitUserListPage() {
    cy.get('[data-testid="app-bar-item-settings"]')
      .should('exist')
      .should('be.visible')
      .click();
    interceptURL('GET', '/api/v1/users?*', 'getUsers');
    cy.get('[data-testid="settings-left-panel"]').contains('Users').click();
  }

  softDeleteUser(name) {
    interceptURL('GET', '/api/v1/users?*', 'getUsers');
    verifyResponseStatusCode('@getUsers', 200);
    softDeleteUser(name);
  }

  restoreSoftDeletedUser(name, editedName) {
    restoreUser(name, editedName);
  }

  permanentDeleteUser(name) {
    permanentDeleteUser(name);
    cy.logout();
  }

  checkConsumerPermissions() {
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

  checkStewardServicesPermissions() {
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

  checkStewardPermissions() {
    // check Add domain permission
    cy.get('[data-testid="add-domain"]').should('not.be.exist');
    cy.get('[data-testid="edit-displayName-button"]').should('be.exist');
    // check edit owner permission
    cy.get('[data-testid="edit-owner"]').should('be.exist');
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

  restoreAdminDetails() {
    cy.get('[data-testid="dropdown-profile"]').click({ force: true });
    cy.get('[data-testid="user-name"] > .ant-typography').click({
      force: true,
    });
    cy.get('[data-testid="edit-displayName"]').should('be.visible');
    cy.get('[data-testid="edit-displayName"]').click();
    cy.get('[data-testid="displayName"]').clear();
    interceptURL('PATCH', '/api/v1/users/*', 'updateName');
    cy.get('[data-testid="inline-save-btn"]').click();
    cy.get('[data-testid="edit-displayName"]').scrollIntoView();
    verifyResponseStatusCode('@updateName', 200);

    cy.get('.ant-collapse-expand-icon > .anticon > svg').click();
    cy.get('[data-testid="edit-teams-button"]').click();
    interceptURL('PATCH', '/api/v1/users/*', 'updateTeam');
    cy.get('.ant-select-selection-item-remove > .anticon').click();
    cy.get('[data-testid="inline-save-btn"]').click();
    verifyResponseStatusCode('@updateTeam', 200);

    cy.get('.ant-collapse-expand-icon > .anticon > svg').click();
    cy.get('[data-testid="edit-description"]').click();
    cy.get(descriptionBox).clear();
    interceptURL('PATCH', '/api/v1/users/*', 'patchDescription');
    cy.get('[data-testid="save"]').should('be.visible').click();
    verifyResponseStatusCode('@patchDescription', 200);
    cy.get('.ant-collapse-expand-icon > .anticon > svg').scrollIntoView();
    cy.get('.ant-collapse-expand-icon > .anticon > svg').click();
  }
}

export default UsersTestClass;
