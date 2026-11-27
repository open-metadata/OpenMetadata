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
import { LinkExternal01 } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { isEmpty, isNil, isObject, isUndefined } from 'lodash';
import React, { ReactNode } from 'react';
import {
  DataAssetHeaderInfo,
  DataAssetsHeaderProps,
  DataAssetsType,
  DataAssetsWithoutServiceField,
  DataAssetsWithServiceField,
} from '../components/DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import { HeaderProperty } from '../components/DataAssets/EntityHeaderProperties/EntityHeaderProperties.types';
import { NO_DATA_PLACEHOLDER } from '../constants/constants';
import { HeaderPropertyId } from '../constants/EntityHeaderProperties.constants';
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
import {
  DATE_TIME_12_HOUR_FORMAT,
  formatDateTime,
  formatDateTimeLong,
  getRelativeTime,
} from './date-time/DateTimeUtils';
import { getEntityBreadcrumbs } from './EntityBreadcrumbPureUtils';
import {
  getBreadcrumbForEntitiesWithServiceOnly,
  getBreadcrumbForEntityWithParent,
  getBreadcrumbForTable,
} from './EntityDataBreadcrumbUtils';
import i18n from './i18next/LocalUtil';
import { getEntityDetailsPath } from './RouterUtils';
import { bytesToSize, getSafeHttpUrl } from './StringUtils';
import { getUsagePercentile } from './TablePureUtils';

// A life cycle time before the Unix epoch is the year-0001 placeholder older ingestion stored for a
// source that reported none (ADR:2026-10-29-lifecycle-timestamps-before-the-epoch-are-dropped-on-write).
export const isRecordedLifeCycleTimestamp = (
  timestamp?: number
): timestamp is number => timestamp !== undefined && timestamp >= 0;

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
  tooltip,
  inlineLayout = false,
}: {
  label: string;
  value: string | number | React.ReactNode;
  dataTestId?: string;
  tooltip?: React.ReactNode;
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
        ellipsis={tooltip ? true : { tooltip: true }}
        size="text-sm"
        tooltip={tooltip}
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
      <LinkExternal01 className="tw:text-fg-quaternary" size={18} />
    </div>
  </div>
);

const getUsageValue = (percentileRank?: number) =>
  isUndefined(percentileRank)
    ? undefined
    : getUsagePercentile(percentileRank, false);

interface ReadOnlyPropertyOptions {
  dataTestId?: string;
  tooltip?: ReactNode;
  /** Renders the value as a link to this address. */
  href?: string;
  newTab?: boolean;
}

const readOnlyProperty = (
  id: HeaderPropertyId,
  label: string,
  value: ReactNode,
  { dataTestId, tooltip, href, newTab }: ReadOnlyPropertyOptions = {}
): HeaderProperty => {
  return {
    id,
    label,
    isReadOnly: true,
    isEmpty: isNil(value) || value === '',
    content: href ? (
      <ExtraInfoLink
        href={href}
        label=""
        newTab={newTab}
        value={value as string}
      />
    ) : (
      <ExtraInfoLabel
        dataTestId={dataTestId}
        label=""
        tooltip={tooltip}
        value={value}
      />
    ),
  };
};

const createdTimeProperty = (
  timestamp: number | undefined,
  dataTestId: string
) =>
  readOnlyProperty(
    HeaderPropertyId.CreatedTime,
    t('label.created-time'),
    isRecordedLifeCycleTimestamp(timestamp)
      ? formatDateTimeLong(timestamp, DATE_TIME_12_HOUR_FORMAT)
      : undefined,
    {
      dataTestId,
      tooltip: isRecordedLifeCycleTimestamp(timestamp)
        ? formatDateTime(timestamp)
        : undefined,
    }
  );

// lifeCycle.updated is when the asset last changed at its source, set by
// ingestion from the source's metadata or the usage workflow's query log; it
// is not when the entity was edited in OpenMetadata.
export const getSourceUpdatedAtProperty = (timestamp?: number) =>
  readOnlyProperty(
    HeaderPropertyId.SourceUpdatedAt,
    t('label.updated-at-source'),
    isRecordedLifeCycleTimestamp(timestamp)
      ? getRelativeTime(timestamp)
      : undefined,
    {
      dataTestId: 'source-updated-at',
      tooltip: isRecordedLifeCycleTimestamp(timestamp)
        ? formatDateTime(timestamp)
        : undefined,
    }
  );

type HeaderInfoBuilder = (
  dataAsset: DataAssetsHeaderProps['dataAsset'],
  entityName: string,
  parentContainers: EntityReference[]
) => DataAssetHeaderInfo;

const getTopicHeaderInfo: HeaderInfoBuilder = (dataAsset) => {
  const topicDetails = dataAsset as Topic;

  return {
    breadcrumbs: getBreadcrumbForEntitiesWithServiceOnly(topicDetails),
    extraInfo: [
      readOnlyProperty(
        HeaderPropertyId.Partitions,
        t('label.partition-plural'),
        topicDetails.partitions || undefined
      ),
      readOnlyProperty(
        HeaderPropertyId.ReplicationFactor,
        t('label.replication-factor'),
        topicDetails.replicationFactor || undefined
      ),
    ],
  };
};

