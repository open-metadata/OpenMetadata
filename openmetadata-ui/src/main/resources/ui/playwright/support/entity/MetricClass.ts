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
import { APIRequestContext, Page } from '@playwright/test';
import { uuid } from '../../utils/common';
import { visitEntityPage } from '../../utils/entity';
import { EntityTypeEndpoint, ResponseDataType } from './Entity.interface';
import { EntityClass } from './EntityClass';

export class MetricClass extends EntityClass {
  private metricName: string;

  entity: {
    name: string;
    description: string;
    metricExpression: {
      code: string;
      language: string;
    };
    granularity: string;
    metricType: string;
    displayName: string;
    unitOfMeasurement: string;
  };

  entityResponseData: ResponseDataType = {} as ResponseDataType;

  constructor() {
    super(EntityTypeEndpoint.METRIC);

    this.metricName = `playwright-metric-${uuid()}`;

    this.entity = {
      name: this.metricName,
      description: `Total sales over the last quarter ${this.metricName}`,
      metricExpression: {
        code: 'SUM(sales)',
        language: 'SQL',
      },
      granularity: 'QUARTER',
      metricType: 'SUM',
      displayName: this.metricName,
      unitOfMeasurement: 'DOLLARS',
    };

    this.type = 'Metric';
  }

  async create(apiContext: APIRequestContext) {
    const entityResponse = await apiContext.post('/api/v1/metrics', {
      data: this.entity,
    });

    this.entityResponseData = await entityResponse.json();

    return {
      entity: entityResponse.body,
    };
  }

  get() {
    return {
      entity: this.entityResponseData,
    };
  }

  public set(data: { entity: ResponseDataType }): void {
    this.entityResponseData = data.entity;
  }

  async visitEntityPage(page: Page) {
    await visitEntityPage({
      page,
      searchTerm: this.entityResponseData?.['fullyQualifiedName'],
      dataTestId: `${this.entity.name}-${this.entity.name}`,
    });
  }

  async delete(apiContext: APIRequestContext) {
    const entityResponse = await apiContext.delete(
      `/api/v1/metrics/${this.entityResponseData?.['id']}?recursive=true&hardDelete=true`
    );

    return {
      entity: entityResponse.body,
    };
  }
}
