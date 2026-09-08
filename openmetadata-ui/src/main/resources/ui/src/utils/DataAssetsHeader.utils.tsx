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
  DataAssetsWithoutServiceField,
  DataAssetsWithServiceField,
} from '../components/DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import { NO_DATA_PLACEHOLDER } from '../constants/constants';
import { EntityType } from '../enums/entity.enum';
import { APIEndpoint } from '../generated/entity/data/apiEndpoint';
import { Container } from '../generated/entity/data/container';
import { Dashboard } from '../generated/entity/data/dashboard';
import { DashboardDataModel } from '../generated/entity/data/dashboardDataModel';
import { Directory } from '../generated/entity/data/directory';
import { File } from '../generated/entity/data/file';
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

const EMPTY_EXTRA_INFO = <></>;

type HeaderInfoBuilder = (
  dataAsset: DataAssetsHeaderProps['dataAsset'],
  entityName: string,
  parentContainers: EntityReference[]
) => DataAssetHeaderInfo;

const getTopicHeaderInfo: HeaderInfoBuilder = (dataAsset) => {
  const topicDetails = dataAsset as Topic;

  return {
    breadcrumbs: getBreadcrumbForEntitiesWithServiceOnly(topicDetails),
    extraInfo: (
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
    ),
  };
};

const getDashboardHeaderInfo: HeaderInfoBuilder = (dataAsset) => {
  const dashboardDetails = dataAsset as Dashboard;

  return {
    breadcrumbs: getBreadcrumbForEntitiesWithServiceOnly(dashboardDetails),
    extraInfo: (
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
                dashboardDetails.usageSummary?.weeklyStats?.percentileRank ?? 0,
                false
              )}
            />
          </>
        )}
      </>
    ),
  };
};

const getPipelineHeaderInfo: HeaderInfoBuilder = (dataAsset) => {
  const pipelineDetails = dataAsset as Pipeline;

  return {
    breadcrumbs: getBreadcrumbForEntitiesWithServiceOnly(pipelineDetails),
    extraInfo: (
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
                pipelineDetails.usageSummary?.weeklyStats?.percentileRank ?? 0,
                false
              )}
            />
          </>
        )}
      </>
    ),
  };
};

const getMlModelHeaderInfo: HeaderInfoBuilder = (dataAsset, entityName) => {
  const mlModelDetail = dataAsset as Mlmodel;

  return {
    breadcrumbs: getBreadcrumbForEntitiesWithServiceOnly(mlModelDetail),
    extraInfo: (
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
    ),
  };
};

const getContainerHeaderInfo: HeaderInfoBuilder = (
  dataAsset,
  _entityName,
  parentContainers
) => {
  const containerDetails = dataAsset as Container;

  return {
    breadcrumbs: getBreadcrumbForEntityWithParent({
      entity: containerDetails,
      entityType: EntityType.CONTAINER,
      parents: parentContainers,
    }),
    extraInfo: (
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
    ),
  };
};

const getDashboardDataModelHeaderInfo: HeaderInfoBuilder = (dataAsset) => {
  const dataModelDetails = dataAsset as DashboardDataModel;

  return {
    breadcrumbs: getBreadcrumbForEntitiesWithServiceOnly(dataModelDetails),
    extraInfo: (
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
    ),
  };
};

const getStoredProcedureHeaderInfo: HeaderInfoBuilder = (dataAsset) => {
  const storedProcedureDetails = dataAsset as StoredProcedure;

  return {
    breadcrumbs: getBreadcrumbForTable(dataAsset as Table),
    extraInfo: (
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
    ),
  };
};

const getApiEndpointHeaderInfo: HeaderInfoBuilder = (dataAsset) => {
  const apiEndpoint = dataAsset as APIEndpoint;

  return {
    breadcrumbs: getEntityBreadcrumbs(apiEndpoint, EntityType.API_ENDPOINT),
    extraInfo: (
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
    ),
  };
};

const getDirectoryHeaderInfo: HeaderInfoBuilder = (dataAsset) => {
  const directory = dataAsset as Directory;

  return {
    breadcrumbs: getEntityBreadcrumbs(directory, EntityType.DIRECTORY),
    extraInfo: (
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
    ),
  };
};

const getFileHeaderInfo: HeaderInfoBuilder = (dataAsset) => {
  const file = dataAsset as File;

  return {
    breadcrumbs: getEntityBreadcrumbs(file, EntityType.FILE),
    extraInfo: (
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
    ),
  };
};

const getSpreadsheetHeaderInfo: HeaderInfoBuilder = (dataAsset) => {
  const spreadsheet = dataAsset as Spreadsheet;

  return {
    breadcrumbs: getEntityBreadcrumbs(spreadsheet, EntityType.SPREADSHEET),
    extraInfo: (
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
    ),
  };
};

const getWorksheetHeaderInfo: HeaderInfoBuilder = (dataAsset) => {
  const worksheet = dataAsset as Worksheet;

  return {
    breadcrumbs: getEntityBreadcrumbs(worksheet, EntityType.WORKSHEET),
    extraInfo: (
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
    ),
  };
};

