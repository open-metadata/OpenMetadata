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
import { interceptURL } from '../../common/common';
import { getToken } from '../../common/Utils/LocalStorage';
import { generateRandomUser } from '../../common/Utils/Owner';
import { SidebarItem } from '../../constants/Entity.interface';
import {
  PROFILER_EMPTY_RESPONSE_CONFIG,
  PROFILER_REQUEST_CONFIG,
} from '../../constants/ProfilerConfiguration.constant';
const visitProfilerConfigurationPage = () => {
  interceptURL(
    'GET',
    '/api/v1/system/settings/profilerConfiguration',
    'getProfilerConfiguration'
  );
  cy.sidebarClick(SidebarItem.SETTINGS);
  cy.get('[data-testid="preferences"]').scrollIntoView().click();
  cy.get('[data-testid="preferences.profiler-configuration"]')
    .scrollIntoView()
    .click();
  cy.wait('@getProfilerConfiguration');
};

const user = generateRandomUser();
let userId = '';

describe('ProfilerConfigurationPage', () => {
  before(() => {
    cy.login();
    cy.getAllLocalStorage().then((data) => {
      const token = getToken(data);

      // Create a new user
      cy.request({
        method: 'POST',
        url: `/api/v1/users/signup`,
        headers: { Authorization: `Bearer ${token}` },
        body: user,
      }).then((response) => {
        userId = response.body.id;
      });
    });
  });

  after(() => {
    cy.login();
    cy.getAllLocalStorage().then((data) => {
      const token = getToken(data);

      // Delete created user
      cy.request({
        method: 'DELETE',
        url: `/api/v1/users/${userId}?hardDelete=true&recursive=false`,
        headers: { Authorization: `Bearer ${token}` },
      });
    });
  });

  beforeEach(() => {
    cy.login();
  });

  it('Verify validation', () => {
    visitProfilerConfigurationPage();
    cy.get('[data-testid="save-button"]').click();
    cy.get('#metricConfiguration_0_dataType_help').should(
      'contain',
      'Data Type is required.'
    );
    cy.get('[data-testid="cancel-button"]').click();
    cy.url().should('include', `/settings/preferences`);
  });

  it('Update profiler configuration', () => {
    visitProfilerConfigurationPage();
    cy.get('#metricConfiguration_0_dataType').click();
    cy.get(`[title="AGG_STATE"]`).filter(':visible').scrollIntoView().click();

    cy.get('#metricConfiguration_0_metrics').click().type('All');
    cy.get(`[role="tree"] [title="All"]`)
      .filter(':visible')
      .scrollIntoView()
      .click();

    cy.get('[data-testid="add-fields"]').click();
    cy.get('#metricConfiguration_1_dataType').click();
    cy.get(`.rc-virtual-list-holder-inner [title="AGG_STATE"]`)
      .filter(':visible')
      .should('have.class', 'ant-select-item-option-disabled');
    cy.get(`.rc-virtual-list-holder-inner [title="AGGREGATEFUNCTION"]`)
      .filter(':visible')
      .scrollIntoView()
      .click();
    cy.clickOutside();
    cy.get('#metricConfiguration_1_metrics').click().type('column');
    cy.get(`[role="tree"] [title="Column Count"]`).filter(':visible').click();
    cy.get(`[role="tree"] [title="Column Names"]`).filter(':visible').click();
    cy.clickOutside();

    cy.get('[data-testid="add-fields"]').click();
    cy.get('#metricConfiguration_2_dataType').click();
    cy.get(`.rc-virtual-list-holder-inner [title="ARRAY"]`)
      .filter(':visible')
      .scrollIntoView()
      .click();
    cy.get('#metricConfiguration_2_metrics').click().type('All');
    cy.get(`[role="tree"] [title="All"]`)
      .filter(':visible')
      .scrollIntoView()
      .click();
    cy.clickOutside();
    cy.get('#metricConfiguration_2_disabled').click();
    interceptURL(
      'PUT',
      '/api/v1/system/settings',
      'updateProfilerConfiguration'
    );
    cy.get('[data-testid="save-button"]').click();
    cy.wait('@updateProfilerConfiguration').then((interception) => {
      expect(interception.request.body).to.deep.eq(PROFILER_REQUEST_CONFIG);
    });
  });

  it('Remove Configuration', () => {
    visitProfilerConfigurationPage();
    cy.get('[data-testid="remove-filter-2"]').click();
    cy.get('[data-testid="remove-filter-1"]').click();
    cy.get('[data-testid="remove-filter-0"]').click();

    interceptURL(
      'PUT',
      '/api/v1/system/settings',
      'updateProfilerConfiguration'
    );
    cy.get('[data-testid="save-button"]').click();
    cy.wait('@updateProfilerConfiguration').then((interception) => {
      expect(interception.request.body).to.deep.eq(
        PROFILER_EMPTY_RESPONSE_CONFIG
      );
    });
  });

  it('permission check for non admin user', () => {
    cy.logout();
    cy.login(user.email, user.password);
    cy.sidebarClick(SidebarItem.SETTINGS);
    cy.get('[data-testid="preferences"]').should('not.exist');
    cy.logout();
  });
});
