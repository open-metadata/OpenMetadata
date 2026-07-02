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

import {
  Tooltip,
  TooltipTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { isArray, isEmpty, isObject, isUndefined } from 'lodash';
import React, { ReactNode } from 'react';
import { ReactComponent as IconExternalLink } from '../assets/svg/external-links.svg';
import {
  DataAssetHeaderInfo,
  DataAssetsHeaderProps,
  DataAssetsType,
  DataAssetsWithServiceField,
} from '../components/DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import { NO_DATA_PLACEHOLDER } from '../constants/constants';
import { EntityType } from '../enums/entity.enum';
import { APICollection } from '../generated/entity/data/apiCollection';
import { APIEndpoint } from '../generated/entity/data/apiEndpoint';
import { Chart } from '../generated/entity/data/chart';
import { Container } from '../generated/entity/data/container';
import { Dashboard } from '../generated/entity/data/dashboard';
import { DashboardDataModel } from '../generated/entity/data/dashboardDataModel';
import { Database } from '../generated/entity/data/database';
import { DatabaseSchema } from '../generated/entity/data/databaseSchema';
import { Directory } from '../generated/entity/data/directory';
import { File } from '../generated/entity/data/file';
import { Metric } from '../generated/entity/data/metric';
import { Mlmodel } from '../generated/entity/data/mlmodel';
import { Pipeline } from '../generated/entity/data/pipeline';
import { SearchIndex } from '../generated/entity/data/searchIndex';
import { Spreadsheet } from '../generated/entity/data/spreadsheet';
import {
  StoredProcedure,
  StoredProcedureCodeObject,
} from '../generated/entity/data/storedProcedure';
import { Table } from '../generated/entity/data/table';
import { Topic } from '../generated/entity/data/topic';
import { Worksheet } from '../generated/entity/data/worksheet';
import { APIService } from '../generated/entity/services/apiService';
import { DashboardService } from '../generated/entity/services/dashboardService';
import { DatabaseService } from '../generated/entity/services/databaseService';
import { DriveService } from '../generated/entity/services/driveService';
import { MessagingService } from '../generated/entity/services/messagingService';
import { MetadataService } from '../generated/entity/services/metadataService';
import { MlmodelService } from '../generated/entity/services/mlmodelService';
import { PipelineService } from '../generated/entity/services/pipelineService';
import { SearchService } from '../generated/entity/services/searchService';
import { SecurityService } from '../generated/entity/services/securityService';
import { StorageService } from '../generated/entity/services/storageService';
import { EntityReference } from '../generated/type/entityReference';
import { formatDateTime } from './date-time/DateTimeUtils';
import { getEntityBreadcrumbs } from './EntityBreadcrumbPureUtils';
import {
  getBreadcrumbForEntitiesWithServiceOnly,
  getBreadcrumbForEntityWithParent,
  getBreadcrumbForTable,
} from './EntityDataBreadcrumbUtils';
import i18n from './i18next/LocalUtil';
import { getEntityDetailsPath } from './RouterUtils';
import { bytesToSize } from './StringUtils';
import { getUsagePercentile } from './TablePureUtils';

const { t } = i18n;

export const HeaderDotSeparator = () => (
  <span
    aria-hidden
    className="tw:mx-1 tw:inline-block tw:size-1 tw:shrink-0 tw:self-center tw:rounded-full tw:bg-fg-quaternary"
  />
);

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
        <HeaderDotSeparator />
        <Typography
          as="span"
          className="tw:self-center tw:whitespace-nowrap tw:text-xs"
          data-testid={dataTestId}
          size="text-xs">
          {!isEmpty(label) && (
            <span className="tw:text-tertiary">{`${label}: `}</span>
          )}
          <span className="tw:font-medium tw:text-primary">{value}</span>
        </Typography>
      </>
    );
  }

  return (
    <div className="tw:flex tw:flex-col tw:gap-1.5 extra-info-container header-extra-info-field">
      {!isEmpty(label) && (
        <Typography
          as="span"
          className="tw:whitespace-nowrap tw:text-secondary"
          data-testid={dataTestId ? `${dataTestId}-label` : undefined}
          ellipsis={{ tooltip: true }}
          size="text-sm"
          weight="medium">
          {label}
        </Typography>
      )}
      <Typography
        as="span"
        className="tw:whitespace-nowrap tw:text-primary"
        data-testid={dataTestId}
        ellipsis={{ tooltip: true }}
        size="text-sm"
        weight="medium">
        {value ?? NO_DATA_PLACEHOLDER}
      </Typography>
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
    className={classNames('tw:flex tw:flex-col tw:gap-1.5', {
      'tw:w-48': ellipsis,
    })}>
    {!isEmpty(label) && (
      <Typography
        as="span"
        className="tw:text-secondary"
        ellipsis={ellipsis ? { tooltip: true } : undefined}
        size="text-xs"
        weight="medium">
        {label}
      </Typography>
    )}
    <div className="tw:flex tw:items-center tw:gap-1">
      <Tooltip placement="top" title={value}>
        <TooltipTrigger className="tw:max-w-full tw:truncate">
          <a
            className="tw:truncate tw:text-sm tw:font-medium tw:text-brand-secondary tw:hover:text-brand-secondary_hover"
            href={href}
            rel={newTab ? 'noopener noreferrer' : undefined}
            target={newTab ? '_blank' : undefined}>
            {value}
          </a>
        </TooltipTrigger>
      </Tooltip>
      <IconExternalLink
        className="tw:text-fg-quaternary"
        height={18}
        width={18}
      />
    </div>
  </div>
);

