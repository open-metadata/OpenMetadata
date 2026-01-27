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

export class DashboardClass extends EntityClass {
  private dashboardName: string;
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
  charts: { name: string; displayName: string; service: string };
  entity: {
    name: string;
    displayName: string;
    description: string;
    service: string;
    project: string;
  };
  children: unknown[];
  dataModel: {
    name: string;
    displayName: string;
    service: string;
    columns: unknown[];
    dataModelType: string;
  };

  serviceResponseData: ResponseDataType = {} as ResponseDataType;
  entityResponseData: ResponseDataWithServiceType =
    {} as ResponseDataWithServiceType;
  dataModelResponseData: ResponseDataWithServiceType =
    {} as ResponseDataWithServiceType;
  chartsResponseData: ResponseDataType = {} as ResponseDataType;

  constructor(name?: string, dataModelType = 'SupersetDataModel') {
    super(EntityTypeEndpoint.Dashboard);
    this.type = 'Dashboard';
    this.serviceCategory = SERVICE_TYPE.Dashboard;
    this.serviceType = ServiceTypes.DASHBOARD_SERVICES;

    const serviceName = name ?? `pw-dashboard-service-${uuid()}`;
    this.dashboardName = `pw-dashboard-${uuid()}`;
    this.dashboardDataModelName = `pw-dashboard-data-model-${uuid()}`;
    this.projectName = `pw-project-${uuid()}`;

    this.service = {
      name: serviceName,
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

    this.charts = {
      name: `pw-chart-${uuid()}`,
      displayName: `PW Chart ${uuid()}`,
      service: this.service.name,
    };

    this.entity = {
      name: this.dashboardName,
      displayName: this.dashboardName,
      service: this.service.name,
      project: this.projectName,
      description: `Description for ${this.dashboardName}`,
    };

    this.children = [
      {
        name: 'merchant',
        dataType: 'VARCHAR',
        dataLength: 256,
        dataTypeDisplay: 'varchar',
        description: 'merchant',
      },
      {
        name: 'notes',
        dataType: 'VARCHAR',
        dataLength: 256,
        dataTypeDisplay: 'varchar',
        description: 'merchant',
      },
      {
        name: 'country_name',
        dataType: 'VARCHAR',
        dataLength: 256,
        dataTypeDisplay: 'varchar',
        description: 'Name of the country.',
      },
    ];

    this.dataModel = {
      name: this.dashboardDataModelName,
      displayName: this.dashboardDataModelName,
      service: this.service.name,
      columns: this.children,
      dataModelType: dataModelType,
    };

    this.childrenSelectorId = `${this.service.name}.${this.charts.name}`;
  }

  async create(apiContext: APIRequestContext) {
    const serviceResponse = await apiContext.post(
      '/api/v1/services/dashboardServices',
      {
        data: this.service,
      }
    );
    const chartsResponse = await apiContext.post('/api/v1/charts', {
      data: this.charts,
    });

    const entityResponse = await apiContext.post('/api/v1/dashboards', {
      data: {
        ...this.entity,
        charts: [`${this.service.name}.${this.charts.name}`],
      },
    });
    const dataModelResponse = await apiContext.post(
      '/api/v1/dashboard/datamodels',
      {
        data: this.dataModel,
      }
    );

    this.serviceResponseData = await serviceResponse.json();
    this.chartsResponseData = await chartsResponse.json();
    this.dataModelResponseData = await dataModelResponse.json();
    this.entityResponseData = await entityResponse.json();

    return {
      service: this.serviceResponseData,
      entity: this.entityResponseData,
      charts: this.chartsResponseData,
      dataModel: this.dataModelResponseData,
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
      `/api/v1/dashboards/name/${this.entityResponseData?.['fullyQualifiedName']}`,
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
      charts: this.chartsResponseData,
      dataModel: this.dataModelResponseData,
    };
  }

  public set(data: {
    entity: ResponseDataWithServiceType;
    service: ResponseDataType;
    charts: ResponseDataType;
    dataModel: ResponseDataWithServiceType;
  }): void {
    this.entityResponseData = data.entity;
    this.serviceResponseData = data.service;
    this.chartsResponseData = data.charts;
    this.dataModelResponseData = data.dataModel;
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
    const chartResponse = await apiContext.delete(
      `/api/v1/charts/name/${encodeURIComponent(
        this.chartsResponseData?.['fullyQualifiedName']
      )}?recursive=true&hardDelete=true`
    );

    const serviceResponse = await apiContext.delete(
      `/api/v1/services/dashboardServices/name/${encodeURIComponent(
        this.serviceResponseData?.['fullyQualifiedName']
      )}?recursive=true&hardDelete=true`
    );

    return {
      service: serviceResponse.body,
      entity: this.entityResponseData,
      chart: chartResponse.body,
    };
  }
}
