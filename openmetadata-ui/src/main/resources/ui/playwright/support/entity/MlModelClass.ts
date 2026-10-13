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
  okJson,
  withNotFoundRetry,
} from '../../utils/apiResponse';
import { uuid } from '../../utils/common';
import { visitEntityPageByFqn } from '../../utils/entity';
import {
  EntityTypeEndpoint,
  ResponseDataType,
  ResponseDataWithServiceType,
} from './Entity.interface';
import { EntityClass } from './EntityClass';
import { resolveParents } from './ParentResolver';
import { MlmodelServiceClass } from './service/MlmodelServiceClass';

/**
 * Without `service` the ML model sits in the shard's shared mlmodelService.
 * Pass an MlmodelServiceClass when the test needs its own service — to
 * assert on a unique service name, visit the service page, or mutate it.
 */
export type MlModelClassOptions = {
  name?: string;
  service?: MlmodelServiceClass;
  sharedInfraKey?: string;
};

export class MlModelClass extends EntityClass {
  private mlModelName: string;
  service = new MlmodelServiceClass().entity;
  private readonly serviceOverride?: MlmodelServiceClass;
  children: Array<{ name: string; dataType: string; description: string }>;
  entity: {
    name: string;
    displayName: string;
    description: string;
    service: string;
    algorithm: string;
    mlFeatures: Array<{ name: string; dataType: string; description: string }>;
  };

  serviceResponseData: ResponseDataType = {} as ResponseDataType;
  entityResponseData: ResponseDataWithServiceType =
    {} as ResponseDataWithServiceType;

  constructor(options: MlModelClassOptions = {}) {
    super(EntityTypeEndpoint.MlModel);
    this.type = 'MlModel';
    this.childrenTabId = 'features';
    this.serviceCategory = SERVICE_TYPE.MLModels;
    this.serviceType = ServiceTypes.ML_MODEL_SERVICES;
    this.serviceOverride = options.service;
    this.sharedInfraKey = options.sharedInfraKey;
    if (options.service) {
      this.service = options.service.entity;
    }

    this.mlModelName = options.name ?? `pw-mlmodel-${uuid()}`;

    this.children = [
      {
        name: `sales-${uuid()}`,
        dataType: 'numerical',
        description: 'Sales amount',
      },
      {
        name: 'persona',
        dataType: 'categorical',
        description: 'type of buyer',
      },
    ];

    this.entity = {
      name: this.mlModelName,
      displayName: this.mlModelName,
      service: this.service.name,
      algorithm: 'Time Series',
      mlFeatures: this.children,
      description: `Description for ${this.mlModelName}`,
    };

    this.childrenSelectorId = `feature-card-${this.children[0].name}`;
    this.childrenSelectorId2 = `feature-card-${this.children[1].name}`;
  }

  async create(apiContext: APIRequestContext) {
    const { parents, ownedRootPath, ownedOverride } = await resolveParents(
      apiContext,
      'mlmodel',
      { service: this.serviceOverride },
      this.sharedInfraKey
    );
    this.serviceResponseData = parents.service as ResponseDataType;
    this.adoptOwnership({ ownedRootPath, ownedOverride });
    this.service = { ...this.service, name: this.serviceResponseData.name };
    this.entity.service = this.serviceResponseData.name;

    this.entityResponseData = await createOrFetch(apiContext, {
      label: 'MlModelClass.create',
      createPath: '/api/v1/mlmodels',
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
      apiContext.patch(`/api/v1/mlmodels/${this.entityResponseData.id}`, {
        data: patchData,
        headers: {
          'Content-Type': 'application/json-patch+json',
        },
      })
    );
    this.entityResponseData = await okJson(response, 'MlModelClass.patch');

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

  async visitEntityPage(page: Page) {
    await visitEntityPageByFqn({
      page,
      endpoint: this.endpoint,
      fqn: this.entityResponseData?.fullyQualifiedName ?? '',
    });
  }

  async delete(apiContext: APIRequestContext) {
    await this.deleteOwnedOrLeaf(
      apiContext,
      `/api/v1/mlmodels/${this.entityResponseData?.id}`
    );

    return { entity: this.entityResponseData };
  }
}
