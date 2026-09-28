/*
 *  Copyright 2026 Collate.
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
import { ApiEndpointClass } from '../../support/entity/ApiEndpointClass';
import { ChartClass } from '../../support/entity/ChartClass';
import { ContainerClass } from '../../support/entity/ContainerClass';
import { DashboardClass } from '../../support/entity/DashboardClass';
import { DashboardDataModelClass } from '../../support/entity/DashboardDataModelClass';
import { DirectoryClass } from '../../support/entity/DirectoryClass';
import { EntityClass } from '../../support/entity/EntityClass';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import { FileClass } from '../../support/entity/FileClass';
import { MetricClass } from '../../support/entity/MetricClass';
import { MlModelClass } from '../../support/entity/MlModelClass';
import { PipelineClass } from '../../support/entity/PipelineClass';
import { SearchIndexClass } from '../../support/entity/SearchIndexClass';
import { ApiServiceClass } from '../../support/entity/service/ApiServiceClass';
import { DashboardServiceClass } from '../../support/entity/service/DashboardServiceClass';
import { DatabaseServiceClass } from '../../support/entity/service/DatabaseServiceClass';
import { DriveServiceClass } from '../../support/entity/service/DriveServiceClass';
import { MessagingServiceClass } from '../../support/entity/service/MessagingServiceClass';
import { MlmodelServiceClass } from '../../support/entity/service/MlmodelServiceClass';
import { PipelineServiceClass } from '../../support/entity/service/PipelineServiceClass';
import { SearchIndexServiceClass } from '../../support/entity/service/SearchIndexServiceClass';
import { StorageServiceClass } from '../../support/entity/service/StorageServiceClass';
import { SpreadsheetClass } from '../../support/entity/SpreadsheetClass';
import { StoredProcedureClass } from '../../support/entity/StoredProcedureClass';
import { TableClass } from '../../support/entity/TableClass';
import { TopicClass } from '../../support/entity/TopicClass';
import { WorksheetClass } from '../../support/entity/WorksheetClass';
import { test } from '../../support/fixtures/base';
import { createAdminApiContext } from '../../utils/admin';
import {
  assignSingleSelectDomain,
  removeSingleSelectDomain,
  verifyDomainPropagation,
} from '../../utils/common';
import { visitServiceDetailsPage } from '../../utils/service';

// Concrete subclasses provide create/delete/visit + entityResponseData;
// EntityClass itself doesn't declare them. Widen the factory's return
// type instead of casting at every call site.
type LifecycleEntity = EntityClass & {
  create(apiContext: APIRequestContext): Promise<unknown>;
  delete(apiContext: APIRequestContext): Promise<unknown>;
  visitEntityPage(page: Page): Promise<void>;
  entityResponseData?: { fullyQualifiedName?: string; name?: string };
  service?: { name: string };
};

test.use({ storageState: 'playwright/.auth/admin.json' });

// Domain Propagation assigns a domain to the entity's parent service, then
// verifies it on the entity. On the shard's shared service a concurrent test
// can overwrite that domain between this test's PATCH and its read, so every
// entity here owns its service. It lives apart from Entity.spec.ts so the
// other ~30 tests there keep sharing parents. Metric has no service and the
// test skips it; it stays so this list mirrors Entity.spec.ts.
const isolatedEntityFactories: Record<string, () => LifecycleEntity> = {
  'Api Endpoint': () =>
    new ApiEndpointClass({ service: new ApiServiceClass() }),
  Table: () => new TableClass({ service: new DatabaseServiceClass() }),
  'Stored Procedure': () =>
    new StoredProcedureClass({ service: new DatabaseServiceClass() }),
  Dashboard: () => new DashboardClass({ service: new DashboardServiceClass() }),
  Pipeline: () => new PipelineClass({ service: new PipelineServiceClass() }),
  Topic: () => new TopicClass({ service: new MessagingServiceClass() }),
  'Ml Model': () => new MlModelClass({ service: new MlmodelServiceClass() }),
  Container: () => new ContainerClass({ service: new StorageServiceClass() }),
  'Search Index': () =>
    new SearchIndexClass({ service: new SearchIndexServiceClass() }),
  'Dashboard Data Model': () =>
    new DashboardDataModelClass({ service: new DashboardServiceClass() }),
  Metric: () => new MetricClass(),
  Chart: () => new ChartClass({ service: new DashboardServiceClass() }),
  Directory: () => new DirectoryClass({ service: new DriveServiceClass() }),
  File: () => new FileClass({ service: new DriveServiceClass() }),
  Spreadsheet: () => new SpreadsheetClass({ service: new DriveServiceClass() }),
  Worksheet: () => new WorksheetClass({ service: new DriveServiceClass() }),
};

Object.entries(isolatedEntityFactories).forEach(([key, factory]) => {
  test.describe(key, () => {
    const entity = factory();

    test.beforeAll('Create isolated entity', async () => {
      const { apiContext, afterAction } = await createAdminApiContext();
      await entity.create(apiContext);
      await afterAction();
    });

    test.afterAll('Cleanup isolated entity', async () => {
      const { apiContext, afterAction } = await createAdminApiContext();
      await entity.delete(apiContext);
      await afterAction();
    });

    test.beforeEach('Visit entity details page', async ({ page }) => {
      await entity.visitEntityPage(page);
    });

    /**
     * Tests domain propagation from service to entity
     * @description Verifies that a domain assigned to a service propagates to its child entities,
     * and that removing the domain from the service removes it from the entity
     */
    test('Domain Propagation', async ({ page }) => {
      test.slow(true);
      const serviceCategory = entity.serviceCategory;
      const service = entity.service;
      if (serviceCategory && service) {
        await visitServiceDetailsPage(
          page,
          {
            name: service.name,
            type: serviceCategory,
          },
          false
        );

        await assignSingleSelectDomain(
          page,
          EntityDataClass.domain1.responseData
        );
        const childFqnSearchTerm =
          entity.entityResponseData?.fullyQualifiedName ??
          entity.entityResponseData?.name ??
          '';
        await verifyDomainPropagation(
          page,
          EntityDataClass.domain1.responseData,
          childFqnSearchTerm,
          entity.exploreTabName
        );

        await visitServiceDetailsPage(
          page,
          {
            name: service.name,
            type: serviceCategory,
          },
          false
        );
        await removeSingleSelectDomain(
          page,
          EntityDataClass.domain1.responseData
        );
      }
    });
  });
});
