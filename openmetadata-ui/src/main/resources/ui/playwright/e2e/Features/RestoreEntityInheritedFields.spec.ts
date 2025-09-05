import { expect, test } from '@playwright/test';
import { DataProduct } from '../../support/domain/DataProduct';
import { Domain } from '../../support/domain/Domain';
import { ApiEndpointClass } from '../../support/entity/ApiEndpointClass';
import { ChartClass } from '../../support/entity/ChartClass';
import { ContainerClass } from '../../support/entity/ContainerClass';
import { DashboardClass } from '../../support/entity/DashboardClass';
import { DashboardDataModelClass } from '../../support/entity/DashboardDataModelClass';
import { MlModelClass } from '../../support/entity/MlModelClass';
import { PipelineClass } from '../../support/entity/PipelineClass';
import { SearchIndexClass } from '../../support/entity/SearchIndexClass';
import { StoredProcedureClass } from '../../support/entity/StoredProcedureClass';
import { TableClass } from '../../support/entity/TableClass';
import { TopicClass } from '../../support/entity/TopicClass';
import { performAdminLogin } from '../../utils/admin';
import {
  assignDataProduct,
  assignDomain,
  redirectToHomePage,
} from '../../utils/common';
import { softDeleteEntity } from '../../utils/entity';

const domain = new Domain();
const dataProduct = new DataProduct([domain]);

const entities = [
  ApiEndpointClass,
  TableClass,
  StoredProcedureClass,
  DashboardClass,
  PipelineClass,
  TopicClass,
  MlModelClass,
  ContainerClass,
  SearchIndexClass,
  DashboardDataModelClass,
  ChartClass,
] as const;

test.beforeAll('setup', async ({ browser }) => {
  const { afterAction, apiContext } = await performAdminLogin(browser);
  await domain.create(apiContext);
  await dataProduct.create(apiContext);

  await afterAction();
});

test.beforeEach(async ({ page }) => {
  await redirectToHomePage(page);
});

entities.forEach((EntityClass) => {
  const entity = new EntityClass();

  test.describe(entity.getType(), () => {
    test.beforeAll('setup ' + entity.getType(), async ({ browser }) => {
      const { afterAction, apiContext } = await performAdminLogin(browser);
      await entity.create(apiContext);
      await afterAction();
    });

    test('Validate restore with Inherited domain and data products assigned', async ({
      page,
    }) => {
      await entity.visitEntityPage(page);
      await page.waitForLoadState('networkidle');

      await expect(page.getByTestId('breadcrumb-link')).toHaveCount(
        ['Table', 'ApiEndpoint', 'Store Procedure'].includes(entity.getType())
          ? 3
          : 1
      );

      // click database
      await page
        .getByTestId('breadcrumb-link')
        .nth(
          ['Table', 'ApiEndpoint', 'Store Procedure'].includes(entity.getType())
            ? 1
            : 0
        )
        .click();
      // assign domain
      await assignDomain(page, domain.responseData);

      await redirectToHomePage(page);

      await entity.visitEntityPage(page);
      await assignDataProduct(
        page,
        domain.responseData,
        dataProduct.responseData
      );

      // This will delete and restore and ensure both operation are successful
      await softDeleteEntity(
        page,
        entity.entityResponseData.name,
        entity.endpoint,
        entity.entityResponseData?.['displayName'] ??
          entity.entityResponseData.name
      );
    });
  });
});
