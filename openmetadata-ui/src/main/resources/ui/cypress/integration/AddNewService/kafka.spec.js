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

import { deleteCreatedService, goToAddNewServicePage, testServiceCreationAndIngestion, uuid } from '../../common/common';

const serviceType = 'Kafka';
const serviceName = `${serviceType}-ct-test-${uuid()}`;

describe('Kafka Ingestion', () => {
  it('add and ingest data', () => {
    goToAddNewServicePage();

    // Select Dashboard services
    cy.get('[data-testid="service-category"]').select('messagingServices');

    const connectionInput = () => {
      cy.get('#root_bootstrapServers').type(
        Cypress.env('kafkaBootstrapServers')
      );
      cy.get('#root_schemaRegistryURL').type(
        Cypress.env('kafkaSchemaRegistryUrl')
      );
    };

    const addIngestionInput = () => {
      // no filters
    };

    testServiceCreationAndIngestion(
      'Kafka',
      connectionInput,
      addIngestionInput,
      serviceName,
      'messaging'
    );
  });

  it('delete created service', () => {
    deleteCreatedService('Messaging', serviceName);
  });
});
