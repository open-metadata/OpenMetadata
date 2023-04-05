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
import { BASE_URL } from '../../constants/constants';

const roles = {
  dataConsumer: 'Data Consumer',
  dataSteward: 'Data Steward',
};

const policies = {
  dataConsumerPolicy: 'Data Consumer Policy',
  dataStewardPolicy: 'Data Steward Policy',
  organizationPolicy: 'Organization Policy',
  teamOnlyAccessPolicy: 'Team only access Policy',
};

const ruleDetails = {
  resources: 'All',
  operations: 'All',
  effect: 'Allow',
  condition: 'isOwner()',
  inValidCondition: 'isOwner(',
};

const errorMessageValidation = {
  lastPolicyCannotBeRemoved: 'At least one policy is required in a role',
  lastRuleCannotBeRemoved: 'At least one rule is required in a policy',
};

const policyName = `Policy-test-${uuid()}`;
const description = `This is ${policyName} description`;

const ruleName = `Rule-test-${uuid()}`;
const ruleDescription = `This is ${ruleName} description`;
const updatedDescription = 'This is updated description';

const newRuleName = `New-Rule-test-${uuid()}`;
const newRuledescription = `This is ${newRuleName} description`;

const updatedRuleName = `New-Rule-test-${uuid()}-updated`;

const addRule = (rulename, ruleDescription, descriptionIndex) => {
  cy.get('[data-testid="rule-name"]').should('be.visible').type(rulename);
  // Enter rule description
  cy.get('.toastui-editor-md-container > .toastui-editor > .ProseMirror')
    .eq(descriptionIndex)
    .scrollIntoView()
    .type(ruleDescription);
  // Select resource dropdown
  cy.get('[data-testid="resources"]')
    .scrollIntoView()
    .should('be.visible')
    .click();

  // Select All
  cy.get('.ant-select-tree-checkbox-inner').should('be.visible').click();

  // Click on operations dropdown
  cy.get('[data-testid="operations"]').should('be.visible').click();

  cy.get('.ant-select-tree-checkbox-inner').eq(1).should('be.visible').click();
  // Click on condition combobox

  cy.get('[data-testid="condition"]')
    .scrollIntoView()
    .should('be.visible')
    .click();

  cy.get(`[title="${ruleDetails.condition}"]`).should('be.visible').click();

  cy.get('[data-testid="condition-success"]').contains('✅ Valid condition');

  cy.wait(500);
  // Submit
  cy.get('[data-testid="submit-btn"]')
    .scrollIntoView()
    .should('be.visible')
    .click();
};

