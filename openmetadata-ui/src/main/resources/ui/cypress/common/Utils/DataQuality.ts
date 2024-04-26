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
import { uuid } from '../../constants/constants';
import { EntityType } from '../../constants/Entity.interface';
import { DATABASE_SERVICE } from '../../constants/EntityConstant';
import { interceptURL, verifyResponseStatusCode } from '../common';
import { generateRandomTable } from '../EntityUtils';
import { visitEntityDetailsPage } from './Entity';

const tableFqn = `${DATABASE_SERVICE.entity.databaseSchema}.${DATABASE_SERVICE.entity.name}`;

const testSuite = {
  name: `${tableFqn}.testSuite`,
  executableEntityReference: tableFqn,
};
const testCase1 = {
  name: `user_tokens_table_column_name_to_exist_${uuid()}`,
  entityLink: `<#E::table::${testSuite.executableEntityReference}>`,
  parameterValues: [{ name: 'columnName', value: 'id' }],
  testDefinition: 'tableColumnNameToExist',
  description: 'test case description',
  testSuite: testSuite.name,
};
const testCase2 = {
  name: `email_column_values_to_be_in_set_${uuid()}`,
  entityLink: `<#E::table::${testSuite.executableEntityReference}::columns::email>`,
  parameterValues: [
    { name: 'allowedValues', value: '["gmail","yahoo","collate"]' },
  ],
  testDefinition: 'columnValuesToBeInSet',
  testSuite: testSuite.name,
};
const filterTable = generateRandomTable();

const filterTableFqn = `${filterTable.databaseSchema}.${filterTable.name}`;
const filterTableTestSuite = {
  name: `${filterTableFqn}.testSuite`,
  executableEntityReference: filterTableFqn,
};
const testCases = [
  `cy_first_table_column_count_to_be_between_${uuid()}`,
  `cy_second_table_column_count_to_be_between_${uuid()}`,
  `cy_third_table_column_count_to_be_between_${uuid()}`,
];

export const DATA_QUALITY_TEST_CASE_DATA = {
  testCase1,
  testCase2,
  filterTable,
  filterTableTestCases: testCases,
};

const verifyPipelineSuccessStatus = (time = 20000) => {
  const newTime = time / 2;
  interceptURL('GET', '/api/v1/tables/name/*?*testSuite*', 'testSuite');
  interceptURL(
    'GET',
    '/api/v1/services/ingestionPipelines/*/pipelineStatus?startTs=*&endTs=*',
    'pipelineStatus'
  );
  cy.wait(time);
  cy.reload();
  verifyResponseStatusCode('@testSuite', 200);
  cy.get('[id*="tab-pipeline"]').click();
  verifyResponseStatusCode('@pipelineStatus', 200);
  cy.get('[data-testid="pipeline-status"]').then(($el) => {
    const text = $el.text();
    if (text !== 'Success' && text !== 'Failed' && newTime > 0) {
      verifyPipelineSuccessStatus(newTime);
    } else {
      cy.get('[data-testid="pipeline-status"]').should('contain', 'Success');
    }
  });
};

export const triggerTestCasePipeline = ({
  serviceName,
  tableName,
}: {
  serviceName: string;
  tableName: string;
}) => {
  interceptURL('GET', `/api/v1/tables/*/systemProfile?*`, 'systemProfile');
  interceptURL('GET', `/api/v1/tables/*/tableProfile?*`, 'tableProfile');

  interceptURL(
    'GET',
    `api/v1/tables/name/${serviceName}.*.${tableName}?fields=*&include=all`,
    'waitForPageLoad'
  );
  visitEntityDetailsPage({
    term: tableName,
    serviceName: serviceName,
    entity: EntityType.Table,
  });
  verifyResponseStatusCode('@waitForPageLoad', 200);

  cy.get('[data-testid="profiler"]').should('be.visible').click();

  interceptURL(
    'GET',
    `api/v1/tables/name/${serviceName}.*.${tableName}?include=all`,
    'addTableTestPage'
  );
  verifyResponseStatusCode('@systemProfile', 200);
  verifyResponseStatusCode('@tableProfile', 200);
  interceptURL('GET', '/api/v1/dataQuality/testCases?fields=*', 'testCase');
  cy.get('[data-testid="profiler-tab-left-panel"]')
    .contains('Data Quality')
    .click();
  verifyResponseStatusCode('@testCase', 200);

  interceptURL(
    'GET',
    '/api/v1/services/ingestionPipelines/*/pipelineStatus?startTs=*&endTs=*',
    'getPipelineStatus'
  );
  interceptURL(
    'POST',
    '/api/v1/services/ingestionPipelines/trigger/*',
    'triggerPipeline'
  );
  cy.get('[id*="tab-pipeline"]').click();
  verifyResponseStatusCode('@getPipelineStatus', 200);
  cy.get('[data-testid="run"]').click();
  cy.wait('@triggerPipeline');
  verifyPipelineSuccessStatus();
};

