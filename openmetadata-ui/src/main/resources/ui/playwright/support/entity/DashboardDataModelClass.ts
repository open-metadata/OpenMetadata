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

export interface DashboardDataModelChild {
  name: string;
  dataType: string;
  dataLength: number;
  dataTypeDisplay: string;
  description: string;
  children?: Array<DashboardDataModelChild>;
}

export class DashboardDataModelClass extends EntityClass {
  private dashboardDataModelName: string;
  private projectName: string;
  service: {
    name: string;
    serviceType: string;
    connection: {
      config: {
        type: string;
        hostPort: string;
        connection: {
          provider: string;
          username: string;
          password: string;
        };
        supportsMetadataExtraction: boolean;
      };
    };
  };

  children: Array<DashboardDataModelChild>;

  entity: {
    name: string;
    displayName: string;
    service: string;
    description: string;
    columns: unknown[];
    dataModelType: string;
    project: string;
  };

  serviceResponseData: ResponseDataType = {} as ResponseDataType;
  entityResponseData: ResponseDataWithServiceType =
    {} as ResponseDataWithServiceType;

  constructor(name?: string) {
    super(EntityTypeEndpoint.DataModel);

    this.dashboardDataModelName = `pw-dashboard-data-model-${uuid()}`;
    this.projectName = `pw-project-${uuid()}`;

    this.service = {
      name: name ?? `pw-dashboard-service-${uuid()}`,
      serviceType: 'Superset',
      connection: {
        config: {
          type: 'Superset',
          hostPort: 'http://localhost:8088',
          connection: {
            provider: 'ldap',
            username: 'admin',
            password: 'admin',
          },
          supportsMetadataExtraction: true,
        },
      },
    };

    this.children = [
      {
        name: 'country_name',
        dataType: 'VARCHAR',
        dataLength: 256,
        dataTypeDisplay: 'varchar',
        description: 'Name of the country.',
      },
      {
        name: 'user_details',
        dataType: 'VARCHAR',
        dataLength: 256,
        dataTypeDisplay: 'varchar',
        description: 'User details.',
        children: [
          {
            name: 'name',
            dataType: 'VARCHAR',
            dataLength: 256,
            dataTypeDisplay: 'varchar',
            description: 'Name of the user.',
            children: [
              {
                name: 'first_name',
                dataType: 'VARCHAR',
                dataLength: 256,
                dataTypeDisplay: 'varchar',
                description: 'First name of the user.',
              },
              {
                name: 'last_name',
                dataType: 'VARCHAR',
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
    const serviceResponse = await apiContext.post(
      '/api/v1/services/dashboardServices',
      {
        data: this.service,
      }
    );
    const entityResponse = await apiContext.post(
      '/api/v1/dashboard/datamodels',
      {
        data: this.entity,
      }
    );

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
      `/api/v1/dashboard/datamodels/name/${this.entityResponseData?.['fullyQualifiedName']}`,
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

  get() {
    return {
      service: this.serviceResponseData,
      entity: this.entityResponseData,
    };
  }

  public set(data: {
    entity: ResponseDataWithServiceType;
    service: ResponseDataType;
  }): void {
    this.entityResponseData = data.entity;
    this.serviceResponseData = data.service;
  }

  async visitEntityPage(page: Page) {
    await visitEntityPage({
      page,
      searchTerm: this.entityResponseData?.['fullyQualifiedName'],
      dataTestId: `${
        this.entityResponseData.service.name ?? this.service.name
      }-${this.entityResponseData.name ?? this.entity.name}`,
    });
  }

  async delete(apiContext: APIRequestContext) {
    const serviceResponse = await apiContext.delete(
      `/api/v1/services/dashboardServices/name/${encodeURIComponent(
        this.serviceResponseData?.['fullyQualifiedName']
      )}?recursive=true&hardDelete=true`
    );

    return {
      service: serviceResponse.body,
      entity: this.entityResponseData,
    };
  }
}