const getDashboardHeaderInfo: HeaderInfoBuilder = (dataAsset) => {
  const dashboardDetails = dataAsset as Dashboard;

  return {
    breadcrumbs: getBreadcrumbForEntitiesWithServiceOnly(dashboardDetails),
    extraInfo: [
      readOnlyProperty(
        HeaderPropertyId.Type,
        t('label.entity-type-plural', { entity: t('label.dashboard') }),
        dashboardDetails.dashboardType
      ),
      readOnlyProperty(
        HeaderPropertyId.Project,
        t('label.project'),
        dashboardDetails.project
      ),
      readOnlyProperty(
        HeaderPropertyId.Usage,
        t('label.usage'),
        dashboardDetails.usageSummary &&
          getUsageValue(
            dashboardDetails.usageSummary.weeklyStats?.percentileRank ?? 0
          )
      ),
    ],
  };
};

const getPipelineHeaderInfo: HeaderInfoBuilder = (dataAsset) => {
  const pipelineDetails = dataAsset as Pipeline;

  return {
    breadcrumbs: getBreadcrumbForEntitiesWithServiceOnly(pipelineDetails),
    extraInfo: [
      readOnlyProperty(
        HeaderPropertyId.State,
        t('label.state'),
        pipelineDetails.state
      ),
      readOnlyProperty(
        HeaderPropertyId.Usage,
        t('label.usage'),
        pipelineDetails.usageSummary &&
          getUsageValue(
            pipelineDetails.usageSummary.weeklyStats?.percentileRank ?? 0
          )
      ),
    ],
  };
};

const getMlModelHeaderInfo: HeaderInfoBuilder = (dataAsset, entityName) => {
  const mlModelDetail = dataAsset as Mlmodel;
  const safeServerUrl = getSafeHttpUrl(mlModelDetail.server);

  return {
    breadcrumbs: getBreadcrumbForEntitiesWithServiceOnly(mlModelDetail),
    extraInfo: [
      readOnlyProperty(
        HeaderPropertyId.Algorithm,
        t('label.algorithm'),
        mlModelDetail.algorithm
      ),
      readOnlyProperty(
        HeaderPropertyId.Target,
        t('label.target'),
        mlModelDetail.target
      ),
      readOnlyProperty(
        HeaderPropertyId.Server,
        t('label.server'),
        mlModelDetail.server,
        { href: safeServerUrl, newTab: true }
      ),
      readOnlyProperty(
        HeaderPropertyId.Dashboard,
        t('label.dashboard'),
        mlModelDetail.dashboard && entityName,
        {
          href:
            mlModelDetail.dashboard &&
            getEntityDetailsPath(
              EntityType.DASHBOARD,
              mlModelDetail.dashboard.fullyQualifiedName as string
            ),
        }
      ),
      readOnlyProperty(
        HeaderPropertyId.Usage,
        t('label.usage'),
        mlModelDetail.usageSummary &&
          getUsageValue(
            mlModelDetail.usageSummary.weeklyStats?.percentileRank || 0
          )
      ),
    ],
  };
};

const getContainerHeaderInfo: HeaderInfoBuilder = (
  dataAsset,
  _entityName,
  parentContainers
) => {
  const containerDetails = dataAsset as Container;
  const isPartitioned = containerDetails.dataModel?.isPartitioned;
  const partitionedLabel = t(isPartitioned ? 'label.yes' : 'label.no');

  return {
    breadcrumbs: getBreadcrumbForEntityWithParent({
      entity: containerDetails,
      entityType: EntityType.CONTAINER,
      parents: parentContainers,
    }),
    extraInfo: [
      readOnlyProperty(
        HeaderPropertyId.Partitioned,
        t('label.partitioned'),
        isUndefined(isPartitioned) ? undefined : partitionedLabel
      ),
      readOnlyProperty(
        HeaderPropertyId.NumberOfObjects,
        t('label.number-of-object-plural'),
        containerDetails.numberOfObjects
      ),
      readOnlyProperty(
        HeaderPropertyId.Size,
        t('label.size'),
        isUndefined(containerDetails.size)
          ? undefined
          : bytesToSize(containerDetails.size)
      ),
    ],
  };
};

const getDashboardDataModelHeaderInfo: HeaderInfoBuilder = (dataAsset) => {
  const dataModelDetails = dataAsset as DashboardDataModel;

  return {
    breadcrumbs: getBreadcrumbForEntitiesWithServiceOnly(dataModelDetails),
    extraInfo: [
      readOnlyProperty(
        HeaderPropertyId.Type,
        t('label.data-model-type'),
        dataModelDetails.dataModelType
      ),
      readOnlyProperty(
        HeaderPropertyId.Project,
        t('label.project'),
        dataModelDetails.project
      ),
    ],
  };
};

