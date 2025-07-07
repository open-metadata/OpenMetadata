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

import Icon from '@ant-design/icons';
import { Divider, Tooltip, Typography } from 'antd';
import classNames from 'classnames';
import { t } from 'i18next';
import { isArray, isEmpty, isObject, isUndefined } from 'lodash';
import React, { ReactNode } from 'react';
import { ReactComponent as IconExternalLink } from '../assets/svg/external-links.svg';
import {
  DataAssetHeaderInfo,
  DataAssetsHeaderProps,
  DataAssetsType,
  DataAssetsWithServiceField,
} from '../components/DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import {
  DATA_ASSET_ICON_DIMENSION,
  NO_DATA_PLACEHOLDER,
} from '../constants/constants';
import { EntityType } from '../enums/entity.enum';
import { APICollection } from '../generated/entity/data/apiCollection';
import { APIEndpoint } from '../generated/entity/data/apiEndpoint';
import { Container } from '../generated/entity/data/container';
import { Dashboard } from '../generated/entity/data/dashboard';
import { DashboardDataModel } from '../generated/entity/data/dashboardDataModel';
import { Database } from '../generated/entity/data/database';
import { DatabaseSchema } from '../generated/entity/data/databaseSchema';
import { Metric } from '../generated/entity/data/metric';
import { Mlmodel } from '../generated/entity/data/mlmodel';
import { Pipeline } from '../generated/entity/data/pipeline';
import { SearchIndex } from '../generated/entity/data/searchIndex';
import {
  StoredProcedure,
  StoredProcedureCodeObject,
} from '../generated/entity/data/storedProcedure';
import { Table } from '../generated/entity/data/table';
import { Topic } from '../generated/entity/data/topic';
import { APIService } from '../generated/entity/services/apiService';
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
} from './EntityUtils';
import { getEntityDetailsPath } from './RouterUtils';
import { bytesToSize } from './StringsUtils';
import { getUsagePercentile } from './TableUtils';

export const ExtraInfoLabel = ({
  label,
  value,
  dataTestId,
  inlineLayout = false,
}: {
  label: string;
  value: string | number | React.ReactNode;
  dataTestId?: string;
  inlineLayout?: boolean;
}) => {
  if (inlineLayout) {
    return (
      <>
        <Divider className="self-center" type="vertical" />
        <Typography.Text
          className="self-center text-xs whitespace-nowrap"
          data-testid={dataTestId}>
          {!isEmpty(label) && (
            <span className="text-grey-muted">{`${label}: `}</span>
          )}
          <span className="font-medium">{value}</span>
        </Typography.Text>
      </>
    );
  }

  return (
    <div className="d-flex align-start extra-info-container">
      <Typography.Text
        className="whitespace-nowrap text-sm d-flex flex-col gap-2"
        data-testid={dataTestId}>
        {!isEmpty(label) && (
          <span className="extra-info-label-heading">{label}</span>
        )}
        <div className={classNames('font-medium extra-info-value')}>
          {value}
        </div>
      </Typography.Text>
    </div>
  );
};

