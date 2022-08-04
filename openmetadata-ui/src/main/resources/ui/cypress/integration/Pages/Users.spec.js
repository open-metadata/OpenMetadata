/*
 *  Copyright 2021 Collate
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

import { addUser, deleteSoftDeletedUser, restoreUser, softDeleteUser, uuid } from '../../common/common';

const userName = `User-ct-test-${uuid()}`;
const userEmail = `${userName}@gmail.com`;

const adminName = `Admin-ct-test-${uuid()}`;
const adminEmail = `${adminName}@gmail.com`;

const user = 'Alec Kane';
const admin = 'Adam Rodriguez';

describe('Users flow should work properly', () => {
  beforeEach(() => {
    cy.visit('http://localhost:8585/settings', {
      failOnStatusCode: false,
    });
    cy.get('[data-testid="WhatsNewModalFeatures"]').should('be.visible');
    cy.get('[data-testid="closeWhatsNew"]').click();
    cy.get('[data-testid="WhatsNewModalFeatures"]').should('not.exist');
    cy.wait(1000);
    cy.contains('Users').should('exist').should('be.visible').click();
  });

  it('Add new User', () => {
    cy.get(':nth-child(2) > .ant-btn')
      .should('exist')
      .should('be.visible')
      .click();

    addUser(userName, userEmail);

    //Validate if user is added in the User tab
    cy.visit('http://localhost:8585/settings', {
      failOnStatusCode: false,
    });
    cy.wait(1000);
    cy.contains('Users').should('exist').should('be.visible').click();
    cy.get('[data-testid="searchbar"]')
      .should('exist')
      .should('be.visible')
      .type(userName);
  });

  it('Soft delete user', () => {
    softDeleteUser(user);
  });

  it('Restore soft deleted user', () => {
    restoreUser(user);
  });

  it('Permanently Delete Soft Deleted User', () => {
    softDeleteUser(user);
    deleteSoftDeletedUser(user);
  });
});

describe('Admin flow should work properly', () => {
  beforeEach(() => {
    cy.visit('http://localhost:8585/settings', {
      failOnStatusCode: false,
    });
    cy.get('[data-testid="WhatsNewModalFeatures"]').should('be.visible');
    cy.get('[data-testid="closeWhatsNew"]').click();
    cy.get('[data-testid="WhatsNewModalFeatures"]').should('not.exist');
    cy.wait(1000);
    cy.contains('Admins').should('exist').should('be.visible').click();
  });

  it('Add admin user', () => {
    cy.get(':nth-child(2) > .ant-btn')
      .should('exist')
      .should('be.visible')
      .click();

    //Setting the user to admin before adding user
    cy.get('[data-testid="admin"]')
      .scrollIntoView()
      .should('exist')
      .should('be.visible')
      .click();

    addUser(adminName, adminEmail);

    //Validate if user is added in the User tab
    cy.visit('http://localhost:8585/settings', {
      failOnStatusCode: false,
    });
    cy.wait(1000);
    cy.contains('Admins').should('exist').should('be.visible').click();
    cy.get('[data-testid="searchbar"]')
      .should('exist')
      .should('be.visible')
      .type(adminName);
  });

  it('Soft delete admin', () => {
    //Setting a random user as admin for admin flow to work
    cy.contains('Users')
      .scrollIntoView()
      .should('exist')
      .should('be.visible')
      .click();
    cy.get('[data-testid="searchbar"]')
      .should('exist')
      .should('be.visible')
      .type(admin);

    cy.wait(1000);

    cy.get('.ant-table-cell > a').should('exist').should('be.visible').click();
    cy.get('[data-testid="edit-roles"]')
      .scrollIntoView()
      .should('exist')
      .should('be.visible')
      .click();
    cy.get('.css-tlfecz-indicatorContainer')
      .should('exist')
      .should('be.visible')
      .click();
    cy.contains('Admin')
      .scrollIntoView()
      .should('exist')
      .should('be.visible')
      .click();
    cy.wait(500);
    cy.get('[data-testid="save-roles"]').click();
    cy.visit('http://localhost:8585/settings', {
      failOnStatusCode: false,
    });
    cy.contains('Admins').should('exist').should('be.visible').click();
    softDeleteUser(admin);
  });

  it('Restore soft deleted admin', () => {
    restoreUser(admin);
  });

  it('Permanently Delete Soft Deleted admin', () => {
    softDeleteUser(admin);
    deleteSoftDeletedUser(admin);
  });
});
