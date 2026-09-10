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
import { TitleBreadcrumbProps } from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import { DataAssetsHeaderProps } from '../../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import { ProfilerTabPath } from '../../../components/Database/Profiler/ProfilerDashboard/profilerDashboard.interface';
import { ROUTES } from '../../../constants/constants';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { getBulkEntityBreadcrumbList } from '../../../utils/EntityImport/EntityImportUtils';
import observabilityRouterClassBase from '../../../utils/ObservabilityRouterClassBase';
import {
  getEntityDetailsPath,
  getTestSuitePath,
} from '../../../utils/RouterUtils';
import { DataQualityPageTabs } from '../../DataQuality/DataQualityPage.interface';
import {
  CSVImportJobType,
  TranslateFn,
} from './BulkEntityImportPage.interface';

export const getWildcardBreadcrumbList = (
  entityType: EntityType,
  t: TranslateFn
): TitleBreadcrumbProps['titleLinks'] => {
  if (entityType === EntityType.METRIC) {
    return [
      {
        name: t('label.metric-plural'),
        url: ROUTES.METRICS,
      },
    ];
  }

  return [
    {
      name: t('label.data-quality'),
      url: observabilityRouterClassBase.getDataQualityPagePath(
        DataQualityPageTabs.TEST_CASES
      ),
    },
  ];
};

export const getTestCaseBreadcrumbList = (
  breadcrumbEntityType: EntityType,
  entity: DataAssetsHeaderProps['dataAsset'],
  isBulkEdit: boolean,
  t: TranslateFn
): TitleBreadcrumbProps['titleLinks'] | undefined => {
  if (breadcrumbEntityType === EntityType.TABLE) {
    return getBulkEntityBreadcrumbList(EntityType.TABLE, entity, isBulkEdit, [
      {
        name: t('label.data-quality'),
        url: getEntityDetailsPath(
          EntityType.TABLE,
          entity.fullyQualifiedName ?? '',
          EntityTabs.PROFILER,
          ProfilerTabPath.DATA_QUALITY
        ),
      },
    ]);
  }

  if (breadcrumbEntityType === EntityType.TEST_SUITE) {
    return [
      {
        name: t('label.test-suite-plural'),
        url: observabilityRouterClassBase.getDataQualityPagePath(
          DataQualityPageTabs.TEST_SUITES
        ),
      },
      {
        name: entity.displayName ?? entity.name ?? '',
        url: getTestSuitePath(entity.fullyQualifiedName ?? ''),
      },
    ];
  }

  return undefined;
};

export const getActiveImportBannerType = (
  job: CSVImportJobType
): 'error' | 'info' | 'success' => {
  if (job.error) {
    return 'error';
  }

  return job.status === 'IN_PROGRESS' ? 'info' : 'success';
};

export const getActiveImportBannerMessage = (job: CSVImportJobType): string =>
  job.error ?? job.message ?? '';