const getSearchIndexHeaderInfo: HeaderInfoBuilder = (dataAsset) => ({
  breadcrumbs: getBreadcrumbForEntitiesWithServiceOnly(
    dataAsset as SearchIndex
  ),
  extraInfo: EMPTY_EXTRA_INFO,
});

const getTableHeaderInfo: HeaderInfoBuilder = (dataAsset) => {
  const tableDetails = dataAsset as Table;

  return {
    breadcrumbs: getBreadcrumbForTable(tableDetails),
    extraInfo: (
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
    ),
  };
};

// Service-type assets only render breadcrumbs via getEntityBreadcrumbs.
const makeBreadcrumbOnlyBuilder =
  (breadcrumbEntityType: EntityType): HeaderInfoBuilder =>
  (dataAsset) => ({
    breadcrumbs: getEntityBreadcrumbs(
      dataAsset as DataAssetsWithoutServiceField,
      breadcrumbEntityType
    ),
    extraInfo: EMPTY_EXTRA_INFO,
  });

const entityHeaderInfoBuilders: Partial<Record<EntityType, HeaderInfoBuilder>> =
  {
    [EntityType.TOPIC]: getTopicHeaderInfo,
    [EntityType.DASHBOARD]: getDashboardHeaderInfo,
    [EntityType.PIPELINE]: getPipelineHeaderInfo,
    [EntityType.MLMODEL]: getMlModelHeaderInfo,
    [EntityType.CONTAINER]: getContainerHeaderInfo,
    [EntityType.DASHBOARD_DATA_MODEL]: getDashboardDataModelHeaderInfo,
    [EntityType.STORED_PROCEDURE]: getStoredProcedureHeaderInfo,
    [EntityType.API_ENDPOINT]: getApiEndpointHeaderInfo,
    [EntityType.DIRECTORY]: getDirectoryHeaderInfo,
    [EntityType.FILE]: getFileHeaderInfo,
    [EntityType.SPREADSHEET]: getSpreadsheetHeaderInfo,
    [EntityType.WORKSHEET]: getWorksheetHeaderInfo,
    [EntityType.SEARCH_INDEX]: getSearchIndexHeaderInfo,
    [EntityType.DATABASE]: makeBreadcrumbOnlyBuilder(EntityType.DATABASE),
    [EntityType.DATABASE_SCHEMA]: makeBreadcrumbOnlyBuilder(
      EntityType.DATABASE_SCHEMA
    ),
    [EntityType.DATABASE_SERVICE]: makeBreadcrumbOnlyBuilder(
      EntityType.DATABASE_SERVICE
    ),
    [EntityType.API_SERVICE]: makeBreadcrumbOnlyBuilder(EntityType.API_SERVICE),
    [EntityType.DASHBOARD_SERVICE]: makeBreadcrumbOnlyBuilder(
      EntityType.DASHBOARD_SERVICE
    ),
    [EntityType.MESSAGING_SERVICE]: makeBreadcrumbOnlyBuilder(
      EntityType.MESSAGING_SERVICE
    ),
    [EntityType.PIPELINE_SERVICE]: makeBreadcrumbOnlyBuilder(
      EntityType.PIPELINE_SERVICE
    ),
    [EntityType.MLMODEL_SERVICE]: makeBreadcrumbOnlyBuilder(
      EntityType.MLMODEL_SERVICE
    ),
    [EntityType.METADATA_SERVICE]: makeBreadcrumbOnlyBuilder(
      EntityType.METADATA_SERVICE
    ),
    [EntityType.STORAGE_SERVICE]: makeBreadcrumbOnlyBuilder(
      EntityType.STORAGE_SERVICE
    ),
    [EntityType.SEARCH_SERVICE]: makeBreadcrumbOnlyBuilder(
      EntityType.SEARCH_SERVICE
    ),
    [EntityType.SECURITY_SERVICE]: makeBreadcrumbOnlyBuilder(
      EntityType.SECURITY_SERVICE
    ),
    [EntityType.DRIVE_SERVICE]: makeBreadcrumbOnlyBuilder(
      EntityType.DRIVE_SERVICE
    ),
    [EntityType.API_COLLECTION]: makeBreadcrumbOnlyBuilder(
      EntityType.API_COLLECTION
    ),
    [EntityType.METRIC]: makeBreadcrumbOnlyBuilder(EntityType.METRIC),
    [EntityType.CHART]: makeBreadcrumbOnlyBuilder(EntityType.CHART),
  };

export const getDataAssetsHeaderInfo = (
  entityType: DataAssetsHeaderProps['entityType'],
  dataAsset: DataAssetsHeaderProps['dataAsset'],
  entityName: string,
  parentContainers: EntityReference[]
) => {
  // TABLE and any unmapped entity type fall back to the table header info.
  const builder = entityHeaderInfoBuilders[entityType] ?? getTableHeaderInfo;

  return builder(dataAsset, entityName, parentContainers);
};

export const isDataAssetsWithServiceField = (
  asset: DataAssetsType
): asset is DataAssetsWithServiceField => {
  return (asset as DataAssetsWithServiceField).service !== undefined;
};

export const getEntityExtraInfoLength = (element: ReactNode): number => {
  if (React.isValidElement(element) && isArray(element.props.children)) {
    return element.props.children?.filter((child?: ReactNode) => child).length;
  }

  return 0;
};
