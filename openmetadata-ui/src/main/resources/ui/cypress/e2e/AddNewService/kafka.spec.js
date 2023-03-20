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
  deleteCreatedService,
  editOwnerforCreatedService,
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
      cy.get('#bootstrapServers').type(Cypress.env('kafkaBootstrapServers'));
      cy.get('#schemaRegistryURL').type(Cypress.env('kafkaSchemaRegistryUrl'));
    };

    const addIngestionInput = () => {
      cy.get('[data-testid="topic-filter-pattern-checkbox"]')
        .invoke('show')
        .trigger('mouseover')
        .check();
      cy.get('[data-testid="filter-pattern-includes-topic"]')
        .should('be.visible')
        .type(topicName);
    };

    testServiceCreationAndIngestion(
      'Kafka',
      connectionInput,
      addIngestionInput,
      serviceName,
      'messaging'
    );
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

  it('Edit and validate owner', () => {
    editOwnerforCreatedService(
      SERVICE_TYPE.Messaging,
      serviceName,
      API_SERVICE.messagingServices
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
