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

import { descriptionBox, interceptURL, login, uuid, verifyResponseStatusCode } from "../../common/common";
import { LOGIN } from "../../constants/constants";

const roleName = `Role-test-${uuid()}`;

describe("Test Add role and assign it to the user", () => {
  beforeEach(() => {
    login(LOGIN.username, LOGIN.password);
    cy.goToHomePage();
    
    interceptURL('GET', '*api/v1/roles*', 'getRoles');

    cy.get('[data-testid="appbar-item-settings"]').should('be.visible').click();

    cy.get('[data-menu-id*="roles"]').should('be.visible').click();

    verifyResponseStatusCode('@getRoles', 200);

    cy.url().should('eq', 'http://localhost:8585/settings/access/roles');
  });

  it("Create and Assign role to user", () => {
    cy.get('[data-testid="add-role"]')
      .contains('Add Role')
      .should('be.visible')
      .click();

    //Asserting navigation
    cy.get('[data-testid="inactive-link"]')
      .should('contain', 'Add New Role')
      .should('be.visible');
    //Entering name
    cy.get('#name').should('be.visible').type(roleName);
    //Entering descrription
    cy.get(descriptionBox).type("description");
    //Select the policies
    cy.get('.ant-select').should('be.visible').click();

    cy.get('[title="Data Consumer Policy"]')
      .scrollIntoView()
      .should('be.visible')
      .click();

    cy.get('[title="Data Steward Policy"]')
      .scrollIntoView()
      .should('be.visible')
      .click();
    //Clicking outside to close the dropdown
    cy.get('.ant-card-body').click();
    //Save the role
    cy.get('[data-testid="submit-btn"]')
      .scrollIntoView()
      .should('be.visible')
      .click();

    //Verify the role is added successfully
    cy.url().should(
      'eq',
      `http://localhost:8585/settings/access/roles/${roleName}`
    );
    cy.get('[data-testid="inactive-link"]').should('contain', roleName);

    //Verify added description
    cy.get('[data-testid="description"] > [data-testid="viewer-container"]')
      .should('be.visible')
      .should('contain', "description");
    
    cy.get('[data-testid="avatar"]').should("be.visible").click()
    cy.get('[data-testid="user-name"]').should("be.visible").click()

    cy.reload()

    cy.get('[data-testid="edit-roles"]').should("be.visible").scrollIntoView().click()
    cy.get('[id="react-select-3-input"]').should("be.visible").click()

  })
})
