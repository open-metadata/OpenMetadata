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
import { interceptURL, verifyResponseStatusCode } from '../../common/common';
import { GlobalSettingOptions } from '../../constants/settings.constant';

describe('Health Check for Openmetadata', () => {
  before(() => {
    cy.login();
  });

  it('All 5 checks should be successful', () => {
    interceptURL('GET', '/api/v1/system/status', 'getOMStatus');

    cy.settingClick(GlobalSettingOptions.OM_HEALTH);

    verifyResponseStatusCode('@getOMStatus', 200);

    cy.get('[data-testid="database"] .success-status').should(
      'have.text',
      'Success'
    );
    cy.get('[data-testid="searchInstance"] .success-status').should(
      'have.text',
      'Success'
    );
    cy.get('[data-testid="pipelineServiceClient"] .success-status').should(
      'have.text',
      'Success'
    );
    cy.get('[data-testid="jwks"] .success-status').should(
      'have.text',
      'Success'
    );
    cy.get('[data-testid="migrations"] .success-status').should(
      'have.text',
      'Success'
    );
  });
});
