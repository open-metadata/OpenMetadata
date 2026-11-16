/*
 *  Copyright 2025 Collate.
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
/*
 *  Copyright 2024 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this spreadsheet except in compliance with the License.
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
import type { ParentNode, ParentSnapshot } from './ParentChain';
import { parentDeletePath } from './ParentChain';
import { resolveParents } from './ParentResolver';
import { DriveServiceClass } from './service/DriveServiceClass';

/**
 * Without `service` the spreadsheet sits in the shard's shared drive service.
 * Pass a DriveServiceClass when the test visits, mutates or asserts on the
 * service itself (service page, service-level cascade, unique service name).
 */
export type SpreadsheetClassOptions = {
  name?: string;
  service?: DriveServiceClass;
  sharedInfraKey?: string;
};

export class SpreadsheetClass extends EntityClass implements ParentNode {
  readonly parentLevel = 'spreadsheet' as const;
  private readonly serviceOverride?: DriveServiceClass;
  service: DriveServiceClass['entity'];
  entity: {
    name: string;
    displayName: string;
    description: string;
    service: string;
  };

  serviceResponseData: ResponseDataType = {} as ResponseDataType;
  entityResponseData: ResponseDataWithServiceType =
    {} as ResponseDataWithServiceType;

  constructor(options: SpreadsheetClassOptions = {}) {
    super(EntityTypeEndpoint.Spreadsheet);
    this.type = 'Spreadsheet';
    this.serviceCategory = SERVICE_TYPE.DriveService;
    this.serviceType = ServiceTypes.DRIVE_SERVICES;
    this.serviceOverride = options.service;
    this.sharedInfraKey = options.sharedInfraKey;
    this.service = options.service?.entity ?? new DriveServiceClass().entity;
    const name = options.name ?? `pw-spreadsheet-${uuid()}`;
    this.entity = {
      name,
      displayName: name,
      description: 'description',
      service: this.service.name,
    };
    this.childrenSelectorId = `${this.service.name}.${this.entity.name}`;
  }

  private bindServiceName(serviceName: string) {
    this.service = { ...this.service, name: serviceName };
    this.entity.service = serviceName;
    this.childrenSelectorId = `${serviceName}.${this.entity.name}`;
  }

  async create(apiContext: APIRequestContext) {
    const { parents, ownedRootPath, ownedOverride } = await resolveParents(
      apiContext,
      'drive',
      { service: this.serviceOverride },
      this.sharedInfraKey
    );
    const service = parents.service as ResponseDataType;
    this.adoptOwnership({ ownedRootPath, ownedOverride });
    this.bindServiceName(service.name);
    this.serviceResponseData = service;

    this.entityResponseData = await createOrFetch(apiContext, {
      label: 'SpreadsheetClass.create spreadsheet',
      createPath: `/api/v1/${EntityTypeEndpoint.Spreadsheet}`,
      fqnSegments: [service.name, this.entity.name],
      data: {
        name: this.entity.name,
        description: this.entity.description,
        service: service.fullyQualifiedName,
      },
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
        `/api/v1/${EntityTypeEndpoint.Spreadsheet}/name/${this.entityResponseData.fullyQualifiedName}`,
        {
          data: patchData,
          headers: {
            'Content-Type': 'application/json-patch+json',
          },
        }
      )
    );
    this.entityResponseData = await okJson(response, 'SpreadsheetClass.patch');

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
    this.bindServiceName(data.service.name);
  }

  isCreated() {
    return Boolean(this.entityResponseData?.id);
  }

  forget() {
    this.entityResponseData = {} as typeof this.entityResponseData;
    this.forgetOwnership();
  }

  parentSnapshot(): ParentSnapshot {
    return {
      service: this.serviceResponseData,
      spreadsheet: this.entityResponseData,
    };
  }

  rootDeletePath() {
    return this.ownedRootPath ?? this.spreadsheetPath();
  }

  private spreadsheetPath() {
    return parentDeletePath(
      EntityTypeEndpoint.Spreadsheet,
      this.entityResponseData?.fullyQualifiedName ?? ''
    );
  }

  async visitEntityPage(page: Page) {
    await visitEntityPageByFqn({
      page,
      endpoint: this.endpoint,
      fqn: this.entityResponseData?.fullyQualifiedName ?? '',
    });
  }

  async delete(apiContext: APIRequestContext) {
    await this.deleteOwnedOrLeaf(apiContext, this.spreadsheetPath());

    return { entity: this.entityResponseData };
  }
}
