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
import { checkServiceFieldSectionHighlighting } from '../common';
import ServiceBaseClass from '../Entities/ServiceBaseClass';
import { Services } from '../Utils/Services';

class KafkaIngestionClass extends ServiceBaseClass {
  constructor() {
    super(Services.Messaging, 'cypress-Kafka', 'Kafka', '__transaction_state');
  }

  createService() {
    super.createService();
  }

  updateService() {
    super.updateService();
  }

  fillConnectionDetails() {
    cy.get('#root\\/bootstrapServers').type(
      Cypress.env('kafkaBootstrapServers')
    );
    checkServiceFieldSectionHighlighting('bootstrapServers');
    cy.get('#root\\/schemaRegistryURL').type(
      Cypress.env('kafkaSchemaRegistryUrl')
    );
    checkServiceFieldSectionHighlighting('schemaRegistryURL');
  }

  fillIngestionDetails() {
    cy.get('#root\\/topicFilterPattern\\/includes')
      .scrollIntoView()
      .type(`${this.entityName}{enter}`);
  }

  deleteService() {
    super.deleteService();
  }
}

export default KafkaIngestionClass;
