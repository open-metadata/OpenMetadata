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
  generateToken,
  revokeToken,
  updateExpiration,
} from '../../common/Utils/Users';

const entity = new UsersTestClass();
const expirationTime = {
  oneday: '1',
  sevendays: '7',
  onemonth: '30',
  twomonths: '60',
  threemonths: '90',
};

describe('Users Page', () => {
  beforeEach(() => {
    cy.login();
    entity.visitUser();
  });

  it('Create  User', () => {
    entity.createUser();
  });

  it('Update User Details', function () {
    entity.editDisplayName();
    entity.editTeams();
    entity.editRoles();
    entity.editDescription();
  });

  it('Token generation and revocation', function () {
    entity.visitProfileSection();
    generateToken();
    revokeToken();
  });

  it(`Update token expiration`, () => {
    Object.values(expirationTime).forEach((expiry) => {
      updateExpiration(expiry);
    });
  });

  it('Soft delete user', () => {
    entity.softDeleteUser();
  });

  it('Restore soft deleted user', () => {
    entity.restoreSoftDeletedUser();
  });

  it('Permanently Delete User', () => {
    entity.permanentlyDeleteSoftDeletedUser();
  });
});

describe('Data Steward User', function () {
  beforeEach(() => {
    cy.login();
    entity.visitUser();
  });

  it('Create Data Steward User', () => {
    entity.addDataStewardUser();
    cy.logout();
    Cypress.session.clearAllSavedSessions();
  });

  it('Check permission for Data Steward', () => {
    entity.assignOwner();
    cy.logout();
    Cypress.session.clearAllSavedSessions();
    entity.checkStewardServicesPermissions();
    entity.checkStewardButtonVisibility();
  });

  after(() => {
    cy.login();
    entity.cleanupSteward();
  });
});

describe('Data Consumer User', function () {
  beforeEach(() => {
    cy.login();
    entity.visitUser();
  });

  it('Create Data Consumer User', () => {
    entity.addDataConsumerUser();
    cy.logout();
    Cypress.session.clearAllSavedSessions();
  });

  it('Check permission for Data Consumer', () => {
    entity.assignOwner();
    cy.logout();
    Cypress.session.clearAllSavedSessions();
    entity.checkConsumerServicesPermissions();
    entity.checkConsumerButtonVisibility();
  });

  after(() => {
    cy.login();
    entity.cleanupConsumer();
  });
});
