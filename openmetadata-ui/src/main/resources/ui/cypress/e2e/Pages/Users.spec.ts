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
import { interceptURL, verifyResponseStatusCode } from '../../common/common';
import UsersTestClass from '../../common/Entities/UserClass';
import { visitEntityDetailsPage } from '../../common/Utils/Entity';
import { getToken } from '../../common/Utils/LocalStorage';
import {
  addOwner,
  generateRandomUser,
  removeOwner,
} from '../../common/Utils/Owner';
import {
  cleanupPolicies,
  createRoleViaREST,
  DATA_CONSUMER_ROLE,
  DATA_STEWARD_ROLE,
} from '../../common/Utils/Policy';
import {
  addUser,
  editRole,
  generateToken,
  resetPassword,
  revokeToken,
  updateDetails,
  updateExpiration,
} from '../../common/Utils/Users';
import {
  BASE_URL,
  DELETE_ENTITY,
  GLOBAL_SETTING_PERMISSIONS,
  ID,
  uuid,
} from '../../constants/constants';
import { EntityType, SidebarItem } from '../../constants/Entity.interface';
import {
  GlobalSettingOptions,
  SETTINGS_OPTIONS_PATH,
  SETTING_CUSTOM_PROPERTIES_PATH,
} from '../../constants/settings.constant';

const entity = new UsersTestClass();
const expirationTime = {
  oneday: '1',
  sevendays: '7',
  onemonth: '30',
  twomonths: '60',
  threemonths: '90',
};
const name = `Usercttest${uuid()}`;
const owner = generateRandomUser();
let userId = '';
const ownerName = `${owner.firstName}${owner.lastName}`;
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

describe('User with different Roles', { tags: 'Settings' }, () => {
  before(() => {
    cy.login();
    cy.getAllLocalStorage().then((data) => {
      const token = getToken(data);
      createRoleViaREST({ token });

      // Create a new user
      cy.request({
        method: 'POST',
        url: `/api/v1/users/signup`,
        headers: { Authorization: `Bearer ${token}` },
        body: owner,
      }).then((response) => {
        userId = response.body.id;
      });
    });
  });
  after(() => {
    cy.login();
    cy.getAllLocalStorage().then((data) => {
      const token = getToken(data);

      cleanupPolicies({ token });

      // Delete created user
      cy.request({
        method: 'DELETE',
        url: `/api/v1/users/${userId}?hardDelete=true&recursive=false`,
        headers: { Authorization: `Bearer ${token}` },
      });
    });
  });

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
    entity.visitUserListPage();
    addUser({ ...user, role: DATA_CONSUMER_ROLE.name });
    cy.logout();
  });

  it('Reset Data Consumer Password', () => {
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
    entity.visitUserListPage();
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
    cy.sidebarClick(SidebarItem.GLOSSARY);
    cy.clickOnLogo();

    // Check CRUD for Tags
    cy.sidebarClick(SidebarItem.TAGS);
    cy.wait(200);
    cy.get('[data-testid="add-new-tag-button"]').should('not.exist');

    cy.get('[data-testid="manage-button"]').should('not.exist');
  });

  it('Data Consumer operations for settings page', () => {
    cy.login(user.email, user.newPassword);

    Object.values(ID).forEach((id) => {
      if (id?.api) {
        interceptURL('GET', id.api, 'getTabDetails');
      }
      // Navigate to settings and respective tab page
      cy.settingClick(id.testid);
      if (id?.api) {
        verifyResponseStatusCode('@getTabDetails', 200);
      }
      cy.get(`[data-testid="${id.button}"]`).should('not.be.exist');
    });

    Object.values(GLOBAL_SETTING_PERMISSIONS).forEach((id) => {
      if (id.testid === GlobalSettingOptions.METADATA) {
        cy.settingClick(id.testid);
      } else {
        cy.sidebarClick(SidebarItem.SETTINGS);
        let paths = SETTINGS_OPTIONS_PATH[id.testid];

        if (id.isCustomProperty) {
          paths = SETTING_CUSTOM_PROPERTIES_PATH[id.testid];
        }
        cy.get(`[data-testid="${paths[0]}"]`).should('not.be.exist');
      }
    });
  });

  it('Data Consumer permissions for table details page', () => {
    cy.login();
    visitEntityDetailsPage({
      term: DELETE_ENTITY.table.term,
      serviceName: DELETE_ENTITY.table.serviceName,
      entity: EntityType.Table,
    });
    addOwner(ownerName);
    cy.logout();
    cy.login(user.email, user.newPassword);
    visitEntityDetailsPage({
      term: DELETE_ENTITY.table.term,
      serviceName: DELETE_ENTITY.table.serviceName,
      entity: EntityType.Table,
    });
    entity.checkConsumerPermissions();
  });

  it('Update Data Consumer details', () => {
    cy.login(user.email, user.newPassword);
    updateDetails({ ...user, isAdmin: false });
  });

  it('Update Data Steward details', () => {
    // change role from consumer to steward
    cy.login();
    entity.visitUserListPage();
    editRole(user.name, DATA_STEWARD_ROLE.name);
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
    entity.visitUserListPage();
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
    entity.visitUserListPage();
    Object.values(expirationTime).forEach((expiry) => {
      updateExpiration(expiry);
    });
  });

  it('Data Steward operations for settings page', () => {
    cy.login(user.email, user.newStewardPassword);

    Object.values(ID).forEach((id) => {
      if (id?.api) {
        interceptURL('GET', id.api, 'getTabDetails');
      }
      // Navigate to settings and respective tab page
      cy.settingClick(id.testid);
      if (id?.api) {
        verifyResponseStatusCode('@getTabDetails', 200);
      }
      cy.get(`[data-testid="${id.button}"]`).should('not.be.exist');
    });

    Object.values(GLOBAL_SETTING_PERMISSIONS).forEach((id) => {
      if (id.testid === GlobalSettingOptions.METADATA) {
        cy.settingClick(id.testid);
      } else {
        cy.sidebarClick(SidebarItem.SETTINGS);

        let paths = SETTINGS_OPTIONS_PATH[id.testid];

        if (id.isCustomProperty) {
          paths = SETTING_CUSTOM_PROPERTIES_PATH[id.testid];
        }
        cy.get(`[data-testid="${paths[0]}"]`).should('not.be.exist');
      }
    });
  });

  it('Check Data Steward permissions', () => {
    cy.login(user.email, user.newStewardPassword);
    entity.checkStewardServicesPermissions();
    cy.goToHomePage();
    visitEntityDetailsPage({
      term: DELETE_ENTITY.table.term,
      serviceName: DELETE_ENTITY.table.serviceName,
      entity: EntityType.Table,
    });
    entity.checkStewardPermissions();
    cy.logout();
  });

  it('Admin Soft delete user', () => {
    cy.login();
    entity.visitUserListPage();
    entity.softDeleteUser(user.name, user.updatedDisplayName);
  });

  it('Admin Restore soft deleted user', () => {
    cy.login();
    entity.visitUserListPage();
    entity.restoreSoftDeletedUser(user.name, user.updatedDisplayName);
  });

  it('Admin Permanent Delete User', () => {
    cy.login();
    entity.visitUserListPage();
    entity.permanentDeleteUser(user.name, user.updatedDisplayName);
  });

  it('Restore Admin Details', () => {
    cy.login();
    entity.restoreAdminDetails();
    cy.goToHomePage();
    visitEntityDetailsPage({
      term: DELETE_ENTITY.table.term,
      serviceName: DELETE_ENTITY.table.serviceName,
      entity: EntityType.Table,
    });
    removeOwner(ownerName);
  });
});
