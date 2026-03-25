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

import { Page } from '@playwright/test';
import { uuid } from '../../../utils/common';

import {
  checkServiceFieldSectionHighlighting,
  Services,
} from '../../../utils/serviceIngestion';
import ServiceBaseClass from './ServiceBaseClass';

class KafkaIngestionClass extends ServiceBaseClass {
  constructor(extraParams?: {
    shouldTestConnection?: boolean;
    shouldAddIngestion?: boolean;
    shouldAddDefaultFilters?: boolean;
  }) {
    const {
      shouldTestConnection = true,
      shouldAddIngestion = true,
      shouldAddDefaultFilters = false,
    } = extraParams ?? {};

    super(
      Services.Messaging,
      `pw-kafka-with-%-${uuid()}`,
      'Kafka',
      '__transaction_state',
      shouldTestConnection,
      shouldAddIngestion,
      shouldAddDefaultFilters
    );
  }

  async createService(page: Page) {
    await super.createService(page);
  }

  async updateService(page: Page) {
    await super.updateService(page);
  }

  async fillConnectionDetails(page: Page) {
    const kafkaBootstrapServers =
      process.env.PLAYWRIGHT_KAFKA_BOOTSTRAP_SERVERS ?? '';
    const kafkaSchemaRegistryUrl =
      process.env.PLAYWRIGHT_KAFKA_SCHEMA_REGISTRY_URL ?? '';

    await page.fill('#root\\/bootstrapServers', kafkaBootstrapServers);
    await checkServiceFieldSectionHighlighting(page, 'bootstrapServers');
    await page.fill('#root\\/schemaRegistryURL', kafkaSchemaRegistryUrl);
    await checkServiceFieldSectionHighlighting(page, 'schemaRegistryURL');
  }

  async fillIngestionDetails(page: Page) {
    await page
      .locator('#root\\/topicFilterPattern\\/includes')
      .fill(this.entityName);

    await page.locator('#root\\/topicFilterPattern\\/includes').press('Enter');
  }

  async deleteService(page: Page) {
    await super.deleteService(page);
  }
}

export default KafkaIngestionClass;