export const getDataAssetsHeaderInfo = (
  entityType: DataAssetsHeaderProps['entityType'],
  dataAsset: DataAssetsHeaderProps['dataAsset'],
  entityName: string,
  parentContainers: EntityReference[]
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
              <HeaderDotSeparator />
              <ExtraInfoLabel
                label={t('label.partition-plural')}
                value={topicDetails.partitions}
              />
            </>
          ) : null}
          {topicDetails?.replicationFactor && (
            <>
              <HeaderDotSeparator />
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
              <HeaderDotSeparator />
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
              <HeaderDotSeparator />
              <ExtraInfoLabel
                label={t('label.project')}
                value={dashboardDetails.project}
              />
            </>
          )}
          {dashboardDetails?.usageSummary && (
            <>
              <HeaderDotSeparator />
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
              <HeaderDotSeparator />
              <ExtraInfoLabel
                label={t('label.state')}
                value={pipelineDetails.state}
              />
            </>
          )}

          {pipelineDetails?.usageSummary && (
            <>
              <HeaderDotSeparator />
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
              <HeaderDotSeparator />
              <ExtraInfoLabel
                label={t('label.algorithm')}
                value={mlModelDetail.algorithm}
              />
            </>
          )}
          {mlModelDetail.target && (
            <>
              <HeaderDotSeparator />
              <ExtraInfoLabel
                label={t('label.target')}
                value={mlModelDetail.target}
              />
            </>
          )}
          {mlModelDetail.server && (
            <>
              <HeaderDotSeparator />
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
              <HeaderDotSeparator />
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
              <HeaderDotSeparator />
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
              <HeaderDotSeparator />
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
              <HeaderDotSeparator />
              <ExtraInfoLabel
                label={t('label.number-of-object-plural')}
                value={containerDetails.numberOfObjects}
              />
            </>
          )}
          {!isUndefined(containerDetails.size) && (
            <>
              <HeaderDotSeparator />
              <ExtraInfoLabel
                label={t('label.size')}
                value={bytesToSize(containerDetails.size)}
              />
            </>
          )}
        </>
      );

      returnData.breadcrumbs = getBreadcrumbForEntityWithParent({
        entity: containerDetails,
        entityType: EntityType.CONTAINER,
        parents: parentContainers,
      });

      break;

    case EntityType.DASHBOARD_DATA_MODEL:
      const dataModelDetails = dataAsset as DashboardDataModel;

      returnData.extraInfo = (
        <>
          {dataModelDetails.dataModelType && (
            <>
              <HeaderDotSeparator />
              <ExtraInfoLabel
                label={t('label.data-model-type')}
                value={dataModelDetails.dataModelType}
              />
            </>
          )}
          {dataModelDetails.project && (
            <>
              <HeaderDotSeparator />
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
        EntityType.DATABASE_SCHEMA
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

    case EntityType.SECURITY_SERVICE:
      const securityServiceDetails = dataAsset as SecurityService;

      returnData.breadcrumbs = getEntityBreadcrumbs(
        securityServiceDetails,
        EntityType.SECURITY_SERVICE
      );

      break;

    case EntityType.DRIVE_SERVICE:
      const driveServiceDetails = dataAsset as DriveService;

      returnData.breadcrumbs = getEntityBreadcrumbs(
        driveServiceDetails,
        EntityType.DRIVE_SERVICE
      );

      break;

    case EntityType.STORED_PROCEDURE:
      const storedProcedureDetails = dataAsset as StoredProcedure;

      returnData.extraInfo = (
        <>
          {isObject(storedProcedureDetails.storedProcedureCode) && (
            <>
              <HeaderDotSeparator />
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
              <HeaderDotSeparator />
              <ExtraInfoLabel
                dataTestId="api-endpoint-request-method"
                label={t('label.request-method')}
                value={apiEndpoint.requestMethod}
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
    case EntityType.CHART: {
      const chart = dataAsset as Chart;

      returnData.breadcrumbs = getEntityBreadcrumbs(chart, EntityType.CHART);

      break;
    }
    case EntityType.DIRECTORY: {
      const directory = dataAsset as Directory;

      returnData.breadcrumbs = getEntityBreadcrumbs(
        directory,
        EntityType.DIRECTORY
      );

      returnData.extraInfo = (
        <>
          {directory.directoryType && (
            <>
              <HeaderDotSeparator />
              <ExtraInfoLabel
                label={t('label.type')}
                value={directory.directoryType}
              />
            </>
          )}
          {directory.numberOfFiles !== undefined && (
            <>
              <HeaderDotSeparator />
              <ExtraInfoLabel
                label={t('label.file-plural')}
                value={directory.numberOfFiles}
              />
            </>
          )}
          {directory.numberOfSubDirectories !== undefined && (
            <>
              <HeaderDotSeparator />
              <ExtraInfoLabel
                label={t('label.subdirectory-plural')}
                value={directory.numberOfSubDirectories}
              />
            </>
          )}
        </>
      );

      break;
    }

    case EntityType.FILE: {
      const file = dataAsset as File;
      returnData.breadcrumbs = getEntityBreadcrumbs(file, EntityType.FILE);

      returnData.extraInfo = (
        <>
          {file.fileType && (
            <>
              <HeaderDotSeparator />
              <ExtraInfoLabel label={t('label.type')} value={file.fileType} />
            </>
          )}
          {file.fileExtension !== undefined && (
            <>
              <HeaderDotSeparator />
              <ExtraInfoLabel
                label={t('label.extension')}
                value={file.fileExtension}
              />
            </>
          )}
          {file.fileVersion !== undefined && (
            <>
              <HeaderDotSeparator />
              <ExtraInfoLabel
                label={t('label.version')}
                value={file.fileVersion}
              />
            </>
          )}
        </>
      );

      break;
    }

    case EntityType.SPREADSHEET: {
      const spreadsheet = dataAsset as Spreadsheet;

      returnData.breadcrumbs = getEntityBreadcrumbs(
        spreadsheet,
        EntityType.SPREADSHEET
      );

      returnData.extraInfo = (
        <>
          {spreadsheet.mimeType && (
            <>
              <HeaderDotSeparator />
              <ExtraInfoLabel
                label={t('label.mime-type')}
                value={
                  <Typography
                    as="span"
                    className="tw:text-primary"
                    ellipsis={{ tooltip: spreadsheet.mimeType }}
                    size="text-sm"
                    weight="medium">
                    {spreadsheet.mimeType}
                  </Typography>
                }
              />
            </>
          )}
          {spreadsheet.createdTime !== undefined && (
            <>
              <HeaderDotSeparator />
              <ExtraInfoLabel
                label={t('label.created-time')}
                value={formatDateTime(spreadsheet.createdTime)}
              />
            </>
          )}
          {spreadsheet.modifiedTime !== undefined && (
            <>
              <HeaderDotSeparator />
              <ExtraInfoLabel
                label={t('label.modified-time')}
                value={formatDateTime(spreadsheet.modifiedTime)}
              />
            </>
          )}
        </>
      );

      break;
    }

    case EntityType.WORKSHEET: {
      const worksheet = dataAsset as Worksheet;
      returnData.breadcrumbs = getEntityBreadcrumbs(
        worksheet,
        EntityType.WORKSHEET
      );

      returnData.extraInfo = (
        <>
          {worksheet.rowCount && (
            <>
              <HeaderDotSeparator />
              <ExtraInfoLabel
                label={t('label.row-count')}
                value={worksheet.rowCount}
              />
            </>
          )}
        </>
      );

      break;
    }

    case EntityType.TABLE:
    default:
      const tableDetails = dataAsset as Table;

      returnData.extraInfo = (
        <>
          {tableDetails.tableType && (
            <>
              <HeaderDotSeparator />
              <ExtraInfoLabel
                label={t('label.type')}
                value={tableDetails.tableType}
              />
            </>
          )}
          {tableDetails?.usageSummary && (
            <>
              <HeaderDotSeparator />
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
              <HeaderDotSeparator />
              <ExtraInfoLabel
                label={t('label.column-plural')}
                value={tableDetails.profile?.columnCount}
              />
            </>
          )}
          {tableDetails?.profile?.rowCount && (
            <>
              <HeaderDotSeparator />
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