export const prepareDataQualityTestCases = (token: string) => {
  cy.request({
    method: 'POST',
    url: `/api/v1/dataQuality/testSuites/executable`,
    headers: { Authorization: `Bearer ${token}` },
    body: testSuite,
  }).then((testSuiteResponse) => {
    cy.request({
      method: 'POST',
      url: `/api/v1/dataQuality/testCases`,
      headers: { Authorization: `Bearer ${token}` },
      body: testCase1,
    });
    cy.request({
      method: 'POST',
      url: `/api/v1/dataQuality/testCases`,
      headers: { Authorization: `Bearer ${token}` },
      body: testCase2,
    });

    cy.request({
      method: 'POST',
      url: `/api/v1/services/ingestionPipelines`,
      headers: { Authorization: `Bearer ${token}` },
      body: {
        airflowConfig: {},
        name: `${testSuite.executableEntityReference}_test_suite`,
        pipelineType: 'TestSuite',
        service: {
          id: testSuiteResponse.body.id,
          type: 'testSuite',
        },
        sourceConfig: {
          config: {
            type: 'TestSuite',
            entityFullyQualifiedName: testSuite.executableEntityReference,
          },
        },
      },
    }).then((response) =>
      cy.request({
        method: 'POST',
        url: `/api/v1/services/ingestionPipelines/deploy/${response.body.id}`,
        headers: { Authorization: `Bearer ${token}` },
      })
    );
  });

  cy.request({
    method: 'POST',
    url: `/api/v1/dataQuality/testSuites/executable`,
    headers: { Authorization: `Bearer ${token}` },
    body: filterTableTestSuite,
  }).then((testSuiteResponse) => {
    // creating test case

    testCases.forEach((testCase) => {
      cy.request({
        method: 'POST',
        url: `/api/v1/dataQuality/testCases`,
        headers: { Authorization: `Bearer ${token}` },
        body: {
          name: testCase,
          entityLink: `<#E::table::${filterTableTestSuite.executableEntityReference}>`,
          parameterValues: [
            { name: 'minColValue', value: 12 },
            { name: 'maxColValue', value: 24 },
          ],
          testDefinition: 'tableColumnCountToBeBetween',
          testSuite: filterTableTestSuite.name,
        },
      });
    });
    cy.request({
      method: 'POST',
      url: `/api/v1/services/ingestionPipelines`,
      headers: { Authorization: `Bearer ${token}` },
      body: {
        airflowConfig: {},
        name: `${filterTableTestSuite.executableEntityReference}_test_suite`,
        pipelineType: 'TestSuite',
        service: {
          id: testSuiteResponse.body.id,
          type: 'testSuite',
        },
        sourceConfig: {
          config: {
            type: 'TestSuite',
            entityFullyQualifiedName:
              filterTableTestSuite.executableEntityReference,
          },
        },
      },
    }).then((response) =>
      cy.request({
        method: 'POST',
        url: `/api/v1/services/ingestionPipelines/deploy/${response.body.id}`,
        headers: { Authorization: `Bearer ${token}` },
      })
    );
  });

  triggerTestCasePipeline({
    serviceName: DATABASE_SERVICE.service.name,
    tableName: filterTable.name,
  });
};
