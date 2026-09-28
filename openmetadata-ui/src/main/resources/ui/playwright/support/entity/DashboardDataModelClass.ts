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
  EntityReference,
  EntityTypeEndpoint,
  ResponseDataType,
  ResponseDataWithServiceType,
} from './Entity.interface';
import { EntityClass } from './EntityClass';
import { resolveParents } from './ParentResolver';
import { DashboardServiceClass } from './service/DashboardServiceClass';

/**
 * Without `service` the data model sits in the shard's shared
 * dashboardService. Pass a DashboardServiceClass when the test needs its own
 * service — to assert on a unique service name, visit the service page, or
 * mutate it.
 */
export type DashboardDataModelClassOptions = {
  name?: string;
  service?: DashboardServiceClass;
  sharedInfraKey?: string;
};

export interface DashboardDataModel extends ResponseDataWithServiceType {
  columns: EntityReference[];
  dataModelType: string;
  project: string;
}

export interface Column {
  name: string;
  dataType: string;
  dataLength?: number;
  dataTypeDisplay: string;
  description: string;
  children?: Column[];
}

export class DashboardDataModelClass extends EntityClass {
  private readonly dashboardDataModelName: string;
  private readonly projectName: string;
  service = new DashboardServiceClass().entity;
  private readonly serviceOverride?: DashboardServiceClass;

  children: Column[];

  entity: {
    name: string;
    displayName: string;
    service: string;
    description: string;
    columns: Column[];
    dataModelType: string;
    project: string;
  };

  serviceResponseData: ResponseDataType = {} as ResponseDataType;
  entityResponseData: DashboardDataModel = {} as DashboardDataModel;

  constructor(options: DashboardDataModelClassOptions = {}) {
    super(EntityTypeEndpoint.DataModel);
    this.serviceOverride = options.service;
    this.sharedInfraKey = options.sharedInfraKey;
    if (options.service) {
      this.service = options.service.entity;
    }

    this.dashboardDataModelName =
      options.name ?? `pw-dashboard-data-model-${uuid()}`;
    this.projectName = `pw-project-${uuid()}`;

    this.children = [
      {
        name: 'country_name',
        dataType: `VARCHAR`,
        dataLength: 256,
        dataTypeDisplay: 'varchar',
        description: 'Name of the country.',
      },
      {
        name: 'user_details',
        dataType: `VARCHAR`,
        dataLength: 256,
        dataTypeDisplay: 'varchar',
        description: 'User details.',
        children: [
          {
            name: 'name',
            dataType: `VARCHAR`,
            dataLength: 256,
            dataTypeDisplay: 'varchar',
            description: 'Name of the user.',
            children: [
              {
                name: 'first_name',
                dataType: `VARCHAR`,
                dataLength: 256,
                dataTypeDisplay: 'varchar',
                description: 'First name of the user.',
              },
              {
                name: 'last_name',
                dataType: `VARCHAR`,
                dataLength: 256,
                dataTypeDisplay: 'varchar',
                description: 'Last name of the user.',
              },
            ],
          },
        ],
      },
    ];

    this.entity = {
      name: this.dashboardDataModelName,
      displayName: this.dashboardDataModelName,
      description: `Description for ${this.dashboardDataModelName}`,
      service: this.service.name,
      columns: this.children,
      dataModelType: 'SupersetDataModel',
      project: this.projectName,
    };

    this.type = 'DashboardDataModel';
    this.childrenTabId = 'model';
    this.childrenSelectorId = this.children[0].name;
    this.serviceCategory = SERVICE_TYPE.Dashboard;
    this.serviceType = ServiceTypes.DASHBOARD_SERVICES;
  }

  async create(apiContext: APIRequestContext) {
    const { parents, ownedRootPath } = await resolveParents(
      apiContext,
      'dashboard',
      { service: this.serviceOverride },
      this.sharedInfraKey
    );
    this.serviceResponseData = parents.service as ResponseDataType;
    this.ownedRootPath = ownedRootPath;
    this.service = { ...this.service, name: this.serviceResponseData.name };
    this.entity.service = this.serviceResponseData.name;

    this.entityResponseData = await createOrFetch(apiContext, {
      label: 'DashboardDataModelClass.create dataModel',
      createPath: '/api/v1/dashboard/datamodels',
      // DashboardDataModelRepository builds the FQN as `<serviceFqn>.model.<name>`
      // — a literal `model` segment the other entity types do not have.
      fqnSegments: [this.service.name, 'model', this.entity.name],
      data: this.entity,
    });

    const dataModelFqn = this.entityResponseData.fullyQualifiedName;
    if (!dataModelFqn) {
      throw new Error(
        'Dashboard data model response is missing its fully qualified name'
      );
    }
    this.childrenSelectorId =
      this.entityResponseData.columns?.[0]?.fullyQualifiedName ??
      `${dataModelFqn}.${this.children[0].name}`;

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
        `/api/v1/dashboard/datamodels/name/${this.entityResponseData?.fullyQualifiedName}`,
        {
          data: patchData,
          headers: {
            'Content-Type': 'application/json-patch+json',
          },
        }
      )
    );
    this.entityResponseData = await okJson(
      response,
      'DashboardDataModelClass.patch'
    );

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
    entity: DashboardDataModel;
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
      `/api/v1/dashboard/datamodels/${this.entityResponseData?.id}`
    );

    return { entity: this.entityResponseData };
  }
}
