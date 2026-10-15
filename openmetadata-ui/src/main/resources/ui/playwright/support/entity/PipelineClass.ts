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
import {
  createOrFetch,
  deleteFixtureEntity,
  okJson,
  withNotFoundRetry,
} from '../../utils/apiResponse';
import { uuid } from '../../utils/common';
import { visitEntityPageByFqn } from '../../utils/entity';
import {
  EntityReference,
  EntityTypeEndpoint,
  ResponseDataType,
  ResponseDataWithServiceType,
} from './Entity.interface';
import { EntityClass } from './EntityClass';
import { resolveParents } from './ParentResolver';
import { PipelineServiceClass } from './service/PipelineServiceClass';

/**
 * Without `service` the pipeline sits in the shard's shared pipelineService.
 * Pass a PipelineServiceClass when the test needs its own service — to
 * assert on a unique service name, visit the service page, or mutate it.
 */
export type PipelineClassOptions = {
  name?: string;
  tasks?: Array<{ name: string; displayName: string }>;
  service?: PipelineServiceClass;
  sharedInfraKey?: string;
};

export interface PipelineType extends ResponseDataWithServiceType {
  tasks?: Array<EntityReference>;
}
export class PipelineClass extends EntityClass {
  private pipelineName: string;
  service = new PipelineServiceClass().entity;
  private readonly serviceOverride?: PipelineServiceClass;
  children: Array<{ name: string; displayName: string }>;
  entity: {
    name: string;
    displayName: string;
    service: string;
    description: string;
    tasks: Array<{ name: string; displayName: string }>;
  };

  serviceResponseData: ResponseDataType = {} as ResponseDataType;
  entityResponseData: PipelineType = {} as PipelineType;
  ingestionPipelineResponseData: ResponseDataType = {} as ResponseDataType;

  constructor(options: PipelineClassOptions = {}) {
    super(EntityTypeEndpoint.Pipeline);
    this.type = 'Pipeline';
    this.childrenTabId = 'tasks';
    this.serviceCategory = SERVICE_TYPE.Pipeline;
    this.serviceType = ServiceTypes.PIPELINE_SERVICES;
    this.serviceOverride = options.service;
    this.sharedInfraKey = options.sharedInfraKey;
    if (options.service) {
      this.service = options.service.entity;
    }

    this.pipelineName = options.name ?? `pw-pipeline-${uuid()}`;

    this.children = options.tasks ?? [
      { name: 'snowflake_task', displayName: 'Snowflake Task' },
      { name: 'presto_task', displayName: 'Presto Task' },
    ];

    this.entity = {
      name: this.pipelineName,
      displayName: this.pipelineName,
      service: this.service.name,
      tasks: this.children,
      description: `Description for ${this.pipelineName}`,
    };

    this.childrenSelectorId = this.children[0].name;
  }

  async create(apiContext: APIRequestContext) {
    const { parents, ownedRootPath, ownedOverride } = await resolveParents(
      apiContext,
      'pipeline',
      { service: this.serviceOverride },
      this.sharedInfraKey
    );
    this.serviceResponseData = parents.service as ResponseDataType;
    this.adoptOwnership({ ownedRootPath, ownedOverride });
    this.service = { ...this.service, name: this.serviceResponseData.name };
    this.entity.service = this.serviceResponseData.name;

    this.entityResponseData = await createOrFetch(apiContext, {
      label: 'PipelineClass.create pipeline',
      createPath: '/api/v1/pipelines',
      fqnSegments: [this.service.name, this.entity.name],
      data: this.entity,
    });

    return {
      service: this.serviceResponseData,
      entity: this.entityResponseData,
    };
  }

  async patch({
    apiContext,
    patchData,
  }: {
    apiContext: APIRequestContext;
    patchData: Operation[];
  }) {
    const response = await withNotFoundRetry(() =>
      apiContext.patch(
        `/api/v1/pipelines/name/${this.entityResponseData?.['fullyQualifiedName']}`,
        {
          data: patchData,
          headers: {
            'Content-Type': 'application/json-patch+json',
          },
        }
      )
    );
    this.entityResponseData = await okJson(response, 'PipelineClass.patch');

    return {
      entity: this.entityResponseData,
    };
  }

  get() {
    return {
      service: this.serviceResponseData,
      entity: this.entityResponseData,
      ownedRootPath: this.ownedRootPath,
    };
  }

  public set(data: {
    entity: ResponseDataWithServiceType;
    service: ResponseDataType;
    ownedRootPath?: string;
  }): void {
    this.entityResponseData = data.entity;
    this.serviceResponseData = data.service;
    this.ownedRootPath = data.ownedRootPath;
    this.entity.name = data.entity.name;
    this.entity.service = data.service.name;
    this.service = { ...this.service, name: data.service.name };
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
            config: {
              type: 'PipelineMetadata',
            },
          },
        },
      }
    );

    this.ingestionPipelineResponseData = await okJson(
      ingestionPipelineResponse,
      'PipelineClass.createIngestionPipeline'
    );

    return {
      ingestionPipeline: await okJson(
        ingestionPipelineResponse,
        'PipelineClass.createIngestionPipeline'
      ),
    };
  }

  async visitEntityPage(page: Page) {
    await visitEntityPageByFqn({
      page,
      endpoint: this.endpoint,
      fqn: this.entityResponseData?.fullyQualifiedName ?? '',
    });
  }

  async delete(apiContext: APIRequestContext) {
    // The ingestion pipeline is a child of the service, not of the pipeline,
    // so the recursive pipeline delete below never reaches it — and in the
    // shared service it would outlive the test and collide with the next one.
    if (this.ingestionPipelineResponseData.id) {
      await deleteFixtureEntity(
        apiContext,
        `/api/v1/services/ingestionPipelines/${this.ingestionPipelineResponseData.id}?hardDelete=true`
      );
      this.ingestionPipelineResponseData = {} as ResponseDataType;
    }

    await this.deleteOwnedOrLeaf(
      apiContext,
      `/api/v1/pipelines/${this.entityResponseData?.id}`
    );

    return { entity: this.entityResponseData };
  }
}
