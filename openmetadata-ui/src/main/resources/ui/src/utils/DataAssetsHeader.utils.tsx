/* eslint-disable no-case-declarations */
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

import { t } from 'i18next';
import { isObject, isUndefined } from 'lodash';
import React from 'react';
import {
  ExtraInfoLabel,
  ExtraInfoLink,
} from '../components/DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import {
  DataAssetHeaderInfo,
  DataAssetsHeaderProps,
} from '../components/DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import {
  getDashboardDetailsPath,
  NO_DATA_PLACEHOLDER,
} from '../constants/constants';
import { EntityType } from '../enums/entity.enum';
import { Container } from '../generated/entity/data/container';
import { Dashboard } from '../generated/entity/data/dashboard';
import { DashboardDataModel } from '../generated/entity/data/dashboardDataModel';
import { Database } from '../generated/entity/data/database';
import { DatabaseSchema } from '../generated/entity/data/databaseSchema';
import { Mlmodel } from '../generated/entity/data/mlmodel';
import { Pipeline } from '../generated/entity/data/pipeline';
import { SearchIndex } from '../generated/entity/data/searchIndex';
import {
  StoredProcedure,
  StoredProcedureCodeObject,
} from '../generated/entity/data/storedProcedure';
import { Table } from '../generated/entity/data/table';
import { Topic } from '../generated/entity/data/topic';
import { DashboardService } from '../generated/entity/services/dashboardService';
import { DatabaseService } from '../generated/entity/services/databaseService';
import { MessagingService } from '../generated/entity/services/messagingService';
import { MetadataService } from '../generated/entity/services/metadataService';
import { MlmodelService } from '../generated/entity/services/mlmodelService';
import { PipelineService } from '../generated/entity/services/pipelineService';
import { SearchService } from '../generated/entity/services/searchService';
import { StorageService } from '../generated/entity/services/storageService';
import {
  getBreadcrumbForContainer,
  getBreadcrumbForEntitiesWithServiceOnly,
  getBreadcrumbForTable,
  getEntityBreadcrumbs,
  getEntityName,
} from './EntityUtils';
import { bytesToSize } from './StringsUtils';
import { getUsagePercentile } from './TableUtils';

