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
  EntityTypeEndpoint,
  ResponseDataType,
  ResponseDataWithServiceType,
} from './Entity.interface';
import { EntityClass } from './EntityClass';
import { resolveParents } from './ParentResolver';
import { DashboardServiceClass } from './service/DashboardServiceClass';

/**
 * Without `service` the dashboard (and its chart and data model) sits in the
 * shard's shared dashboardService. Pass a DashboardServiceClass when the test
 * needs its own service — to assert on a unique service name, visit the
 * service page, or mutate it — or a non-default connector config.
 */
export type DashboardClassOptions = {
  name?: string;
  dataModelType?: string;
  service?: DashboardServiceClass;
  sharedInfraKey?: string;
};

export interface DataModelType extends ResponseDataWithServiceType {
  columns?: unknown[];
  dataModelType?: string;
}
export class DashboardClass extends EntityClass {
  private dashboardName: string;
  private dashboardDataModelName: string;
  private projectName: string;
  service = new DashboardServiceClass().entity;
  private readonly serviceOverride?: DashboardServiceClass;
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
    columns: DataModelType['columns'];
    dataModelType: DataModelType['dataModelType'];
  };

  serviceResponseData: ResponseDataType = {} as ResponseDataType;
  entityResponseData: ResponseDataWithServiceType =
    {} as ResponseDataWithServiceType;
  dataModelResponseData: DataModelType = {} as DataModelType;
  chartsResponseData: ResponseDataType = {} as ResponseDataType;

  constructor(options: DashboardClassOptions = {}) {
    super(EntityTypeEndpoint.Dashboard);
    this.type = 'Dashboard';
    this.serviceCategory = SERVICE_TYPE.Dashboard;
    this.serviceType = ServiceTypes.DASHBOARD_SERVICES;
    this.serviceOverride = options.service;
    this.sharedInfraKey = options.sharedInfraKey;
    if (options.service) {
      this.service = options.service.entity;
    }

    this.dashboardName = `pw-dashboard-${uuid()}`;
    this.dashboardDataModelName = `pw-dashboard-data-model-${uuid()}`;
    this.projectName = `pw-project-${uuid()}`;

    this.charts = {
      name: `pw-chart-${uuid()}`,
      displayName: `PW Chart ${uuid()}`,
      service: this.service.name,
    };

    this.entity = {
      name: options.name ?? this.dashboardName,
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
      dataModelType: options.dataModelType ?? 'SupersetDataModel',
    };

    this.childrenSelectorId = `${this.service.name}.${this.charts.name}`;
  }

  private bindServiceName(serviceName: string) {
    this.service = { ...this.service, name: serviceName };
    this.charts = { ...this.charts, service: serviceName };
    this.entity = { ...this.entity, service: serviceName };
    this.dataModel = { ...this.dataModel, service: serviceName };
    this.childrenSelectorId = `${serviceName}.${this.charts.name}`;
  }

  async create(apiContext: APIRequestContext) {
    const { parents, ownedRootPath, ownedOverride } = await resolveParents(
      apiContext,
      'dashboard',
      { service: this.serviceOverride },
      this.sharedInfraKey
    );
    this.serviceResponseData = parents.service as ResponseDataType;
    this.adoptOwnership({ ownedRootPath, ownedOverride });
    this.bindServiceName(this.serviceResponseData.name);

    this.chartsResponseData = await createOrFetch(apiContext, {
      label: 'DashboardClass.create chart',
      createPath: '/api/v1/charts',
      fqnSegments: [this.service.name, this.charts.name],
      data: this.charts,
    });

    // Awaited before the dashboard is posted, not alongside it: the dashboard
    // references the chart by FQN, so the chart has to exist first. The previous
    // version fired both POSTs before awaiting either.
    this.entityResponseData = await createOrFetch(apiContext, {
      label: 'DashboardClass.create dashboard',
      createPath: '/api/v1/dashboards',
      fqnSegments: [this.service.name, this.entity.name],
      data: {
        ...this.entity,
        charts: [`${this.service.name}.${this.charts.name}`],
      },
    });

    this.dataModelResponseData = await createOrFetch(apiContext, {
      label: 'DashboardClass.create dataModel',
      createPath: '/api/v1/dashboard/datamodels',
      // `<serviceFqn>.model.<name>` — DashboardDataModelRepository inserts a
      // literal `model` segment that no other entity type has.
      fqnSegments: [this.service.name, 'model', this.dataModel.name],
      data: this.dataModel,
    });

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
    const response = await withNotFoundRetry(() =>
      apiContext.patch(
        `/api/v1/dashboards/name/${this.entityResponseData?.['fullyQualifiedName']}`,
        {
          data: patchData,
          headers: {
            'Content-Type': 'application/json-patch+json',
          },
        }
      )
    );
    this.entityResponseData = await okJson(response, 'DashboardClass.patch');

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
      ownedRootPath: this.ownedRootPath,
    };
  }

  public set(data: {
    entity: ResponseDataWithServiceType;
    service: ResponseDataType;
    charts: ResponseDataType;
    dataModel: DataModelType;
    ownedRootPath?: string;
  }): void {
    this.entityResponseData = data.entity;
    this.serviceResponseData = data.service;
    this.chartsResponseData = data.charts;
    this.dataModelResponseData = data.dataModel;
    this.ownedRootPath = data.ownedRootPath;
    this.entity.name = data.entity.name;
    this.charts.name = data.charts.name;
    this.dataModel.name = data.dataModel.name;
    this.bindServiceName(data.service.name);
  }

  async visitEntityPage(page: Page) {
    await visitEntityPageByFqn({
      page,
      endpoint: this.endpoint,
      fqn: this.entityResponseData?.fullyQualifiedName ?? '',
    });
  }

  async delete(apiContext: APIRequestContext) {
    // Chart and data model are service children, not dashboard children, so a
    // recursive dashboard delete leaves them behind in a shared service.
    if (!this.ownedRootPath) {
      await deleteFixtureEntity(
        apiContext,
        `/api/v1/charts/${this.chartsResponseData?.id}?recursive=true&hardDelete=true`
      );
      await deleteFixtureEntity(
        apiContext,
        `/api/v1/dashboard/datamodels/${this.dataModelResponseData?.id}?recursive=true&hardDelete=true`
      );
    }
    await this.deleteOwnedOrLeaf(
      apiContext,
      `/api/v1/dashboards/${this.entityResponseData?.id}`
    );

    return { entity: this.entityResponseData };
  }
}
