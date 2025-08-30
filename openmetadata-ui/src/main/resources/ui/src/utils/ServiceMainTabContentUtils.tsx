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

import { Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { isUndefined } from 'lodash';
import { ServiceTypes } from 'Models';
import DisplayName from '../components/common/DisplayName/DisplayName';
import RichTextEditorPreviewerNew from '../components/common/RichTextEditor/RichTextEditorPreviewNew';
import { EntityName } from '../components/Modals/EntityNameModal/EntityNameModal.interface';
import { NO_DATA_PLACEHOLDER } from '../constants/constants';
import { TABLE_COLUMNS_KEYS } from '../constants/TableKeys.constants';
import { ServiceCategory } from '../enums/service.enum';
import { Database } from '../generated/entity/data/database';
import { Pipeline } from '../generated/entity/data/pipeline';
import { ServicePageData } from '../pages/ServiceDetailsPage/ServiceDetailsPage.interface';
import { patchApiCollection } from '../rest/apiCollectionsAPI';
import { patchDashboardDetails } from '../rest/dashboardAPI';
import { patchDatabaseDetails } from '../rest/databaseAPI';
import { patchDirectoryDetails } from '../rest/driveAPI';
import { patchMlModelDetails } from '../rest/mlModelAPI';
import { patchPipelineDetails } from '../rest/pipelineAPI';
import { patchSearchIndexDetails } from '../rest/SearchIndexAPI';
import { patchContainerDetails } from '../rest/storageAPI';
import { patchTopicDetails } from '../rest/topicsAPI';
import { t } from './i18next/LocalUtil';
import { getLinkForFqn } from './ServiceUtils';
import {
  dataProductTableObject,
  domainTableObject,
  ownerTableObject,
  tagTableObject,
} from './TableColumn.util';
import { getUsagePercentile } from './TableUtils';

export const getServiceMainTabColumns = (
  serviceCategory: ServiceTypes,
  editDisplayNamePermission?: boolean,
  handleDisplayNameUpdate?: (
    entityData: EntityName,
    id?: string
  ) => Promise<void>
): ColumnsType<ServicePageData> => [
  {
    title: t('label.name'),
    dataIndex: TABLE_COLUMNS_KEYS.NAME,
    key: TABLE_COLUMNS_KEYS.NAME,
    width: 280,
    render: (_, record: ServicePageData) => (
      <DisplayName
        displayName={record.displayName}
        hasEditPermission={editDisplayNamePermission}
        id={record.id}
        key={record.id}
        link={getLinkForFqn(serviceCategory, record.fullyQualifiedName ?? '')}
        name={record.name}
        onEditDisplayName={handleDisplayNameUpdate}
      />
    ),
  },
  {
    title: t('label.description'),
    dataIndex: TABLE_COLUMNS_KEYS.DESCRIPTION,
    key: TABLE_COLUMNS_KEYS.DESCRIPTION,
    width: 300,
    render: (description: ServicePageData['description']) =>
      !isUndefined(description) && description.trim() ? (
        <RichTextEditorPreviewerNew markdown={description} />
      ) : (
        <span className="text-grey-muted">
          {t('label.no-entity', {
            entity: t('label.description'),
          })}
        </span>
      ),
  },
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
              <Typography.Text>{NO_DATA_PLACEHOLDER}</Typography.Text>
            ),
        },
      ]
    : []),
  ...ownerTableObject<ServicePageData>(),
  ...domainTableObject<ServicePageData>(),
  ...dataProductTableObject<ServicePageData>(),
  ...tagTableObject<ServicePageData>(),
  ...(ServiceCategory.DATABASE_SERVICES === serviceCategory
    ? [
        {
          title: t('label.usage'),
          dataIndex: TABLE_COLUMNS_KEYS.USAGE_SUMMARY,
          key: TABLE_COLUMNS_KEYS.USAGE_SUMMARY,
          width: 200,
          render: (usageSummary: Database['usageSummary']) => (
            <Typography.Text>
              {getUsagePercentile(
                usageSummary?.weeklyStats?.percentileRank ?? 0
              )}
            </Typography.Text>
          ),
        },
      ]
    : []),
];

export const callServicePatchAPI = async (
  serviceCategory: ServiceTypes,
  id: string,
  jsonPatch: any
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
      return await patchDirectoryDetails(id, jsonPatch);
    default:
      return;
  }
};