export const getDataAssetsHeaderInfo = (
  entityType: DataAssetsHeaderProps['entityType'],
  dataAsset: DataAssetsHeaderProps['dataAsset'],
  entityName: string,
  parentContainers: Container[]
) => {
  const returnData: DataAssetHeaderInfo = {
    extraInfo: <></>,
    breadcrumbs: [],
  };
  switch (entityType) {
    case EntityType.TOPIC:
      const topicDetails = dataAsset as Topic;
      returnData.breadcrumbs =
        getBreadcrumbForEntitiesWithServiceOnly(topicDetails);
      returnData.extraInfo = (
        <>
          {topicDetails?.partitions ? (
            <ExtraInfoLabel
              label={t('label.partition-plural')}
              value={topicDetails.partitions}
            />
          ) : null}
          {topicDetails?.replicationFactor && (
            <ExtraInfoLabel
              label={t('label.replication-factor')}
              value={topicDetails.replicationFactor}
            />
          )}
        </>
      );

      break;

    case EntityType.DASHBOARD:
      const dashboardDetails = dataAsset as Dashboard;

      returnData.extraInfo = (
        <>
          {dashboardDetails.sourceUrl && (
            <ExtraInfoLink
              href={dashboardDetails.sourceUrl}
              label=""
              value={getEntityName(dashboardDetails)}
            />
          )}
          {dashboardDetails.dashboardType && (
            <ExtraInfoLabel
              label={t('label.entity-type-plural', {
                entity: t('label.dashboard'),
              })}
              value={dashboardDetails.dashboardType}
            />
          )}
          {dashboardDetails.project && (
            <ExtraInfoLabel
              label={t('label.project')}
              value={dashboardDetails.project}
            />
          )}
          {dashboardDetails?.usageSummary && (
            <ExtraInfoLabel
              label={t('label.usage')}
              value={getUsagePercentile(
                dashboardDetails.usageSummary?.weeklyStats?.percentileRank || 0,
                false
              )}
            />
          )}
        </>
      );

      returnData.breadcrumbs =
        getBreadcrumbForEntitiesWithServiceOnly(dashboardDetails);

      break;
    case EntityType.PIPELINE:
      const pipelineDetails = dataAsset as Pipeline;

      returnData.extraInfo = (
        <>
          {pipelineDetails.sourceUrl && (
            <ExtraInfoLink
              href={pipelineDetails.sourceUrl}
              label=""
              value={getEntityName(pipelineDetails)}
            />
          )}
        </>
      );

      returnData.breadcrumbs =
        getBreadcrumbForEntitiesWithServiceOnly(pipelineDetails);

      break;
    case EntityType.MLMODEL:
      const mlModelDetail = dataAsset as Mlmodel;

      returnData.extraInfo = (
        <>
          {mlModelDetail.algorithm && (
            <ExtraInfoLabel
              label={t('label.algorithm')}
              value={mlModelDetail.algorithm}
            />
          )}
          {mlModelDetail.target && (
            <ExtraInfoLabel
              label={t('label.target')}
              value={mlModelDetail.target}
            />
          )}
          {mlModelDetail.server && (
            <ExtraInfoLink
              href={mlModelDetail.server}
              label={t('label.server')}
              value={mlModelDetail.server}
            />
          )}
          {mlModelDetail.dashboard && (
            <ExtraInfoLink
              href={getDashboardDetailsPath(
                mlModelDetail.dashboard?.fullyQualifiedName as string
              )}
              label={t('label.dashboard')}
              value={entityName}
            />
          )}
          {mlModelDetail?.usageSummary && (
            <ExtraInfoLabel
              label={t('label.usage')}
              value={getUsagePercentile(
                mlModelDetail.usageSummary?.weeklyStats?.percentileRank || 0,
                false
              )}
            />
          )}
        </>
      );

      returnData.breadcrumbs =
        getBreadcrumbForEntitiesWithServiceOnly(mlModelDetail);

      break;
    case EntityType.CONTAINER:
      const containerDetails = dataAsset as Container;

      returnData.extraInfo = (
        <>
          {!isUndefined(containerDetails?.dataModel?.isPartitioned) && (
            <ExtraInfoLabel
              label=""
              value={
                containerDetails?.dataModel?.isPartitioned
                  ? (t('label.partitioned') as string)
                  : (t('label.non-partitioned') as string)
              }
            />
          )}
          {containerDetails.numberOfObjects && (
            <ExtraInfoLabel
              label={t('label.number-of-object-plural')}
              value={containerDetails.numberOfObjects}
            />
          )}
          {containerDetails.size && (
            <ExtraInfoLabel
              label={t('label.size')}
              value={bytesToSize(containerDetails.size)}
            />
          )}
        </>
      );

      returnData.breadcrumbs = getBreadcrumbForContainer({
        entity: containerDetails,
        parents: parentContainers,
      });

      break;

    case EntityType.DASHBOARD_DATA_MODEL:
      const dataModelDetails = dataAsset as DashboardDataModel;

      returnData.extraInfo = (
        <>
          {dataModelDetails.dataModelType && (
            <ExtraInfoLabel
              label={t('label.data-model-type')}
              value={dataModelDetails.dataModelType}
            />
          )}
        </>
      );

      returnData.breadcrumbs =
        getBreadcrumbForEntitiesWithServiceOnly(dataModelDetails);

      break;

    case EntityType.DATABASE:
      const databaseDetails = dataAsset as Database;

      returnData.breadcrumbs = getEntityBreadcrumbs(
        databaseDetails,
        EntityType.DATABASE
      );

      break;

    case EntityType.DATABASE_SCHEMA:
      const databaseSchemaDetails = dataAsset as DatabaseSchema;

      returnData.breadcrumbs = getEntityBreadcrumbs(
        databaseSchemaDetails,
        EntityType.DATABASE_SCHEMA,
        true
      );

      break;

    case EntityType.DATABASE_SERVICE:
      const databaseServiceDetails = dataAsset as DatabaseService;

      returnData.breadcrumbs = getEntityBreadcrumbs(
        databaseServiceDetails,
        EntityType.DATABASE_SERVICE
      );

      break;

    case EntityType.DASHBOARD_SERVICE:
      const dashboardServiceDetails = dataAsset as DashboardService;

      returnData.breadcrumbs = getEntityBreadcrumbs(
        dashboardServiceDetails,
        EntityType.DASHBOARD_SERVICE
      );

      break;

    case EntityType.MESSAGING_SERVICE:
      const messagingServiceDetails = dataAsset as MessagingService;

      returnData.breadcrumbs = getEntityBreadcrumbs(
        messagingServiceDetails,
        EntityType.MESSAGING_SERVICE
      );

      break;

    case EntityType.PIPELINE_SERVICE:
      const pipelineServiceDetails = dataAsset as PipelineService;

      returnData.breadcrumbs = getEntityBreadcrumbs(
        pipelineServiceDetails,
        EntityType.PIPELINE_SERVICE
      );

      break;

    case EntityType.MLMODEL_SERVICE:
      const mlModelServiceDetails = dataAsset as MlmodelService;

      returnData.breadcrumbs = getEntityBreadcrumbs(
        mlModelServiceDetails,
        EntityType.MLMODEL_SERVICE
      );

      break;

    case EntityType.METADATA_SERVICE:
      const metadataServiceDetails = dataAsset as MetadataService;

      returnData.breadcrumbs = getEntityBreadcrumbs(
        metadataServiceDetails,
        EntityType.METADATA_SERVICE
      );

      break;

    case EntityType.STORAGE_SERVICE:
      const storageServiceDetails = dataAsset as StorageService;

      returnData.breadcrumbs = getEntityBreadcrumbs(
        storageServiceDetails,
        EntityType.STORAGE_SERVICE
      );

      break;

    case EntityType.SEARCH_INDEX:
      const searchIndexDetails = dataAsset as SearchIndex;
      returnData.breadcrumbs =
        getBreadcrumbForEntitiesWithServiceOnly(searchIndexDetails);

      break;

    case EntityType.SEARCH_SERVICE:
      const searchServiceDetails = dataAsset as SearchService;

      returnData.breadcrumbs = getEntityBreadcrumbs(
        searchServiceDetails,
        EntityType.SEARCH_SERVICE
      );

      break;
    case EntityType.STORED_PROCEDURE:
      const storedProcedureDetails = dataAsset as StoredProcedure;

      returnData.extraInfo = (
        <>
          {storedProcedureDetails.sourceUrl && (
            <ExtraInfoLink
              href={storedProcedureDetails.sourceUrl}
              label=""
              value={getEntityName(storedProcedureDetails)}
            />
          )}
          {isObject(storedProcedureDetails.storedProcedureCode) && (
            <ExtraInfoLabel
              label={t('label.language')}
              value={
                (
                  storedProcedureDetails.storedProcedureCode as StoredProcedureCodeObject
                ).language ?? NO_DATA_PLACEHOLDER
              }
            />
          )}
        </>
      );

      returnData.breadcrumbs = getBreadcrumbForTable(dataAsset as Table);

      break;

    case EntityType.TABLE:
    default:
      const tableDetails = dataAsset as Table;

      returnData.extraInfo = (
        <>
          {tableDetails.tableType && (
            <ExtraInfoLabel
              label={t('label.type')}
              value={tableDetails.tableType}
            />
          )}
          {tableDetails?.usageSummary && (
            <ExtraInfoLabel
              label={t('label.usage')}
              value={getUsagePercentile(
                tableDetails.usageSummary?.weeklyStats?.percentileRank || 0,
                false
              )}
            />
          )}
          {tableDetails?.profile?.columnCount && (
            <ExtraInfoLabel
              label={t('label.column-plural')}
              value={tableDetails.profile?.columnCount}
            />
          )}
          {tableDetails?.profile?.rowCount && (
            <ExtraInfoLabel
              label={t('label.row-plural')}
              value={tableDetails.profile?.rowCount}
            />
          )}
        </>
      );

      returnData.breadcrumbs = getBreadcrumbForTable(tableDetails);

      break;
  }

  return returnData;
};