describe('Policy page should work properly', () => {
  beforeEach(() => {
    cy.login();
    cy.intercept('GET', '*api/v1/policies*').as('getPolicies');

    cy.get('[data-testid="appbar-item-settings"]').should('be.visible').click();

    cy.get('[data-testid="settings-left-panel"]')
      .contains('Policies')
      .should('be.visible')
      .click();

    cy.wait('@getPolicies', { timeout: 15000 })
      .its('response.statusCode')
      .should('equal', 200);

    cy.url().should('eq', `${BASE_URL}/settings/access/policies`);
  });

  it('Default Policies and Roles should be displayed', () => {
    // Verifying the default roles and policies are present

    Object.values(policies).forEach((policy) => {
      cy.get('[data-testid="policy-name"]')
        .should('contain', policy)
        .should('be.visible');
    });
    // Validate role is displayed
    cy.get('[data-testid="role-link"]')
      .should('contain', roles.dataConsumer)
      .should('be.visible');
    cy.get('[data-testid="role-link"]')
      .should('contain', roles.dataSteward)
      .should('be.visible');
  });

  it('Add new policy', () => {
    // Click on add new policy
    cy.get('[data-testid="add-policy"]').should('be.visible').click();
    cy.get('[data-testid="inactive-link"]');

    // Enter policy name
    cy.get('[data-testid="policy-name"]').should('be.visible').type(policyName);

    // Enter description
    cy.get(descriptionBox).eq(0).type(description);

    // Enter rule name
    addRule(ruleName, ruleDescription, 1);

    // Validate the added policy
    cy.get('[data-testid="inactive-link"]')
      .should('be.visible')
      .should('have.text', policyName);

    cy.get('[data-testid="rule-name"]')
      .should('be.visible')
      .should('contain', ruleName);

    // Verify policy description
    cy.get('[data-testid="description"] > [data-testid="viewer-container"]')
      .eq(0)
      .should('be.visible')
      .should('contain', description);

    // verify rule description
    cy.get('[data-testid="viewer-container"] > [data-testid="markdown-parser"]')
      .should('be.visible')
      .should('contain', ruleDescription);

    // Verify other details
    cy.get('[data-testid="rule-name"]').should('be.visible').click();

    cy.get('[data-testid="resources"]')
      .should('be.visible')
      .should('contain', ruleDetails.resources);

    cy.get('[data-testid="operations"]')
      .should('be.visible')
      .should('contain', ruleDetails.operations);

    cy.get('[data-testid="effect"]')
      .should('be.visible')
      .should('contain', ruleDetails.effect);

    cy.get('[data-testid="condition"]')
      .should('be.visible')
      .should('contain', ruleDetails.condition);
  });

  it('Edit policy description', () => {
    interceptURL(
      'GET',
      `/api/v1/policies/name/${policyName}*`,
      'getSelectedPolicy'
    );
    // Click on created policy name
    cy.get('[data-testid="policy-name"]').contains(policyName).click();
    verifyResponseStatusCode('@getSelectedPolicy', 200);
    cy.get('[data-testid="edit-description"]').should('be.visible').click();
    // Enter updated description
    cy.get(descriptionBox)
      .should('be.visible')
      .clear()
      .type(`${updatedDescription}-${policyName}`);
    // Click on save
    cy.get('[data-testid="save"]').should('be.visible').click();

    // Validate added description
    cy.get('[data-testid="description"] > [data-testid="viewer-container"]')
      .should('be.visible')
      .should('contain', `${updatedDescription}-${policyName}`);
  });

  it('Add new rule', () => {
    interceptURL(
      'GET',
      `/api/v1/policies/name/${policyName}*`,
      'getSelectedPolicy'
    );
    // Click on created policy name
    cy.get('[data-testid="policy-name"]').contains(policyName).click();
    verifyResponseStatusCode('@getSelectedPolicy', 200);

    interceptURL('GET', '/api/v1/policies/*', 'addRulepage');
    // Click on add rule button
    cy.get('[data-testid="add-rule"]').should('be.visible').click();

    verifyResponseStatusCode('@addRulepage', 200);

    addRule(newRuleName, newRuledescription, 0);

    // Validate added rule
    cy.get('[data-testid="rule-name"]')
      .should('be.visible')
      .should('contain', ruleName);

    // Verify other details
    cy.get('[data-testid="rule-name"]')
      .last()
      .scrollIntoView()
      .contains(ruleName)
      .should('be.visible')
      .click();

    cy.get('[data-testid="resources"]')
      .last()
      .scrollIntoView()
      .should('exist')
      .should('contain', ruleDetails.resources);

    cy.get('[data-testid="operations"]')
      .last()
      .scrollIntoView()
      .should('exist')
      .should('contain', ruleDetails.operations);

    cy.get('[data-testid="effect"]')
      .last()
      .scrollIntoView()
      .should('exist')
      .should('contain', ruleDetails.effect);

    cy.get('[data-testid="condition"]')
      .last()
      .scrollIntoView()
      .should('exist')
      .should('contain', ruleDetails.condition);
  });

  it('Edit rule name for created Rule', () => {
    interceptURL(
      'GET',
      `/api/v1/policies/name/${policyName}*`,
      'getSelectedPolicy'
    );
    // Click on created policy name
    cy.get('[data-testid="policy-name"]').contains(policyName).click();

    verifyResponseStatusCode('@getSelectedPolicy', 200);
    // Click on new rule manage button
    cy.get(`[data-testid="manage-button-${newRuleName}"]`)
      .should('be.visible')
      .click();

    interceptURL('GET', '/api/v1/policies/*', 'editRulePage');
    cy.get('[data-testid="edit-rule"]').should('be.visible').click();

    verifyResponseStatusCode('@editRulePage', 200);
    verifyResponseStatusCode('@getSelectedPolicy', 200);

    // Enter new name
    cy.get('[data-testid="rule-name"]').clear().type(updatedRuleName);

    interceptURL('PATCH', '/api/v1/policies/*', 'updateRule');

    cy.get('[data-testid="submit-btn"]')
      .scrollIntoView()
      .should('be.visible')
      .click();

    verifyResponseStatusCode('@updateRule', 200);
    cy.reload();

    cy.url().should('include', policyName);

    cy.get('[data-testid="rule-name"]').should('contain', updatedRuleName);
  });

  it('Delete new rule', () => {
    interceptURL(
      'GET',
      `/api/v1/policies/name/${policyName}*`,
      'getSelectedPolicy'
    );
    // Click on created policy name
    cy.get('[data-testid="policy-name"]').contains(policyName).click();

    verifyResponseStatusCode('@getSelectedPolicy', 200);

    // Click on new rule manage button
    cy.get(`[data-testid="manage-button-${updatedRuleName}"]`)
      .should('be.visible')
      .click();

    cy.get('[data-testid="delete-rule"]').should('be.visible').click();

    // Validate the deleted rule
    cy.get('[data-testid="rule-name"]')
      .should('be.visible')
      .should('not.contain', updatedRuleName);
  });

  it('Delete last rule and validate', () => {
    interceptURL(
      'GET',
      `/api/v1/policies/name/${policyName}*`,
      'getSelectedPolicy'
    );
    // Click on created policy name
    cy.get('[data-testid="policy-name"]').contains(policyName).click();

    verifyResponseStatusCode('@getSelectedPolicy', 200);

    // Click on new rule manage button
    cy.get(`[data-testid="manage-button-${ruleName}"]`)
      .should('be.visible')
      .click();
    interceptURL('PATCH', '/api/v1/policies/*', 'deletelastPolicy');

    cy.get('[data-testid="delete-rule"]').should('be.visible').click();

    verifyResponseStatusCode('@deletelastPolicy', 400);

    cy.get('.Toastify__toast-body')
      .should('be.visible')
      .should('contain', errorMessageValidation.lastRuleCannotBeRemoved);
  });

  it('Delete created policy', () => {
    cy.get(`[data-testid="delete-action-${policyName}"]`)
      .should('exist')
      .should('be.visible')
      .click();

    cy.get('[data-testid="confirmation-text-input"]')
      .should('be.visible')
      .type('DELETE');

    cy.get('[data-testid="confirm-button"]').should('be.visible').click();

    // Validate deleted policy
    cy.get('[data-testid="policy-name"]').should('not.contain', policyName);
  });
});
