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
  checkServiceFieldSectionHighlighting,
  deleteCreatedService,
  goToAddNewServicePage,
  testServiceCreationAndIngestion,
  updateDescriptionForIngestedTables,
  uuid,
} from '../../common/common';
import { API_SERVICE, SERVICE_TYPE } from '../../constants/constants';

const serviceType = 'Kafka';
const serviceName = `${serviceType}-ct-test-${uuid()}`;
const topicName = '__transaction_state';
const description = `This is ${serviceName} description`;

describe('Kafka Ingestion', () => {
  beforeEach(() => {
    cy.login();
  });

  it('add and ingest data', () => {
    goToAddNewServicePage(SERVICE_TYPE.Messaging);

    // Select Dashboard services
    cy.get('[data-testid="service-category"]').should('be.visible').click();
    cy.get('.ant-select-item-option-content')
      .contains('Messaging Services')
      .click();

    const connectionInput = () => {
      cy.get('#root\\/bootstrapServers').type(
        Cypress.env('kafkaBootstrapServers')
      );
      checkServiceFieldSectionHighlighting('bootstrapServers');
      cy.get('#root\\/schemaRegistryURL').type(
        Cypress.env('kafkaSchemaRegistryUrl')
      );
      checkServiceFieldSectionHighlighting('schemaRegistryURL');
    };

    const addIngestionInput = () => {
      cy.get('#root\\/topicFilterPattern\\/includes')
        .scrollIntoView()

        .type(`${topicName}{enter}`);
    };

    testServiceCreationAndIngestion({
      serviceType: 'Kafka',
      connectionInput,
      addIngestionInput,
      serviceName,
      type: 'messaging',
      serviceCategory: SERVICE_TYPE.Messaging,
    });
  });

  it('Update table description and verify description after re-run', () => {
    updateDescriptionForIngestedTables(
      serviceName,
      topicName,
      description,
      SERVICE_TYPE.Messaging,
      'topics'
    );
  });

  it('delete created service', () => {
    deleteCreatedService(
      SERVICE_TYPE.Messaging,
      serviceName,
      API_SERVICE.messagingServices
    );
  });
});
