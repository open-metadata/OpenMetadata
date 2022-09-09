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

import { deleteCreatedService, editOwnerforCreatedService, goToAddNewServicePage, testServiceCreationAndIngestion, uuid } from '../../common/common';
import { SERVICE_TYPE } from '../../constants/constants';

const serviceType = 'Kafka';
const serviceName = `${serviceType}-ct-test-${uuid()}`;

describe('Kafka Ingestion', () => {
  it('add and ingest data', () => {
    goToAddNewServicePage(SERVICE_TYPE.Messaging);

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
        cy.get('[data-testid="topic-filter-pattern-checkbox"]').should("be.visible").check()
        cy.get('[data-testid="filter-pattern-includes-topic"]').should("be.visible").type("__consumer_offsets")
    };

    testServiceCreationAndIngestion(
      'Kafka',
      connectionInput,
      addIngestionInput,
      serviceName,
      'messaging'
    );
  });

  it('Edit and validate owner', () => {
    editOwnerforCreatedService(SERVICE_TYPE.Messaging, serviceName);
  });

  it('delete created service', () => {
    deleteCreatedService(SERVICE_TYPE.Messaging, serviceName);
  });
});
