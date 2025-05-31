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
import { isUndefined } from 'lodash';
import { SERVICE_TYPE } from '../../../constant/service';
import { uuid } from '../../../utils/common';
import { visitServiceDetailsPage } from '../../../utils/service';
import { EntityTypeEndpoint, ResponseDataType } from '../Entity.interface';
import { EntityClass } from '../EntityClass';

export class DashboardServiceClass extends EntityClass {
  entity = {
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
  childEntity = {
    name: `pw-dashboard-${uuid()}`,
    displayName: `pw-dashboard-${uuid()}`,
    service: this.entity.name,
  };

  entityResponseData: ResponseDataType = {} as ResponseDataType;
  childrenArrayResponseData: ResponseDataType[] = [];

  constructor(name?: string) {
    super(EntityTypeEndpoint.DashboardService);
    this.entity.name = name ?? this.entity.name;
    this.type = 'Dashboard Service';
  }

  private async createDashboardChild(
    apiContext: APIRequestContext,
    dashboardData: { name: string; displayName: string; service: string }
  ): Promise<ResponseDataType> {
    const response = await apiContext.post('/api/v1/dashboards', {
      data: dashboardData,
    });

    return await response.json();
  }

  async create(
    apiContext: APIRequestContext,
    customChildDashboards?: { name: string; displayName: string }[]
  ) {
    const serviceResponse = await apiContext.post(
      '/api/v1/services/dashboardServices',
      {
        data: this.entity,
      }
    );

    const service = await serviceResponse.json();

    this.entityResponseData = service;

    const childDashboardResponseData: ResponseDataType[] = [];

    if (!isUndefined(customChildDashboards)) {
      for (const child of customChildDashboards) {
        const childDashboard = {
          ...child,
          service: this.entity.name,
        };

        const responseData = await this.createDashboardChild(
          apiContext,
          childDashboard
        );
        childDashboardResponseData.push(responseData);
      }
    } else {
      const childDashboard = {
        ...this.childEntity,
      };
      const responseData = await this.createDashboardChild(
        apiContext,
        childDashboard
      );
      childDashboardResponseData.push(responseData);
    }

    this.childrenArrayResponseData = childDashboardResponseData;

    return {
      service,
      children: this.childrenArrayResponseData,
    };
  }

  async patch(apiContext: APIRequestContext, payload: Operation[]) {
    const serviceResponse = await apiContext.patch(
      `/api/v1/services/dashboardServices/${this.entityResponseData?.['id']}`,
      {
        data: payload,
        headers: {
          'Content-Type': 'application/json-patch+json',
        },
      }
    );

    const service = await serviceResponse.json();

    this.entityResponseData = service;

    return service;
  }

  get() {
    return this.entityResponseData;
  }

  async visitEntityPage(page: Page) {
    await visitServiceDetailsPage(
      page,
      {
        name: this.entity.name,
        type: SERVICE_TYPE.Dashboard,
      },
      false
    );
  }

  async delete(apiContext: APIRequestContext) {
    const serviceResponse = await apiContext.delete(
      `/api/v1/services/dashboardServices/name/${encodeURIComponent(
        this.entityResponseData?.['fullyQualifiedName']
      )}?recursive=true&hardDelete=true`
    );

    return await serviceResponse.json();
  }
}
