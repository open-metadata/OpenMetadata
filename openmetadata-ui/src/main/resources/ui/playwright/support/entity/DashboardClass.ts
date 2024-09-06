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
import { uuid } from '../../utils/common';
import { visitEntityPage } from '../../utils/entity';
import { EntityTypeEndpoint } from './Entity.interface';
import { EntityClass } from './EntityClass';

export class DashboardClass extends EntityClass {
  private dashboardName = `pw-dashboard-${uuid()}`;
  service = {
    name: `pw-dashboard-service-${uuid()}`,
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
  charts = {
    name: `pw-chart-${uuid()}`,
    displayName: `PW Chart ${uuid()}`,
    service: this.service.name,
  };
  entity = {
    name: this.dashboardName,
    displayName: this.dashboardName,
    service: this.service.name,
  };

  serviceResponseData: unknown;
  entityResponseData: unknown;
  chartsResponseData: unknown;

  constructor(name?: string) {
    super(EntityTypeEndpoint.Dashboard);
    this.service.name = name ?? this.service.name;
    this.type = 'Dashboard';
    this.serviceCategory = SERVICE_TYPE.Dashboard;
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

    this.serviceResponseData = await serviceResponse.json();
    this.chartsResponseData = await chartsResponse.json();
    this.entityResponseData = await entityResponse.json();

    return {
      service: serviceResponse.body,
      entity: entityResponse.body,
      charts: chartsResponse.body,
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

  async get() {
    return {
      service: this.serviceResponseData,
      entity: this.entityResponseData,
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
      `/api/v1/services/dashboardServices/name/${encodeURIComponent(
        this.serviceResponseData?.['fullyQualifiedName']
      )}?recursive=true&hardDelete=true`
    );

    const chartResponse = await apiContext.delete(
      `/api/v1/charts/name/${encodeURIComponent(
        this.chartsResponseData?.['fullyQualifiedName']
      )}?recursive=true&hardDelete=true`
    );

    return {
      service: serviceResponse.body,
      entity: this.entityResponseData,
      chart: chartResponse.body,
    };
  }
}
