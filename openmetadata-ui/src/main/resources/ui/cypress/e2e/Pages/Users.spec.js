/*
 *  Copyright 2024 Collate.
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
import UsersTestClass from '../../common/Entities/UserClass';
import {
  addUser,
  editRole,
  generateToken,
  resetPassword,
  revokeToken,
  updateDetails,
  updateExpiration,
  visitUserListPage,
} from '../../common/Utils/Users';
import { interceptURL, verifyResponseStatusCode } from '../../common/common';

import {
  BASE_URL,
  GLOBAL_SETTING_PERMISSIONS,
  ID,
  uuid,
} from '../../constants/constants';
import { NAVBAR_DETAILS } from '../../constants/redirections.constants';
const entity = new UsersTestClass();
const expirationTime = {
  oneday: '1',
  sevendays: '7',
  onemonth: '30',
  twomonths: '60',
  threemonths: '90',
};
const name = `Usercttest${uuid()}`;
const glossary = NAVBAR_DETAILS.glossary;
const tag = NAVBAR_DETAILS.tags;
const user = {
  name: name,
  email: `${name}@gmail.com`,
  password: `User@${uuid()}`,
  updatedDisplayName: `Edited${uuid()}`,
  newPassword: `NewUser@${uuid()}`,
  teamName: 'Applications',
  updatedDescription: 'This is updated description',
  newStewardPassword: `StewUser@${uuid()}`,
};

describe('User with different Roles', () => {
  it('Update own admin details', () => {
    cy.login();
    updateDetails({
      ...user,
      isAdmin: true,
      role: 'Admin',
    });
  });

  it('Create Data Consumer User', () => {
    cy.login();
    visitUserListPage();
    addUser({ ...user, role: 'Data Consumer' });
    cy.logout();
  });

  it('Reset Password', () => {
    cy.login(user.email, user.password);

    resetPassword(user.password, user.newPassword);
    cy.logout();

    cy.login(user.email, user.newPassword);
  });

  it('Token generation & revocation', () => {
    cy.login(user.email, user.newPassword);
    cy.get('[data-testid="dropdown-profile"]').click({ force: true });
    cy.get('[data-testid="user-name"] > .ant-typography', {
      timeout: 10000,
    }).click();
    cy.get('[data-testid="access-token"]').click();
    generateToken();
    revokeToken();
  });

  it(`Update token expiration`, () => {
    cy.login(user.email, user.newPassword);
    visitUserListPage();
    Object.values(expirationTime).forEach((expiry) => {
      updateExpiration(expiry);
    });
  });

  it('Data Consumer user should have only view permission for glossary and tags', () => {
    Cypress.session.clearAllSavedSessions();
    cy.storeSession(user.email, user.newPassword);
    cy.goToHomePage();
    cy.url().should('eq', `${BASE_URL}/my-data`);

    // Check CRUD for Glossary
    cy.get(glossary.testid)
      .should('be.visible')
      .click({ animationDistanceThreshold: 10 });
    if (glossary.subMenu) {
      cy.get(glossary.subMenu).should('be.visible').click({ force: true });
    }
    cy.clickOutside();

    cy.clickOnLogo();

    // Check CRUD for Tags
    cy.get(tag.testid)
      .should('be.visible')
      .click({ animationDistanceThreshold: 10 });
    if (tag.subMenu) {
      cy.get(tag.subMenu).should('be.visible').click({ force: true });
    }
    cy.get('body').click();
    cy.wait(200);
    cy.get('[data-testid="add-new-tag-button"]').should('not.exist');

    cy.get('[data-testid="manage-button"]').should('not.exist');
  });

  it('Data Consumer operations for settings page', () => {
    cy.storeSession(user.email, user.newPassword);
    cy.goToHomePage();
    cy.url().should('eq', `${BASE_URL}/my-data`);
    // Navigate to settings
    cy.get(NAVBAR_DETAILS.settings.testid).should('be.visible').click();
    Object.values(ID).forEach((id) => {
      if (id?.api) {
        interceptURL('GET', id.api, 'getTabDetails');
      }
      cy.get(id.testid).should('be.visible').click();
      if (id?.api) {
        verifyResponseStatusCode('@getTabDetails', 200);
      }
      cy.get(`[data-testid="${id.button}"]`).should('not.be.exist');
    });

    Object.values(GLOBAL_SETTING_PERMISSIONS).forEach((id) => {
      if (id.testid === '[data-menu-id*="metadata"]') {
        cy.get(id.testid).should('be.visible').click();
      } else {
        cy.get(id.testid).should('not.be.exist');
      }
    });
  });

  it('Data Consumer permissions for table details page', () => {
    cy.login(user.email, user.newPassword);
    entity.checkConsumerButtonVisibility();
  });

  it('Update Data Consumer details', () => {
    cy.login(user.email, user.newPassword);
    updateDetails({ ...user, isAdmin: false });
  });

  it('Update Data Steward details', () => {
    // change role from consumer to steward
    cy.login();
    visitUserListPage();
    editRole(user.name, 'Data Steward');
    cy.logout();
    // login to steward user
    cy.login(user.email, user.newPassword);
    updateDetails({ ...user, isAdmin: false });
    cy.logout();
  });

  it('Reset Data Steward Password', () => {
    cy.login(user.email, user.newPassword);
    resetPassword(user.newPassword, user.newStewardPassword);
    cy.logout();
    cy.login(user.email, user.newStewardPassword);
  });

  it('Token generation & revocation for Data Steward', () => {
    cy.login(user.email, user.newStewardPassword);
    visitUserListPage();
    cy.get('[data-testid="dropdown-profile"]').click({ force: true });
    cy.get('[data-testid="user-name"] > .ant-typography').click({
      force: true,
    });
    cy.get('[data-testid="access-token"] > .ant-space-item').click();
    generateToken();
    revokeToken();
  });

  it(`Update token expiration for Data Steward`, () => {
    cy.login(user.email, user.newStewardPassword);
    visitUserListPage();
    Object.values(expirationTime).forEach((expiry) => {
      updateExpiration(expiry);
    });
  });

  it('Data Steward operations for settings page', () => {
    cy.login(user.email, user.newStewardPassword);
    cy.url().should('eq', `${BASE_URL}/my-data`);
    // Navigate to settings
    cy.get(NAVBAR_DETAILS.settings.testid).should('be.visible').click();
    Object.values(ID).forEach((id) => {
      if (id?.api) {
        interceptURL('GET', id.api, 'getTabDetails');
      }
      cy.get(id.testid).should('be.visible').click();
      if (id?.api) {
        verifyResponseStatusCode('@getTabDetails', 200);
      }
      cy.get(`[data-testid="${id.button}"]`).should('not.be.exist');
    });

    Object.values(GLOBAL_SETTING_PERMISSIONS).forEach((id) => {
      if (id.testid === '[data-menu-id*="metadata"]') {
        cy.get(id.testid).should('be.visible').click();
      } else {
        cy.get(id.testid).should('not.be.exist');
      }
    });
  });

  it('Check Data Steward permissions', () => {
    cy.login(user.email, user.newStewardPassword);
    entity.checkStewardServicesPermissions();
    entity.checkStewardButtonVisibility();
    cy.logout();
  });

  it('Admin Soft delete user', () => {
    cy.login();
    visitUserListPage();
    entity.softDeleteUser(user.name);
  });

  it('Admin Restore soft deleted user', () => {
    cy.login();
    visitUserListPage();
    entity.restoreSoftDeletedUser(user.name, user.updatedDisplayName);
  });

  it('Admin Permanent Delete User', () => {
    cy.login();
    visitUserListPage();
    entity.permanentlyDeleteSoftDeletedUser(user.name);
  });

  it('Restore Admin Details', () => {
    cy.login();
    entity.restoreAdminDetails();
  });
});
