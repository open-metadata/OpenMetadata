/*
 *  Copyright 2023 Collate.
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

import { Typography } from '@openmetadata/ui-core-components';
import { Operation } from 'fast-json-patch';
import { isNil } from 'lodash';
import { ServiceTypes } from 'Models';
import DisplayName from '../components/common/DisplayName/DisplayName';
import { ColumnsType } from '../components/common/Table/Table.interface';
import { EntityName } from '../components/Modals/EntityNameModal/EntityNameModal.interface';
import { NO_DATA_PLACEHOLDER } from '../constants/constants';
import { TABLE_COLUMNS_KEYS } from '../constants/TableKeys.constants';
import { EntityType } from '../enums/entity.enum';
import { ServiceCategory } from '../enums/service.enum';
import { Database } from '../generated/entity/data/database';
import { Directory } from '../generated/entity/data/directory';
import { Pipeline } from '../generated/entity/data/pipeline';
import { ServicePageData } from '../interface/platform/service.interface';
import { patchApiCollection } from '../rest/apiCollectionsAPI';
import { patchDashboardDetails } from '../rest/dashboardAPI';
import { patchDatabaseDetails } from '../rest/databaseAPI';
import { patchDriveAssetDetails } from '../rest/driveAPI';
import { patchMlModelDetails } from '../rest/mlModelAPI';
import { patchPipelineDetails } from '../rest/pipelineAPI';
import { patchSearchIndexDetails } from '../rest/SearchIndexAPI';
import { patchContainerDetails } from '../rest/storageAPI';
import { patchTopicDetails } from '../rest/topicsAPI';
import {
  highlightSearchText,
  renderHighlightedText,
} from './EntitySearchUtils';
import { columnSorter } from './EntitySortUtils';
import { t } from './i18next/LocalUtil';
import { getLinkForFqn } from './ServiceUtils';
import {
  certificationTableObject,
  dataProductTableObject,
  descriptionTableObject,
  domainTableObject,
  ownerTableObject,
  tagTableObject,
  tierTableObject,
} from './TableColumn.util';
import { getUsagePercentile } from './TablePureUtils';

export const getServiceMainTabColumns = (
  serviceCategory: ServiceTypes,
  editDisplayNamePermission?: boolean,
  handleDisplayNameUpdate?: (
    entityData: EntityName,
    id?: string
  ) => Promise<void>,
  searchValue?: string,
  // Whether the current user can view usage data. Matched against the
  // DATABASE_SERVICES branch below so that — like DatabaseSchemaTable's
  // `viewUsagePermission`-gated column — the Usage column is hidden entirely
  // for users without ViewUsage, instead of rendering fabricated values from
  // the rows whose `usageSummary` the REST layer deliberately withheld
  // (ServiceDetailsPage.fetchDatabases) or that the ES `_source` path never
  // populated. Defaults to true so unpermissioned callers (the version-page
  // tab) keep showing the column; the live ServiceMainTabContent caller
  // passes the derived flag.
  viewUsagePermission = true
): ColumnsType<ServicePageData> => [
  {
    title: t('label.name'),
    dataIndex: TABLE_COLUMNS_KEYS.NAME,
    key: TABLE_COLUMNS_KEYS.NAME,
    width: 280,
    // Sort by the label a user reads: displayName, falling back to name.
    // For connectors such as Power BI, name is a source ID (a GUID).
    sorter: columnSorter,
    render: (_, record: ServicePageData) => (
      <DisplayName
        displayName={renderHighlightedText(
          highlightSearchText(record.displayName, searchValue)
        )}
        entityDisplayName={record.displayName}
        entityName={record.name}
        hasEditPermission={editDisplayNamePermission}
        id={record.id}
        key={record.id}
        link={getLinkForFqn(serviceCategory, record.fullyQualifiedName ?? '')}
        name={renderHighlightedText(
          highlightSearchText(record.name, searchValue)
        )}
        onEditDisplayName={handleDisplayNameUpdate}
      />
    ),
  },
  ...descriptionTableObject<ServicePageData>({ width: 300 }),
  ...(ServiceCategory.PIPELINE_SERVICES === serviceCategory
    ? [
        {
          title: t('label.schedule-interval'),
          dataIndex: TABLE_COLUMNS_KEYS.SCHEDULE_INTERVAL,
          key: TABLE_COLUMNS_KEYS.SCHEDULE_INTERVAL,
          width: 200,
          render: (scheduleInterval: Pipeline['scheduleInterval']) =>
            scheduleInterval ? (
              <span>{scheduleInterval}</span>
            ) : (
              <Typography className="tw:text-primary">
                {NO_DATA_PLACEHOLDER}
              </Typography>
            ),
        },
      ]
    : []),
  ...ownerTableObject<ServicePageData>(),
  ...domainTableObject<ServicePageData>(),
  ...dataProductTableObject<ServicePageData>(),
  ...tagTableObject<ServicePageData>(),
  ...tierTableObject<ServicePageData>(),
  ...certificationTableObject<ServicePageData>(),
  ...(viewUsagePermission &&
  ServiceCategory.DATABASE_SERVICES === serviceCategory
    ? [
        {
          title: t('label.usage'),
          dataIndex: TABLE_COLUMNS_KEYS.USAGE_SUMMARY,
          key: TABLE_COLUMNS_KEYS.USAGE_SUMMARY,
          width: 200,
          render: (usageSummary: Database['usageSummary']) =>
            isNil(usageSummary?.weeklyStats?.percentileRank) ? (
              <Typography className="tw:text-primary">
                {NO_DATA_PLACEHOLDER}
              </Typography>
            ) : (
              <Typography className="tw:text-primary">
                {getUsagePercentile(usageSummary.weeklyStats.percentileRank)}
              </Typography>
            ),
        },
      ]
    : []),
];

export const callServicePatchAPI = async (
  serviceCategory: ServiceTypes,
  id: string,
  jsonPatch: Operation[]
) => {
  switch (serviceCategory) {
    case ServiceCategory.DATABASE_SERVICES:
      return await patchDatabaseDetails(id, jsonPatch);
    case ServiceCategory.MESSAGING_SERVICES:
      return await patchTopicDetails(id, jsonPatch);
    case ServiceCategory.DASHBOARD_SERVICES:
      return await patchDashboardDetails(id, jsonPatch);
    case ServiceCategory.PIPELINE_SERVICES:
      return await patchPipelineDetails(id, jsonPatch);
    case ServiceCategory.ML_MODEL_SERVICES:
      return await patchMlModelDetails(id, jsonPatch);
    case ServiceCategory.STORAGE_SERVICES:
      return await patchContainerDetails(id, jsonPatch);
    case ServiceCategory.SEARCH_SERVICES:
      return await patchSearchIndexDetails(id, jsonPatch);
    case ServiceCategory.API_SERVICES:
      return await patchApiCollection(id, jsonPatch);
    case ServiceCategory.DRIVE_SERVICES:
      return await patchDriveAssetDetails<Directory>(
        id,
        jsonPatch,
        EntityType.DIRECTORY
      );
    default:
      return;
  }
};