export const ExtraInfoLink = ({
  label,
  value,
  href,
  newTab = false,
  ellipsis = false,
}: {
  label: string;
  value: string | number;
  href: string;
  newTab?: boolean;
  ellipsis?: boolean;
}) => (
  <div
    className={classNames('d-flex  text-sm  flex-col gap-2', {
      'w-48': ellipsis,
    })}>
    {!isEmpty(label) && (
      <span className="extra-info-label-heading  m-r-xss">{label}</span>
    )}
    <div className="d-flex items-center gap-1">
      <Tooltip title={value}>
        <Typography.Link
          ellipsis
          className="extra-info-link"
          href={href}
          rel={newTab ? 'noopener noreferrer' : undefined}
          target={newTab ? '_blank' : undefined}>
          {value}
        </Typography.Link>
      </Tooltip>
      <Icon
        className="m-l-xs"
        component={IconExternalLink}
        style={DATA_ASSET_ICON_DIMENSION}
      />
    </div>
  </div>
);

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
            <>
              <Divider
                className="self-center vertical-divider"
                type="vertical"
              />
              <ExtraInfoLabel
                label={t('label.partition-plural')}
                value={topicDetails.partitions}
              />
            </>
          ) : null}
          {topicDetails?.replicationFactor && (
            <>
              <Divider
                className="self-center vertical-divider"
                type="vertical"
              />
              <ExtraInfoLabel
                label={t('label.replication-factor')}
                value={topicDetails.replicationFactor}
              />
            </>
          )}
        </>
      );

      break;

    case EntityType.DASHBOARD:
      const dashboardDetails = dataAsset as Dashboard;

      returnData.extraInfo = (
        <>
          {dashboardDetails.dashboardType && (
            <>
              <Divider
                className="self-center vertical-divider"
                type="vertical"
              />
              <ExtraInfoLabel
                label={t('label.entity-type-plural', {
                  entity: t('label.dashboard'),
                })}
                value={dashboardDetails.dashboardType}
              />
            </>
          )}
          {dashboardDetails.project && (
            <>
              <Divider
                className="self-center vertical-divider"
                type="vertical"
              />
              <ExtraInfoLabel
                label={t('label.project')}
                value={dashboardDetails.project}
              />
            </>
          )}
          {dashboardDetails?.usageSummary && (
            <>
              <Divider
                className="self-center vertical-divider"
                type="vertical"
              />
              <ExtraInfoLabel
                label={t('label.usage')}
                value={getUsagePercentile(
                  dashboardDetails.usageSummary?.weeklyStats?.percentileRank ??
                    0,
                  false
                )}
              />
            </>
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
          {pipelineDetails.state && (
            <>
              <Divider
                className="self-center vertical-divider"
                type="vertical"
              />
              <ExtraInfoLabel
                label={t('label.state')}
                value={pipelineDetails.state}
              />
            </>
          )}

          {pipelineDetails?.usageSummary && (
            <>
              <Divider
                className="self-center vertical-divider"
                type="vertical"
              />
              <ExtraInfoLabel
                label={t('label.usage')}
                value={getUsagePercentile(
                  pipelineDetails.usageSummary?.weeklyStats?.percentileRank ??
                    0,
                  false
                )}
              />
            </>
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
            <>
              <Divider
                className="self-center vertical-divider"
                type="vertical"
              />
              <ExtraInfoLabel
                label={t('label.algorithm')}
                value={mlModelDetail.algorithm}
              />
            </>
          )}
          {mlModelDetail.target && (
            <>
              <Divider
                className="self-center vertical-divider"
                type="vertical"
              />
              <ExtraInfoLabel
                label={t('label.target')}
                value={mlModelDetail.target}
              />
            </>
          )}
          {mlModelDetail.server && (
            <>
              <Divider
                className="self-center vertical-divider"
                type="vertical"
              />
              <ExtraInfoLink
                newTab
                href={mlModelDetail.server}
                label={t('label.server')}
                value={mlModelDetail.server}
              />
            </>
          )}
          {mlModelDetail.dashboard && (
            <>
              <Divider
                className="self-center vertical-divider"
                type="vertical"
              />
              <ExtraInfoLink
                href={getEntityDetailsPath(
                  EntityType.DASHBOARD,
                  mlModelDetail.dashboard?.fullyQualifiedName as string
                )}
                label={t('label.dashboard')}
                value={entityName}
              />
            </>
          )}
          {mlModelDetail?.usageSummary && (
            <>
              <Divider
                className="self-center vertical-divider"
                type="vertical"
              />
              <ExtraInfoLabel
                label={t('label.usage')}
                value={getUsagePercentile(
                  mlModelDetail.usageSummary?.weeklyStats?.percentileRank || 0,
                  false
                )}
              />
            </>
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
            <>
              <Divider
                className="self-center vertical-divider"
                type="vertical"
              />
              <ExtraInfoLabel
                label=""
                value={
                  containerDetails?.dataModel?.isPartitioned
                    ? (t('label.partitioned') as string)
                    : (t('label.non-partitioned') as string)
                }
              />
            </>
          )}
          {!isUndefined(containerDetails.numberOfObjects) && (
            <>
              <Divider
                className="self-center vertical-divider"
                type="vertical"
              />
              <ExtraInfoLabel
                label={t('label.number-of-object-plural')}
                value={containerDetails.numberOfObjects}
              />
            </>
          )}
          {!isUndefined(containerDetails.size) && (
            <>
              <Divider
                className="self-center vertical-divider"
                type="vertical"
              />
              <ExtraInfoLabel
                label={t('label.size')}
                value={bytesToSize(containerDetails.size)}
              />
            </>
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
            <>
              <Divider
                className="self-center vertical-divider"
                type="vertical"
              />
              <ExtraInfoLabel
                label={t('label.data-model-type')}
                value={dataModelDetails.dataModelType}
              />
            </>
          )}
          {dataModelDetails.project && (
            <>
              <Divider
                className="self-center vertical-divider"
                type="vertical"
              />
              <ExtraInfoLabel
                label={t('label.project')}
                value={dataModelDetails.project}
              />
            </>
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
    case EntityType.API_SERVICE:
      const apiServiceDetails = dataAsset as APIService;

      returnData.breadcrumbs = getEntityBreadcrumbs(
        apiServiceDetails,
        EntityType.API_SERVICE
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
          {isObject(storedProcedureDetails.storedProcedureCode) && (
            <>
              <Divider
                className="self-center vertical-divider"
                type="vertical"
              />
              <ExtraInfoLabel
                label={t('label.language')}
                value={
                  (
                    storedProcedureDetails.storedProcedureCode as StoredProcedureCodeObject
                  ).language ?? NO_DATA_PLACEHOLDER
                }
              />
            </>
          )}
        </>
      );

      returnData.breadcrumbs = getBreadcrumbForTable(dataAsset as Table);

      break;

    case EntityType.API_COLLECTION: {
      const apiCollection = dataAsset as APICollection;

      returnData.breadcrumbs = getEntityBreadcrumbs(
        apiCollection,
        EntityType.API_COLLECTION
      );

      returnData.extraInfo = (
        <>
          {apiCollection.endpointURL && (
            <>
              <Divider
                className="self-center vertical-divider"
                type="vertical"
              />
              <ExtraInfoLink
                newTab
                href={apiCollection.endpointURL}
                label={t('label.source-url')}
                value={apiCollection.endpointURL}
              />
            </>
          )}
        </>
      );

      break;
    }
    case EntityType.API_ENDPOINT: {
      const apiEndpoint = dataAsset as APIEndpoint;

      returnData.breadcrumbs = getEntityBreadcrumbs(
        apiEndpoint,
        EntityType.API_ENDPOINT
      );

      returnData.extraInfo = (
        <>
          {apiEndpoint.requestMethod && (
            <>
              <Divider
                className="self-center vertical-divider"
                type="vertical"
              />
              <ExtraInfoLabel
                dataTestId="api-endpoint-request-method"
                label={t('label.request-method')}
                value={apiEndpoint.requestMethod}
              />
            </>
          )}
          {apiEndpoint.endpointURL && (
            <>
              <Divider
                className="self-center vertical-divider"
                type="vertical"
              />
              <ExtraInfoLink
                newTab
                href={apiEndpoint.endpointURL}
                label={t('label.source-url')}
                value={apiEndpoint.endpointURL}
              />
            </>
          )}
        </>
      );

      break;
    }
    case EntityType.METRIC: {
      const metric = dataAsset as Metric;

      returnData.breadcrumbs = getEntityBreadcrumbs(metric, EntityType.METRIC);

      break;
    }

    case EntityType.TABLE:
    default:
      const tableDetails = dataAsset as Table;

      returnData.extraInfo = (
        <>
          {tableDetails.tableType && (
            <>
              <Divider
                className="self-center vertical-divider"
                type="vertical"
              />
              <ExtraInfoLabel
                label={t('label.type')}
                value={tableDetails.tableType}
              />
            </>
          )}
          {tableDetails?.usageSummary && (
            <>
              <Divider
                className="self-center vertical-divider"
                type="vertical"
              />
              <ExtraInfoLabel
                label={t('label.usage')}
                value={getUsagePercentile(
                  tableDetails.usageSummary?.weeklyStats?.percentileRank || 0,
                  false
                )}
              />
            </>
          )}
          {tableDetails?.profile?.columnCount && (
            <>
              <Divider
                className="self-center vertical-divider"
                type="vertical"
              />
              <ExtraInfoLabel
                label={t('label.column-plural')}
                value={tableDetails.profile?.columnCount}
              />
            </>
          )}
          {tableDetails?.profile?.rowCount && (
            <>
              <Divider
                className="self-center vertical-divider"
                type="vertical"
              />
              <ExtraInfoLabel
                label={t('label.row-plural')}
                value={tableDetails.profile?.rowCount}
              />
            </>
          )}
        </>
      );

      returnData.breadcrumbs = getBreadcrumbForTable(tableDetails);

      break;
  }

  return returnData;
};

export const isDataAssetsWithServiceField = (
  asset: DataAssetsType
): asset is DataAssetsWithServiceField => {
  return (asset as DataAssetsWithServiceField).service !== undefined;
};

export const getEntityExtraInfoLength = (element: ReactNode): number => {
  if (React.isValidElement(element)) {
    if (isArray(element.props.children)) {
      return element.props.children?.filter((child?: ReactNode) => child)
        .length;
    }
  }

  return 0;
};
