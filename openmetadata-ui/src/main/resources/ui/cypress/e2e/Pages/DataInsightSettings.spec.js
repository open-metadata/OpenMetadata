/*
 *  Copyright 2023 Collate.
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
import { BASE_URL } from '../../constants/constants';

const PIPELINE_NAME = 'cypress_dataInsight_pipeline';

// NOTE: need to re-write the test based on new UI
describe.skip('Data Insight settings page should work properly', () => {
  beforeEach(() => {
    cy.login();
    interceptURL('GET', '/api/v1/teams/name/*', 'settingsPage');

    cy.get('[data-testid="app-bar-item-settings"]').click();
    verifyResponseStatusCode('@settingsPage', 200);
    cy.get('[data-testid="settings-left-panel"]').should('be.visible');

    interceptURL(
      'GET',
      'api/v1/services/ingestionPipelines?fields=pipelineStatuses&service=OpenMetadata&pipelineType=dataInsight',
      'ingestionPipelines'
    );
    interceptURL(
      'GET',
      '/api/v1/services/ingestionPipelines/OpenMetadata.OpenMetadata_dataInsight/pipelineStatus?startTs=*',
      'pipelineStatus'
    );

    cy.get(`[data-menu-id*="openMetadata.dataInsight"]`)
      .scrollIntoView()
      .click();

    verifyResponseStatusCode('@ingestionPipelines', 200);
    verifyResponseStatusCode('@pipelineStatus', 200);
  });

  it('Add data insight pipeline should work properly', () => {
    interceptURL(
      'GET',
      '/api/v1/services/metadataServices/name/OpenMetadata',
      'serviceDetails'
    );

    cy.get('[data-testid="add-new-ingestion-button"]').click();

    verifyResponseStatusCode('@serviceDetails', 200);

    cy.get('#root\\/name').clear().type(PIPELINE_NAME);

    cy.get('[data-testid="submit-btn"]').click();

    interceptURL(
      'POST',
      '/api/v1/services/ingestionPipelines',
      'postIngestionPipeline'
    );

    cy.get('[data-testid="deploy-button"]').click();

    cy.wait('@postIngestionPipeline').then(({ request, response }) => {
      expect(request.body.loggerLevel).to.equal('INFO');

      expect(response.statusCode).to.equal(201);
    });

    cy.get('[data-testid="view-service-button"]').click();

    verifyResponseStatusCode('@ingestionPipelines', 200);
    verifyResponseStatusCode('@pipelineStatus', 200);

    cy.get(`[data-row-key="${PIPELINE_NAME}"]`).should('be.visible');
  });

  it('Edit data insight pipeline should work properly', () => {
    interceptURL(
      'GET',
      '/api/v1/services/metadataServices/name/OpenMetadata',
      'serviceDetails'
    );

    cy.get(`[data-row-key="${PIPELINE_NAME}"] [data-testid="edit"]`).click();

    verifyResponseStatusCode('@serviceDetails', 200);

    cy.get('#root\\/enableDebugLog').click({ waitForAnimations: true });

    cy.get('#root\\/enableDebugLog')
      .invoke('attr', 'aria-checked')
      .should('eq', 'true');

    cy.get('[data-testid="submit-btn"]').click();

    interceptURL(
      'PUT',
      '/api/v1/services/ingestionPipelines',
      'putIngestionPipeline'
    );

    cy.get('[data-testid="deploy-button"]').click();

    cy.wait('@putIngestionPipeline').then(({ request, response }) => {
      expect(request.body.loggerLevel).to.equal('DEBUG');

      expect(response.statusCode).to.equal(200);
    });

    cy.get('[data-testid="view-service-button"]').click();

    verifyResponseStatusCode('@ingestionPipelines', 200);
    verifyResponseStatusCode('@pipelineStatus', 200);

    cy.get(`[data-row-key="${PIPELINE_NAME}"]`).should('be.visible');
  });

  it('Run and kill data insight pipeline should work properly', () => {
    interceptURL(
      'POST',
      '/api/v1/services/ingestionPipelines/trigger/*',
      'runPipelineDag'
    );
    cy.get(`[data-row-key="${PIPELINE_NAME}"] [data-testid="run"]`).click();

    verifyResponseStatusCode('@runPipelineDag', 200);
    interceptURL(
      'POST',
      '/api/v1/services/ingestionPipelines/kill/*',
      'killPipelineDag'
    );
    cy.get(`[data-row-key="${PIPELINE_NAME}"] [data-testid="kill"]`).click();

    cy.get('[data-testid="kill-modal"]').contains('Confirm').click();

    verifyResponseStatusCode('@killPipelineDag', 200);
  });

  it('Re deploy data insight pipeline should work properly', () => {
    interceptURL(
      'POST',
      '/api/v1/services/ingestionPipelines/deploy/*',
      'reDeployPipelineDag'
    );
    cy.get(
      `[data-row-key="${PIPELINE_NAME}"] [data-testid="re-deploy-btn"]`
    ).click();

    verifyResponseStatusCode('@reDeployPipelineDag', 200);
  });

  it('Pause and unpause data insight pipeline should work properly', () => {
    interceptURL(
      'POST',
      '/api/v1/services/ingestionPipelines/toggleIngestion/*',
      'togglePipelineDag'
    );
    cy.get(`[data-row-key="${PIPELINE_NAME}"] [data-testid="pause"]`).click();

    verifyResponseStatusCode('@togglePipelineDag', 200);

    cy.get(`[data-row-key="${PIPELINE_NAME}"] [data-testid="unpause"]`).click();

    verifyResponseStatusCode('@togglePipelineDag', 200);
  });

  it('Logs action button for the data insight pipeline should redirect to the logs page', () => {
    interceptURL(
      'GET',
      `/api/v1/services/ingestionPipelines/name/OpenMetadata.${PIPELINE_NAME}?fields=owner,pipelineStatuses`,
      'getServiceDetails'
    );
    interceptURL(
      'GET',
      '/api/v1/services/ingestionPipelines/logs/*/*last?after=',
      'getLogs'
    );
    interceptURL(
      'GET',
      `/api/v1/services/ingestionPipelines/OpenMetadata.cypress_dataInsight_pipeline/pipelineStatus?*`,
      'getPipelineStatus'
    );
    cy.get(`[data-row-key="${PIPELINE_NAME}"] [data-testid="logs"]`).click();

    verifyResponseStatusCode('@getServiceDetails', 200);
    verifyResponseStatusCode('@getLogs', 200);
    verifyResponseStatusCode('@getPipelineStatus', 200);

    cy.url().should(
      'eq',
      `${BASE_URL}/metadataServices/OpenMetadata.${PIPELINE_NAME}/logs`
    );
  });

  it('Delete data insight pipeline should work properly', () => {
    interceptURL(
      'DELETE',
      '/api/v1/services/ingestionPipelines/*?hardDelete=true',
      'deletePipelineDag'
    );
    cy.get(`[data-row-key="${PIPELINE_NAME}"] [data-testid="delete"]`).click();

    cy.get('[data-testid="confirmation-text-input"]').type('DELETE');

    cy.get('[data-testid="confirm-button"]').click();

    verifyResponseStatusCode('@deletePipelineDag', 200);
  });
});
