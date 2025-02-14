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
import { Operation } from 'fast-json-patch';
import { SERVICE_TYPE } from '../../constant/service';
import { ServiceTypes } from '../../constant/settings';
import { uuid } from '../../utils/common';
import { visitEntityPage } from '../../utils/entity';
import {
  EntityTypeEndpoint,
  ResponseDataType,
  ResponseDataWithServiceType,
} from './Entity.interface';
import { EntityClass } from './EntityClass';

export class PipelineClass extends EntityClass {
  private pipelineName = `pw-pipeline-${uuid()}`;
  service = {
    name: `pw-pipeline-service-${uuid()}`,
    serviceType: 'Dagster',
    connection: {
      config: {
        type: 'Dagster',
        host: 'admin',
        token: 'admin',
        timeout: '1000',
        supportsMetadataExtraction: true,
      },
    },
  };

  children = [
    { name: 'snowflake_task', displayName: 'Snowflake Task' },
    { name: 'presto_task', displayName: 'Presto Task' },
  ];

  entity = {
    name: this.pipelineName,
    displayName: this.pipelineName,
    service: this.service.name,
    tasks: this.children,
  };

  serviceResponseData: ResponseDataType = {} as ResponseDataType;
  entityResponseData: ResponseDataWithServiceType =
    {} as ResponseDataWithServiceType;
  ingestionPipelineResponseData: ResponseDataType = {} as ResponseDataType;

  constructor(name?: string) {
    super(EntityTypeEndpoint.Pipeline);
    this.service.name = name ?? this.service.name;
    this.type = 'Pipeline';
    this.childrenTabId = 'tasks';
    this.childrenSelectorId = this.children[0].name;
    this.serviceCategory = SERVICE_TYPE.Pipeline;
    this.serviceType = ServiceTypes.PIPELINE_SERVICES;
  }

  async create(apiContext: APIRequestContext) {
    const serviceResponse = await apiContext.post(
      '/api/v1/services/pipelineServices',
      {
        data: this.service,
      }
    );
    const entityResponse = await apiContext.post('/api/v1/pipelines', {
      data: this.entity,
    });

    this.serviceResponseData = await serviceResponse.json();
    this.entityResponseData = await entityResponse.json();

    return {
      service: serviceResponse.body,
      entity: entityResponse.body,
    };
  }

  async patch({
    apiContext,
    patchData,
  }: {
    apiContext: APIRequestContext;
    patchData: Operation[];
  }) {
    const response = await apiContext.patch(
      `/api/v1/pipelines/name/${this.entityResponseData?.['fullyQualifiedName']}`,
      {
        data: patchData,
        headers: {
          'Content-Type': 'application/json-patch+json',
        },
      }
    );

    this.entityResponseData = await response.json();

    return {
      entity: this.entityResponseData,
    };
  }

  async get() {
    return {
      service: this.serviceResponseData,
      entity: this.entityResponseData,
    };
  }

  async createIngestionPipeline(apiContext: APIRequestContext, name?: string) {
    const ingestionPipelineResponse = await apiContext.post(
      '/api/v1/services/ingestionPipelines',
      {
        data: {
          airflowConfig: {},
          loggerLevel: 'INFO',
          name: name ?? `pw-ingestion-pipeline-${uuid()}`,
          pipelineType: 'metadata',
          service: {
            id: this.serviceResponseData.id,
            type: 'pipelineService',
          },
          sourceConfig: {
            config: {},
          },
        },
      }
    );

    this.ingestionPipelineResponseData = await ingestionPipelineResponse.json();

    return {
      ingestionPipeline: await ingestionPipelineResponse.json(),
    };
  }

  async visitEntityPage(page: Page) {
    await visitEntityPage({
      page,
      searchTerm: this.entityResponseData?.['fullyQualifiedName'],
      dataTestId: `${this.service.name}-${this.entity.name}`,
    });
  }

  async delete(apiContext: APIRequestContext) {
    const serviceResponse = await apiContext.delete(
      `/api/v1/services/pipelineServices/name/${encodeURIComponent(
        this.serviceResponseData?.['fullyQualifiedName']
      )}?recursive=true&hardDelete=true`
    );

    return {
      service: serviceResponse.body,
      entity: this.entityResponseData,
    };
  }
}