const getStoredProcedureHeaderInfo: HeaderInfoBuilder = (dataAsset) => {
  const { storedProcedureCode } = dataAsset as StoredProcedure;
  const code = isObject(storedProcedureCode)
    ? (storedProcedureCode as StoredProcedureCodeObject)
    : undefined;

  return {
    breadcrumbs: getBreadcrumbForTable(dataAsset as Table),
    extraInfo: [
      readOnlyProperty(
        HeaderPropertyId.Language,
        t('label.language'),
        code && (code.language ?? NO_DATA_PLACEHOLDER)
      ),
    ],
  };
};

const getApiEndpointHeaderInfo: HeaderInfoBuilder = (dataAsset) => {
  const apiEndpoint = dataAsset as APIEndpoint;

  return {
    breadcrumbs: getEntityBreadcrumbs(apiEndpoint, EntityType.API_ENDPOINT),
    extraInfo: [
      readOnlyProperty(
        HeaderPropertyId.RequestMethod,
        t('label.request-method'),
        apiEndpoint.requestMethod,
        { dataTestId: 'api-endpoint-request-method' }
      ),
    ],
  };
};

const getDirectoryHeaderInfo: HeaderInfoBuilder = (dataAsset) => {
  const directory = dataAsset as Directory;

  return {
    breadcrumbs: getEntityBreadcrumbs(directory, EntityType.DIRECTORY),
    extraInfo: [
      readOnlyProperty(
        HeaderPropertyId.Type,
        t('label.type'),
        directory.directoryType
      ),
      readOnlyProperty(
        HeaderPropertyId.Files,
        t('label.file-plural'),
        directory.numberOfFiles
      ),
      readOnlyProperty(
        HeaderPropertyId.SubDirectories,
        t('label.subdirectory-plural'),
        directory.numberOfSubDirectories
      ),
    ],
  };
};

const getFileHeaderInfo: HeaderInfoBuilder = (dataAsset) => {
  const file = dataAsset as File;

  return {
    breadcrumbs: getEntityBreadcrumbs(file, EntityType.FILE),
    extraInfo: [
      readOnlyProperty(HeaderPropertyId.Type, t('label.type'), file.fileType),
      readOnlyProperty(
        HeaderPropertyId.FileExtension,
        t('label.extension'),
        file.fileExtension
      ),
      readOnlyProperty(
        HeaderPropertyId.FileVersion,
        t('label.version'),
        file.fileVersion
      ),
    ],
  };
};

const getSpreadsheetHeaderInfo: HeaderInfoBuilder = (dataAsset) => {
  const spreadsheet = dataAsset as Spreadsheet;

  return {
    breadcrumbs: getEntityBreadcrumbs(spreadsheet, EntityType.SPREADSHEET),
    extraInfo: [
      readOnlyProperty(
        HeaderPropertyId.MimeType,
        t('label.mime-type'),
        spreadsheet.mimeType && (
          <Typography
            as="span"
            className="tw:text-primary"
            ellipsis={{ tooltip: spreadsheet.mimeType }}
            size="text-sm"
            weight="medium">
            {spreadsheet.mimeType}
          </Typography>
        )
      ),
      createdTimeProperty(spreadsheet.createdTime, 'spreadsheet-created-time'),
      readOnlyProperty(
        HeaderPropertyId.ModifiedTime,
        t('label.modified-time'),
        isUndefined(spreadsheet.modifiedTime)
          ? undefined
          : formatDateTime(spreadsheet.modifiedTime)
      ),
    ],
  };
};

const getWorksheetHeaderInfo: HeaderInfoBuilder = (dataAsset) => ({
  breadcrumbs: getEntityBreadcrumbs(
    dataAsset as Worksheet,
    EntityType.WORKSHEET
  ),
  extraInfo: [
    readOnlyProperty(
      HeaderPropertyId.Rows,
      t('label.row-count'),
      (dataAsset as Worksheet).rowCount || undefined
    ),
  ],
});

const getSearchIndexHeaderInfo: HeaderInfoBuilder = (dataAsset) => ({
  breadcrumbs: getBreadcrumbForEntitiesWithServiceOnly(
    dataAsset as SearchIndex
  ),
  extraInfo: [],
});

const getTableHeaderInfo: HeaderInfoBuilder = (dataAsset) => {
  const tableDetails = dataAsset as Table;

  return {
    breadcrumbs: getBreadcrumbForTable(tableDetails),
    extraInfo: [
      readOnlyProperty(
        HeaderPropertyId.Type,
        t('label.type'),
        tableDetails.tableType
      ),
      readOnlyProperty(
        HeaderPropertyId.Usage,
        t('label.usage'),
        tableDetails.usageSummary &&
          getUsageValue(
            tableDetails.usageSummary.weeklyStats?.percentileRank || 0
          )
      ),
      readOnlyProperty(
        HeaderPropertyId.Columns,
        t('label.column-plural'),
        tableDetails.profile?.columnCount || undefined
      ),
      readOnlyProperty(
        HeaderPropertyId.Rows,
        t('label.row-plural'),
        tableDetails.profile?.rowCount || undefined
      ),
      createdTimeProperty(
        tableDetails.lifeCycle?.created?.timestamp,
        'table-created-time'
      ),
    ],
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
    extraInfo: [],
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
