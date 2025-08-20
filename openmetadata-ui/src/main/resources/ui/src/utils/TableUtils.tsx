/*
 *  Copyright 2022 Collate.
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

import Icon, { SearchOutlined } from '@ant-design/icons';
import { Space, Tooltip, Typography } from 'antd';
import { ExpandableConfig } from 'antd/lib/table/interface';
import classNames from 'classnames';
import {
  get,
  isEmpty,
  isUndefined,
  lowerCase,
  omit,
  toString,
  uniqBy,
  uniqueId,
  upperCase,
} from 'lodash';
import { EntityTags } from 'Models';
import { CSSProperties, Fragment } from 'react';
import { NavigateFunction } from 'react-router-dom';
import ImportIcon from '..//assets/svg/ic-import.svg?react';
import AlertIcon from '../assets/svg/alert.svg?react';
import AnnouncementIcon from '../assets/svg/announcements-black.svg?react';
import ApplicationIcon from '../assets/svg/application.svg?react';
import AutomatorBotIcon from '../assets/svg/automator-bot.svg?react';
import GlossaryTermIcon from '../assets/svg/book.svg?react';
import BotIcon from '../assets/svg/bot.svg?react';
import ChartIcon from '../assets/svg/chart.svg?react';
import ClassificationIcon from '../assets/svg/classification.svg?react';
import ConversationIcon from '../assets/svg/comment.svg?react';
import QueryIcon from '../assets/svg/customproperties/sql-query.svg?react';
import IconDataModel from '../assets/svg/data-model.svg?react';
import IconArray from '../assets/svg/data-type-icon/array.svg?react';
import IconBinary from '../assets/svg/data-type-icon/binary.svg?react';
import IconBitmap from '../assets/svg/data-type-icon/bitmap.svg?react';
import IconBoolean from '../assets/svg/data-type-icon/boolean.svg?react';
import IconDateTime from '../assets/svg/data-type-icon/data-time-range.svg?react';
import IconDate from '../assets/svg/data-type-icon/date.svg?react';
import IconDecimal from '../assets/svg/data-type-icon/decimal.svg?react';
import IconDouble from '../assets/svg/data-type-icon/double.svg?react';
import IconEnum from '../assets/svg/data-type-icon/enum.svg?react';
import IconError from '../assets/svg/data-type-icon/error.svg?react';
import IconGeometry from '../assets/svg/data-type-icon/geometry.svg?react';
import IconInteger from '../assets/svg/data-type-icon/integer.svg?react';
import IconIpVersion from '../assets/svg/data-type-icon/ipv6.svg?react';
import IconJson from '../assets/svg/data-type-icon/json.svg?react';
import IconMap from '../assets/svg/data-type-icon/map.svg?react';
import IconMoney from '../assets/svg/data-type-icon/money.svg?react';
import IconNull from '../assets/svg/data-type-icon/null.svg?react';
import IconNumeric from '../assets/svg/data-type-icon/numeric.svg?react';
import IconPolygon from '../assets/svg/data-type-icon/polygon.svg?react';
import IconRecord from '../assets/svg/data-type-icon/record.svg?react';
import IconString from '../assets/svg/data-type-icon/string.svg?react';
import IconStruct from '../assets/svg/data-type-icon/struct.svg?react';
import IconTime from '../assets/svg/data-type-icon/time.svg?react';
import IconTimestamp from '../assets/svg/data-type-icon/timestamp.svg?react';
import IconTsQuery from '../assets/svg/data-type-icon/ts-query.svg?react';
import IconUnion from '../assets/svg/data-type-icon/union.svg?react';
import IconUnknown from '../assets/svg/data-type-icon/unknown.svg?react';
import IconVarchar from '../assets/svg/data-type-icon/varchar.svg?react';
import IconVariant from '../assets/svg/data-type-icon/variant.svg?react';
import IconXML from '../assets/svg/data-type-icon/xml.svg?react';
import IconDrag from '../assets/svg/drag.svg?react';
import IconForeignKeyLineThrough from '../assets/svg/foreign-key-line-through.svg?react';
import IconForeignKey from '../assets/svg/foreign-key.svg?react';
import GlossaryIcon from '../assets/svg/glossary.svg?react';
import APICollectionIcon from '../assets/svg/ic-api-collection-default.svg?react';
import APIEndpointIcon from '../assets/svg/ic-api-endpoint-default.svg?react';
import APIServiceIcon from '../assets/svg/ic-api-service-default.svg?react';
import IconDown from '../assets/svg/ic-arrow-down.svg?react';
import IconRight from '../assets/svg/ic-arrow-right.svg?react';
import IconTestCase from '../assets/svg/ic-checklist.svg?react';
import DashboardIcon from '../assets/svg/ic-dashboard.svg?react';
import DataQualityIcon from '../assets/svg/ic-data-contract.svg?react';
import DataProductIcon from '../assets/svg/ic-data-product.svg?react';
import DatabaseIcon from '../assets/svg/ic-database.svg?react';
import DomainIcon from '../assets/svg/ic-domain.svg?react';
import ExportIcon from '../assets/svg/ic-export.svg?react';
import MlModelIcon from '../assets/svg/ic-ml-model.svg?react';
import PersonaIcon from '../assets/svg/ic-personas.svg?react';
import PipelineIcon from '../assets/svg/ic-pipeline.svg?react';
import SchemaIcon from '../assets/svg/ic-schema.svg?react';
import ContainerIcon from '../assets/svg/ic-storage.svg?react';
import IconStoredProcedure from '../assets/svg/ic-stored-procedure.svg?react';
import TableIcon from '../assets/svg/ic-table.svg?react';
import TeamIcon from '../assets/svg/ic-teams.svg?react';
import TopicIcon from '../assets/svg/ic-topic.svg?react';
import IconDistLineThrough from '../assets/svg/icon-dist-line-through.svg?react';
import IconDistKey from '../assets/svg/icon-distribution.svg?react';
import IconKeyLineThrough from '../assets/svg/icon-key-line-through.svg?react';
import IconKey from '../assets/svg/icon-key.svg?react';
import IconNotNullLineThrough from '../assets/svg/icon-not-null-line-through.svg?react';
import IconNotNull from '../assets/svg/icon-not-null.svg?react';
import RoleIcon from '../assets/svg/icon-role-grey.svg?react';
import IconSortLineThrough from '../assets/svg/icon-sort-line-through.svg?react';
import IconSortKey from '../assets/svg/icon-sort.svg?react';
import IconTestSuite from '../assets/svg/icon-test-suite.svg?react';
import IconUniqueLineThrough from '../assets/svg/icon-unique-line-through.svg?react';
import IconUnique from '../assets/svg/icon-unique.svg?react';
import KPIIcon from '../assets/svg/kpi.svg?react';
import LocationIcon from '../assets/svg/location.svg?react';
import MetadataServiceIcon from '../assets/svg/metadata-service.svg?react';
import MetricIcon from '../assets/svg/metric.svg?react';
import NotificationIcon from '../assets/svg/notification.svg?react';
import PolicyIcon from '../assets/svg/policies.svg?react';
import ServicesIcon from '../assets/svg/services.svg?react';
import TagIcon from '../assets/svg/tag.svg?react';
import TaskIcon from '../assets/svg/task-ic.svg?react';
import UserIcon from '../assets/svg/user.svg?react';
import { ActivityFeedTab } from '../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import { ActivityFeedLayoutType } from '../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import { CustomPropertyTable } from '../components/common/CustomPropertyTable/CustomPropertyTable';
import ErrorPlaceHolder from '../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { ManageButtonItemLabel } from '../components/common/ManageButtonContentItem/ManageButtonContentItem.component';
import QueryViewer from '../components/common/QueryViewer/QueryViewer.component';
import TabsLabel from '../components/common/TabsLabel/TabsLabel.component';
import { TabProps } from '../components/common/TabsLabel/TabsLabel.interface';
import { GenericTab } from '../components/Customization/GenericTab/GenericTab';
import { CommonWidgets } from '../components/DataAssets/CommonWidgets/CommonWidgets';
import TableProfiler from '../components/Database/Profiler/TableProfiler/TableProfiler';
import SampleDataTableComponent from '../components/Database/SampleDataTable/SampleDataTable.component';
import SchemaTable from '../components/Database/SchemaTable/SchemaTable.component';
import TableQueries from '../components/Database/TableQueries/TableQueries';
import { ContractTab } from '../components/DataContract/ContractTab/ContractTab';
import { useEntityExportModalProvider } from '../components/Entity/EntityExportModalProvider/EntityExportModalProvider.component';
import KnowledgeGraph from '../components/KnowledgeGraph/KnowledgeGraph';
import Lineage from '../components/Lineage/Lineage.component';
import { SourceType } from '../components/SearchedData/SearchedData.interface';
import { NON_SERVICE_TYPE_ASSETS } from '../constants/Assets.constants';
import { FQN_SEPARATOR_CHAR } from '../constants/char.constants';
import { DE_ACTIVE_COLOR } from '../constants/constants';
import { ExportTypes } from '../constants/Export.constants';
import LineageProvider from '../context/LineageProvider/LineageProvider';
import { OperationPermission } from '../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE } from '../enums/common.enum';
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import { EntityTabs, EntityType, FqnPart } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { ConstraintTypes, PrimaryTableDataTypes } from '../enums/table.enum';
import { SearchIndexField } from '../generated/entity/data/searchIndex';
import {
  Column,
  ConstraintType,
  DataType,
  JoinedWith,
  TableConstraint,
  TableJoins,
} from '../generated/entity/data/table';
import { PageType } from '../generated/system/ui/uiCustomization';
import { Field } from '../generated/type/schema';
import { LabelType, State, TagLabel } from '../generated/type/tagLabel';
import LimitWrapper from '../hoc/LimitWrapper';
import { useApplicationStore } from '../hooks/useApplicationStore';
import { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';
import {
  FrequentlyJoinedTables,
  Joined,
} from '../pages/TableDetailsPageV1/FrequentlyJoinedTables/FrequentlyJoinedTables.component';
import { PartitionedKeys } from '../pages/TableDetailsPageV1/PartitionedKeys/PartitionedKeys.component';
import ConstraintIcon from '../pages/TableDetailsPageV1/TableConstraints/ConstraintIcon';
import TableConstraints from '../pages/TableDetailsPageV1/TableConstraints/TableConstraints';
import { exportTableDetailsInCSV } from '../rest/tableAPI';
import {
  getPartialNameFromTableFQN,
  getTableFQNFromColumnFQN,
} from './CommonUtils';
import EntityLink from './EntityLink';
import { getEntityImportPath } from './EntityUtils';
import { t } from './i18next/LocalUtil';
import searchClassBase from './SearchClassBase';
import serviceUtilClassBase from './ServiceUtilClassBase';
import { ordinalize } from './StringsUtils';
import { TableDetailPageTabProps } from './TableClassBase';
import { TableFieldsInfoCommonEntities } from './TableUtils.interface';

export const getUsagePercentile = (pctRank: number, isLiteral = false) => {
  const percentile = Math.round(pctRank * 10) / 10;
  const ordinalPercentile = ordinalize(percentile);
  const usagePercentile = `${
    isLiteral ? t('label.usage') : ''
  } ${ordinalPercentile} ${t('label.pctile-lowercase')}`;

  return usagePercentile;
};

export const getTierTags = (tags: Array<TagLabel>) => {
  const tierTag = tags.find((item) =>
    item.tagFQN.startsWith(`Tier${FQN_SEPARATOR_CHAR}`)
  );

  return tierTag;
};

export const getTagsWithoutTier = (
  tags: Array<EntityTags>
): Array<EntityTags> => {
  return tags.filter(
    (item) => !item.tagFQN.startsWith(`Tier${FQN_SEPARATOR_CHAR}`)
  );
};

export const getConstraintIcon = ({
  constraint = '',
  className = '',
  width = '16px',
  isConstraintAdded,
  isConstraintDeleted,
}: {
  constraint?: string;
  className?: string;
  width?: string;
  isConstraintAdded?: boolean;
  isConstraintDeleted?: boolean;
}) => {
  let title: string, icon: SvgComponent, dataTestId: string;
  switch (constraint) {
    case ConstraintTypes.PRIMARY_KEY: {
      title = t('label.primary-key');
      icon = isConstraintDeleted ? IconKeyLineThrough : IconKey;
      dataTestId = 'primary-key';

      break;
    }
    case ConstraintTypes.UNIQUE: {
      title = t('label.unique');
      icon = isConstraintDeleted ? IconUniqueLineThrough : IconUnique;
      dataTestId = 'unique';

      break;
    }
    case ConstraintTypes.NOT_NULL: {
      title = t('label.not-null');
      icon = isConstraintDeleted ? IconNotNullLineThrough : IconNotNull;
      dataTestId = 'not-null';

      break;
    }
    case ConstraintTypes.FOREIGN_KEY: {
      title = t('label.foreign-key');
      icon = isConstraintDeleted ? IconForeignKeyLineThrough : IconForeignKey;
      dataTestId = 'foreign-key';

      break;
    }
    case ConstraintType.DistKey: {
      title = t('label.entity-key', {
        entity: t('label.dist'),
      });
      icon = isConstraintDeleted ? IconDistLineThrough : IconDistKey;
      dataTestId = 'dist-key';

      break;
    }
    case ConstraintType.SortKey: {
      title = t('label.entity-key', {
        entity: t('label.sort'),
      });
      icon = isConstraintDeleted ? IconSortLineThrough : IconSortKey;
      dataTestId = 'sort-key';

      break;
    }
    case ConstraintType.ClusterKey: {
      title = t('label.entity-key', {
        entity: t('label.cluster'),
      });
      icon = isConstraintDeleted ? IconDistLineThrough : IconDistKey;
      dataTestId = 'cluster-key';

      break;
    }
    default:
      return null;
  }

  return (
    <Tooltip
      className={classNames(className)}
      placement="bottom"
      title={title}
      trigger="hover">
      <Icon
        alt={title}
        className={classNames({
          'diff-added': isConstraintAdded,
          'diff-removed': isConstraintDeleted,
        })}
        component={icon}
        data-testid={`constraint-icon-${dataTestId}`}
        style={{ fontSize: width }}
      />
    </Tooltip>
  );
};

export const getColumnDataTypeIcon = ({
  dataType,
  width = '16px',
}: {
  dataType: DataType;
  width?: string;
}) => {
  const dataTypeIcons = {
    [DataType.Array]: IconArray,
    [DataType.Bit]: IconBinary,
    [DataType.Binary]: IconBinary,
    [DataType.Bitmap]: IconBitmap,
    [DataType.Image]: IconBitmap,
    [DataType.Boolean]: IconBoolean,
    [DataType.Date]: IconDate,
    [DataType.Year]: IconDate,
    [DataType.Datetime]: IconDateTime,
    [DataType.Datetimerange]: IconDateTime,
    [DataType.Double]: IconDouble,
    [DataType.Float]: IconDouble,
    [DataType.Number]: IconDouble,
    [DataType.Decimal]: IconDecimal,
    [DataType.Enum]: IconEnum,
    [DataType.Error]: IconError,
    [DataType.Map]: IconMap,
    [DataType.Geography]: IconMap,
    [DataType.Geometry]: IconGeometry,
    [DataType.Ipv4]: IconIpVersion,
    [DataType.Ipv6]: IconIpVersion,
    [DataType.JSON]: IconJson,
    [DataType.Numeric]: IconNumeric,
    [DataType.Long]: IconNumeric,
    [DataType.Money]: IconMoney,
    [DataType.Char]: IconVarchar,
    [DataType.Text]: IconVarchar,
    [DataType.Ntext]: IconVarchar,
    [DataType.Mediumtext]: IconVarchar,
    [DataType.Varchar]: IconVarchar,
    [DataType.Int]: IconInteger,
    [DataType.Bigint]: IconInteger,
    [DataType.Largeint]: IconInteger,
    [DataType.Smallint]: IconInteger,
    [DataType.Tinyint]: IconInteger,
    [DataType.Polygon]: IconPolygon,
    [DataType.Null]: IconNull,
    [DataType.Record]: IconRecord,
    [DataType.Table]: IconRecord,
    [DataType.String]: IconString,
    [DataType.Struct]: IconStruct,
    [DataType.Time]: IconTime,
    [DataType.Timestamp]: IconTimestamp,
    [DataType.Timestampz]: IconTimestamp,
    [DataType.Tsquery]: IconTsQuery,
    [DataType.Union]: IconUnion,
    [DataType.Unknown]: IconUnknown,
    [DataType.Variant]: IconVariant,
    [DataType.XML]: IconXML,
  };

  const icon = dataTypeIcons[dataType as keyof typeof dataTypeIcons] || null;

  return <Icon alt={dataType} component={icon} style={{ fontSize: width }} />;
};

export const getEntityIcon = (
  indexType: string,
  iconClass = '',
  iconStyle = {}
) => {
  let Icon;
  let className = iconClass;
  const style: CSSProperties = iconStyle;
  const entityIconMapping: Record<string, SvgComponent> = {
    [SearchIndex.DATABASE]: DatabaseIcon,
    [EntityType.DATABASE]: DatabaseIcon,
    [SearchIndex.DATABASE_SERVICE]: DatabaseIcon,
    [EntityType.DATABASE_SERVICE]: DatabaseIcon,
    [SearchIndex.DATABASE_SCHEMA]: SchemaIcon,
    [EntityType.DATABASE_SCHEMA]: SchemaIcon,
    [SearchIndex.TOPIC]: TopicIcon,
    [EntityType.TOPIC]: TopicIcon,
    [EntityType.MESSAGING_SERVICE]: TopicIcon,
    [SearchIndex.MESSAGING_SERVICE]: TopicIcon,
    [SearchIndex.DASHBOARD]: DashboardIcon,
    [EntityType.DASHBOARD]: DashboardIcon,
    [EntityType.DASHBOARD_SERVICE]: DashboardIcon,
    [SearchIndex.DASHBOARD_SERVICE]: DashboardIcon,
    [SearchIndex.MLMODEL]: MlModelIcon,
    [EntityType.MLMODEL]: MlModelIcon,
    [EntityType.MLMODEL_SERVICE]: MlModelIcon,
    [SearchIndex.ML_MODEL_SERVICE]: MlModelIcon,
    [SearchIndex.PIPELINE]: PipelineIcon,
    [EntityType.PIPELINE]: PipelineIcon,
    [EntityType.PIPELINE_SERVICE]: PipelineIcon,
    [SearchIndex.PIPELINE_SERVICE]: PipelineIcon,
    [SearchIndex.CONTAINER]: ContainerIcon,
    [EntityType.CONTAINER]: ContainerIcon,
    [EntityType.STORAGE_SERVICE]: ContainerIcon,
    [SearchIndex.STORAGE_SERVICE]: ContainerIcon,
    [SearchIndex.DASHBOARD_DATA_MODEL]: IconDataModel,
    [EntityType.DASHBOARD_DATA_MODEL]: IconDataModel,
    [SearchIndex.STORED_PROCEDURE]: IconStoredProcedure,
    [EntityType.STORED_PROCEDURE]: IconStoredProcedure,
    [EntityType.CLASSIFICATION]: ClassificationIcon,
    [SearchIndex.TAG]: TagIcon,
    [EntityType.TAG]: TagIcon,
    [SearchIndex.GLOSSARY]: GlossaryIcon,
    [EntityType.GLOSSARY]: GlossaryIcon,
    [SearchIndex.GLOSSARY_TERM]: GlossaryTermIcon,
    [EntityType.GLOSSARY_TERM]: GlossaryTermIcon,
    [SearchIndex.DOMAIN]: DomainIcon,
    [EntityType.DOMAIN]: DomainIcon,
    [SearchIndex.CHART]: ChartIcon,
    [EntityType.CHART]: ChartIcon,
    [SearchIndex.TABLE]: TableIcon,
    [EntityType.TABLE]: TableIcon,
    [EntityType.METADATA_SERVICE]: MetadataServiceIcon,
    [SearchIndex.DATA_PRODUCT]: DataProductIcon,
    [EntityType.DATA_PRODUCT]: DataProductIcon,
    [EntityType.TEST_CASE]: IconTestCase,
    [EntityType.TEST_SUITE]: IconTestSuite,
    [EntityType.DATA_CONTRACT]: DataQualityIcon,
    [EntityType.BOT]: BotIcon,
    [EntityType.TEAM]: TeamIcon,
    [EntityType.APPLICATION]: ApplicationIcon,
    [EntityType.PERSONA]: PersonaIcon,
    [EntityType.ROLE]: RoleIcon,
    [EntityType.POLICY]: PolicyIcon,
    [EntityType.EVENT_SUBSCRIPTION]: AlertIcon,
    [EntityType.USER]: UserIcon,
    [SearchIndex.USER]: UserIcon,
    [EntityType.INGESTION_PIPELINE]: PipelineIcon,
    [SearchIndex.INGESTION_PIPELINE]: PipelineIcon,
    [EntityType.ALERT]: AlertIcon,
    [EntityType.KPI]: KPIIcon,
    ['tagCategory']: ClassificationIcon,
    ['announcement']: AnnouncementIcon,
    ['conversation']: ConversationIcon,
    ['task']: TaskIcon,
    ['dataQuality']: DataQualityIcon,
    ['services']: ServicesIcon,
    ['automator']: AutomatorBotIcon,
    ['notification']: NotificationIcon,
    [EntityType.API_ENDPOINT]: APIEndpointIcon,
    [SearchIndex.API_ENDPOINT_INDEX]: APIEndpointIcon,
    [EntityType.METRIC]: MetricIcon,
    [SearchIndex.METRIC_SEARCH_INDEX]: MetricIcon,
    [EntityType.API_SERVICE]: APIServiceIcon,
    [SearchIndex.API_SERVICE_INDEX]: APIServiceIcon,
    [EntityType.API_COLLECTION]: APICollectionIcon,
    [SearchIndex.API_COLLECTION_INDEX]: APICollectionIcon,
    ['location']: LocationIcon,
    [EntityType.QUERY]: QueryIcon,
    [SearchIndex.QUERY]: QueryIcon,
  };

  switch (indexType) {
    case EntityType.SEARCH_INDEX:
    case SearchIndex.SEARCH_INDEX:
    case EntityType.SEARCH_SERVICE:
    case SearchIndex.SEARCH_SERVICE:
      Icon = SearchOutlined;
      className = 'text-sm text-inherit';

      break;

    default:
      Icon = entityIconMapping[indexType];

      break;
  }

  // If icon is not found, return null
  return Icon ? <Icon className={className} style={style} /> : null;
};

export const getServiceIcon = (source: SourceType) => {
  const isDataAsset = NON_SERVICE_TYPE_ASSETS.includes(
    source.entityType as EntityType
  );

  if (isDataAsset) {
    return searchClassBase.getEntityIcon(
      source.entityType ?? '',
      'service-icon w-7 h-7',
      {
        color: DE_ACTIVE_COLOR,
      }
    );
  } else {
    return (
      <img
        alt="service-icon"
        className="inline service-icon h-7"
        src={serviceUtilClassBase.getServiceTypeLogo(source)}
      />
    );
  }
};

export const makeData = <T extends Column | SearchIndexField>(
  columns: T[] = []
): Array<T & { id: string }> => {
  return columns.map((column) => ({
    ...column,
    id: uniqueId(column.name),
    children: column.children ? makeData<T>(column.children as T[]) : undefined,
  }));
};

export const getDataTypeString = (dataType: string): string => {
  switch (upperCase(dataType)) {
    case DataType.String:
    case DataType.Char:
    case DataType.Text:
    case DataType.Varchar:
    case DataType.Mediumtext:
    case DataType.Mediumblob:
    case DataType.Blob:
      return PrimaryTableDataTypes.VARCHAR;
    case DataType.Timestamp:
    case DataType.Time:
      return PrimaryTableDataTypes.TIMESTAMP;
    case DataType.Date:
      return PrimaryTableDataTypes.DATE;
    case DataType.Int:
    case DataType.Float:
    case DataType.Smallint:
    case DataType.Bigint:
    case DataType.Numeric:
    case DataType.Tinyint:
    case DataType.Decimal:
      return PrimaryTableDataTypes.NUMERIC;
    case DataType.Boolean:
    case DataType.Enum:
      return PrimaryTableDataTypes.BOOLEAN;
    default:
      return dataType;
  }
};

export const generateEntityLink = (fqn: string, includeColumn = false) => {
  if (includeColumn) {
    const tableFqn = getTableFQNFromColumnFQN(fqn);
    const columnName = getPartialNameFromTableFQN(fqn, [FqnPart.NestedColumn]);

    return EntityLink.getTableEntityLink(tableFqn, columnName);
  } else {
    return EntityLink.getTableEntityLink(fqn);
  }
};

export function getTableExpandableConfig<T>(
  isDraggable?: boolean
): ExpandableConfig<T> {
  const expandableConfig: ExpandableConfig<T> = {
    expandIcon: ({ expanded, onExpand, expandable, record }) =>
      expandable ? (
        <>
          {isDraggable && <IconDrag className="drag-icon" />}
          <Icon
            className="table-expand-icon vertical-baseline"
            component={expanded ? IconDown : IconRight}
            data-testid="expand-icon"
            onClick={(e) => onExpand(record, e)}
          />
        </>
      ) : (
        isDraggable && (
          <>
            <IconDrag className="drag-icon" />
            <span className="expand-cell-empty-icon-container" />
          </>
        )
      ),
  };

  return expandableConfig;
}

export const prepareConstraintIcon = ({
  columnName,
  columnConstraint,
  tableConstraints,
  iconClassName,
  iconWidth,
  isColumnConstraintAdded,
  isColumnConstraintDeleted,
  isTableConstraintAdded,
  isTableConstraintDeleted,
}: {
  columnName: string;
  columnConstraint?: string;
  tableConstraints?: TableConstraint[];
  iconClassName?: string;
  iconWidth?: string;
  isColumnConstraintAdded?: boolean;
  isColumnConstraintDeleted?: boolean;
  isTableConstraintAdded?: boolean;
  isTableConstraintDeleted?: boolean;
}) => {
  // get the table constraints for column
  const filteredTableConstraints = uniqBy(
    tableConstraints?.filter((constraint) =>
      constraint.columns?.includes(columnName)
    ),
    'constraintType'
  );

  // prepare column constraint element
  const columnConstraintEl = columnConstraint
    ? getConstraintIcon({
        constraint: columnConstraint,
        className: iconClassName ?? 'm-r-xs',
        width: iconWidth,
        isConstraintAdded: isColumnConstraintAdded,
        isConstraintDeleted: isColumnConstraintDeleted,
      })
    : null;

  // prepare table constraint element
  const tableConstraintEl = filteredTableConstraints
    ? filteredTableConstraints.map((tableConstraint) =>
        getConstraintIcon({
          constraint: tableConstraint.constraintType,
          className: iconClassName ?? 'm-r-xs',
          width: iconWidth,
          isConstraintAdded: isTableConstraintAdded,
          isConstraintDeleted: isTableConstraintDeleted,
        })
      )
    : null;

  return (
    <span data-testid="constraints">
      {columnConstraintEl} {tableConstraintEl}
    </span>
  );
};

export const getAllRowKeysByKeyName = <
  T extends Column | Field | SearchIndexField
>(
  data: T[],
  keyName: keyof T
) => {
  let keys: string[] = [];

  data.forEach((item) => {
    if (item.children && item.children.length > 0) {
      keys.push(toString(item[keyName]));
      keys = [
        ...keys,
        ...getAllRowKeysByKeyName(item.children as T[], keyName),
      ];
    }
  });

  return keys;
};

export const searchInFields = <T extends SearchIndexField | Column>(
  searchIndex: Array<T>,
  searchText: string
): Array<T> => {
  const searchedValue: Array<T> = searchIndex.reduce(
    (searchedFields, field) => {
      const isContainData =
        lowerCase(field.name).includes(searchText) ||
        lowerCase(field.description).includes(searchText) ||
        lowerCase(getDataTypeString(field.dataType)).includes(searchText);

      if (isContainData) {
        return [...searchedFields, field];
      } else if (!isUndefined(field.children)) {
        const searchedChildren = searchInFields(
          field.children as T[],
          searchText
        );
        if (searchedChildren.length > 0) {
          return [
            ...searchedFields,
            {
              ...field,
              children: searchedChildren,
            },
          ];
        }
      }

      return searchedFields;
    },
    [] as Array<T>
  );

  return searchedValue;
};

export const getUpdatedTags = (newFieldTags: Array<EntityTags>): TagLabel[] => {
  const mappedNewTags: TagLabel[] = newFieldTags.map((tag) => ({
    ...omit(tag, 'isRemovable'),
    labelType: LabelType.Manual,
    state: State.Confirmed,
    source: tag.source ?? 'Classification',
    tagFQN: tag.tagFQN,
  }));

  return mappedNewTags;
};

export const updateFieldTags = <T extends TableFieldsInfoCommonEntities>(
  changedFieldFQN: string,
  newFieldTags: EntityTags[],
  searchIndexFields?: Array<T>
) => {
  searchIndexFields?.forEach((field) => {
    if (field.fullyQualifiedName === changedFieldFQN) {
      field.tags = getUpdatedTags(newFieldTags);
    } else {
      updateFieldTags(
        changedFieldFQN,
        newFieldTags,
        field?.children as Array<T>
      );
    }
  });
};

export const updateFieldDescription = <T extends TableFieldsInfoCommonEntities>(
  changedFieldFQN: string,
  description: string,
  searchIndexFields?: Array<T>
) => {
  searchIndexFields?.forEach((field) => {
    if (field.fullyQualifiedName === changedFieldFQN) {
      field.description = description;
    } else {
      updateFieldDescription(
        changedFieldFQN,
        description,
        field?.children as Array<T>
      );
    }
  });
};

export const getTableDetailPageBaseTabs = ({
  queryCount,
  isTourOpen,
  tablePermissions,
  activeTab,
  deleted,
  tableDetails,
  feedCount,
  getEntityFeedCount,
  handleFeedCount,
  viewAllPermission,
  editCustomAttributePermission,
  viewSampleDataPermission,
  viewQueriesPermission,
  editLineagePermission,
  fetchTableDetails,
  testCaseSummary,
  isViewTableType,
  labelMap,
}: TableDetailPageTabProps): TabProps[] => {
  return [
    {
      label: (
        <TabsLabel
          count={tableDetails?.columns.length}
          id={EntityTabs.SCHEMA}
          isActive={activeTab === EntityTabs.SCHEMA}
          name={get(labelMap, EntityTabs.SCHEMA, t('label.column-plural'))}
        />
      ),
      key: EntityTabs.SCHEMA,
      children: <GenericTab type={PageType.Table} />,
    },
    {
      label: (
        <TabsLabel
          count={feedCount.totalCount}
          id={EntityTabs.ACTIVITY_FEED}
          isActive={activeTab === EntityTabs.ACTIVITY_FEED}
          name={get(
            labelMap,
            EntityTabs.ACTIVITY_FEED,
            t('label.activity-feed-and-task-plural')
          )}
        />
      ),
      key: EntityTabs.ACTIVITY_FEED,
      children: (
        <ActivityFeedTab
          refetchFeed
          columns={tableDetails?.columns}
          entityFeedTotalCount={feedCount.totalCount}
          entityType={EntityType.TABLE}
          feedCount={feedCount}
          layoutType={ActivityFeedLayoutType.THREE_PANEL}
          owners={tableDetails?.owners}
          onFeedUpdate={getEntityFeedCount}
          onUpdateEntityDetails={fetchTableDetails}
          onUpdateFeedCount={handleFeedCount}
        />
      ),
    },
    {
      label: (
        <TabsLabel
          id={EntityTabs.SAMPLE_DATA}
          name={get(labelMap, EntityTabs.SAMPLE_DATA, t('label.sample-data'))}
        />
      ),

      key: EntityTabs.SAMPLE_DATA,
      children:
        !isTourOpen && !viewSampleDataPermission ? (
          <ErrorPlaceHolder
            className="border-none"
            permissionValue={t('label.view-entity', {
              entity: t('label.sample-data'),
            })}
            type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
          />
        ) : (
          <SampleDataTableComponent
            isTableDeleted={deleted}
            owners={tableDetails?.owners ?? []}
            permissions={tablePermissions}
            tableId={tableDetails?.id ?? ''}
          />
        ),
    },
    {
      label: (
        <TabsLabel
          count={queryCount}
          id={EntityTabs.TABLE_QUERIES}
          isActive={activeTab === EntityTabs.TABLE_QUERIES}
          name={get(
            labelMap,
            EntityTabs.TABLE_QUERIES,
            t('label.query-plural')
          )}
        />
      ),
      key: EntityTabs.TABLE_QUERIES,
      children: !viewQueriesPermission ? (
        <ErrorPlaceHolder
          className="border-none"
          permissionValue={t('label.view-entity', {
            entity: t('label.query-plural'),
          })}
          type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
        />
      ) : (
        <TableQueries
          isTableDeleted={deleted}
          tableId={tableDetails?.id ?? ''}
        />
      ),
    },
    {
      label: (
        <TabsLabel
          id={EntityTabs.PROFILER}
          name={get(
            labelMap,
            EntityTabs.PROFILER,
            t('label.data-observability')
          )}
        />
      ),
      key: EntityTabs.PROFILER,
      children: (
        <TableProfiler
          permissions={tablePermissions}
          table={tableDetails}
          testCaseSummary={testCaseSummary}
        />
      ),
    },
    {
      label: (
        <TabsLabel
          id={EntityTabs.LINEAGE}
          name={get(labelMap, EntityTabs.LINEAGE, t('label.lineage'))}
        />
      ),
      key: EntityTabs.LINEAGE,
      children: (
        <LineageProvider>
          <Lineage
            deleted={deleted}
            entity={tableDetails as SourceType}
            entityType={EntityType.TABLE}
            hasEditAccess={editLineagePermission}
          />
        </LineageProvider>
      ),
    },
    {
      label: (
        <TabsLabel
          id={EntityTabs.KNOWLEDGE_GRAPH}
          name={get(
            labelMap,
            EntityTabs.KNOWLEDGE_GRAPH,
            t('label.knowledge-graph')
          )}
        />
      ),
      key: EntityTabs.KNOWLEDGE_GRAPH,
      children: (
        <KnowledgeGraph
          depth={2}
          entity={
            tableDetails
              ? {
                  id: tableDetails.id,
                  name: tableDetails.name,
                  fullyQualifiedName: tableDetails.fullyQualifiedName,
                  type: EntityType.TABLE,
                }
              : undefined
          }
          entityType={EntityType.TABLE}
        />
      ),
      isHidden: !useApplicationStore.getState().rdfEnabled,
    },
    {
      label: (
        <TabsLabel
          id={EntityTabs.DBT}
          name={get(labelMap, EntityTabs.DBT, t('label.dbt-lowercase'))}
        />
      ),
      isHidden: !(
        tableDetails?.dataModel?.sql || tableDetails?.dataModel?.rawSql
      ),
      key: EntityTabs.DBT,
      children: (
        <QueryViewer
          isActive={activeTab === EntityTabs.DBT}
          sqlQuery={
            get(tableDetails, 'dataModel.sql', '') ??
            get(tableDetails, 'dataModel.rawSql', '')
          }
          title={
            <Space className="p-y-xss">
              <Typography.Text className="text-grey-muted">
                {`${t('label.path')}:`}
              </Typography.Text>
              <Typography.Text>{tableDetails?.dataModel?.path}</Typography.Text>
            </Space>
          }
        />
      ),
    },
    {
      label: (
        <TabsLabel
          id={
            isViewTableType
              ? EntityTabs.VIEW_DEFINITION
              : EntityTabs.SCHEMA_DEFINITION
          }
          name={get(
            labelMap,
            EntityTabs.VIEW_DEFINITION,
            isViewTableType
              ? t('label.view-definition')
              : t('label.schema-definition')
          )}
        />
      ),
      isHidden: isUndefined(tableDetails?.schemaDefinition),
      key: EntityTabs.VIEW_DEFINITION,
      children: (
        <QueryViewer
          isActive={[
            EntityTabs.VIEW_DEFINITION,
            EntityTabs.SCHEMA_DEFINITION,
          ].includes(activeTab)}
          sqlQuery={tableDetails?.schemaDefinition ?? ''}
        />
      ),
    },
    {
      label: (
        <TabsLabel
          isBeta
          id={EntityTabs.CONTRACT}
          isActive={activeTab === EntityTabs.CONTRACT}
          name={get(labelMap, EntityTabs.CONTRACT, t('label.contract'))}
        />
      ),
      key: EntityTabs.CONTRACT,
      children: <ContractTab />,
    },
    {
      label: (
        <TabsLabel
          id={EntityTabs.CUSTOM_PROPERTIES}
          name={get(
            labelMap,
            EntityTabs.CUSTOM_PROPERTIES,
            t('label.custom-property-plural')
          )}
        />
      ),
      key: EntityTabs.CUSTOM_PROPERTIES,
      children: (
        <CustomPropertyTable<EntityType.TABLE>
          entityType={EntityType.TABLE}
          hasEditAccess={editCustomAttributePermission}
          hasPermission={viewAllPermission}
        />
      ),
    },
  ];
};

export const getJoinsFromTableJoins = (joins?: TableJoins): Joined[] => {
  const tableFQNGrouping = [
    ...(joins?.columnJoins?.flatMap(
      (cjs) =>
        cjs.joinedWith?.map<JoinedWith>((jw) => ({
          fullyQualifiedName: getTableFQNFromColumnFQN(jw.fullyQualifiedName),
          joinCount: jw.joinCount,
        })) ?? []
    ) ?? []),
    ...(joins?.directTableJoins ?? []),
  ].reduce(
    (result, jw) => ({
      ...result,
      [jw.fullyQualifiedName]:
        (result[jw.fullyQualifiedName] ?? 0) + jw.joinCount,
    }),
    {} as Record<string, number>
  );

  return Object.entries(tableFQNGrouping)
    .map<JoinedWith & { name: string }>(([fullyQualifiedName, joinCount]) => ({
      fullyQualifiedName,
      joinCount,
      name: getPartialNameFromTableFQN(
        fullyQualifiedName,
        [FqnPart.Database, FqnPart.Table],
        FQN_SEPARATOR_CHAR
      ),
    }))
    .sort((a, b) => b.joinCount - a.joinCount);
};

/**
 * @param constraints contains column names for constraints which
 * @param type constraint type
 * @returns constraint object with columns and constraint type or empty array if constraints are empty
 */
export const createTableConstraintObject = (
  constraints: string[],
  type: ConstraintType
) =>
  !isEmpty(constraints) ? [{ columns: constraints, constraintType: type }] : [];

export const tableConstraintRendererBasedOnType = (
  constraintType: ConstraintType,
  columns?: string[]
) => {
  const isSingleColumn = columns?.length === 1;

  return (
    <div
      className="d-flex constraint-columns"
      data-testid={`${constraintType}-container`}
      key={constraintType}>
      <Space
        className="constraint-icon-container"
        direction="vertical"
        size={0}>
        {columns?.map((column, index) => (
          <Fragment key={column}>
            {(columns?.length ?? 0) - 1 !== index || isSingleColumn ? (
              <ConstraintIcon
                constraintType={constraintType}
                showOnlyIcon={isSingleColumn}
              />
            ) : null}
          </Fragment>
        ))}
      </Space>

      <Space direction="vertical" size={16}>
        {columns?.map((column) => (
          <Typography.Text ellipsis={{ tooltip: true }} key={column}>
            {column}
          </Typography.Text>
        ))}
      </Space>
    </div>
  );
};

/**
 * Recursive function to get all columns from table column and its children
 * @param columns Table Columns for creating options in table constraint form
 * @returns column options with label and value
 */
export const getColumnOptionsFromTableColumn = (columns: Column[]) => {
  const options: {
    label: string;
    value: string;
  }[] = [];

  columns.forEach((item) => {
    if (!isEmpty(item.children)) {
      options.push(...getColumnOptionsFromTableColumn(item.children ?? []));
    }

    options.push({
      label: item.name,
      value: item.name,
    });
  });

  return options;
};

export const ExtraTableDropdownOptions = (
  fqn: string,
  permission: OperationPermission,
  deleted: boolean,
  navigate: NavigateFunction
) => {
  const { showModal } = useEntityExportModalProvider();
  const { ViewAll, EditAll } = permission;

  return [
    ...(EditAll && !deleted
      ? [
          {
            label: (
              <LimitWrapper resource="table">
                <ManageButtonItemLabel
                  description={t('message.import-entity-help', {
                    entity: t('label.table'),
                  })}
                  icon={ImportIcon}
                  id="import-button"
                  name={t('label.import')}
                  onClick={() =>
                    navigate(getEntityImportPath(EntityType.TABLE, fqn))
                  }
                />
              </LimitWrapper>
            ),
            key: 'import-button',
          },
        ]
      : []),
    ...(ViewAll && !deleted
      ? [
          {
            label: (
              <ManageButtonItemLabel
                description={t('message.export-entity-help', {
                  entity: t('label.table'),
                })}
                icon={ExportIcon}
                id="export-button"
                name={t('label.export')}
                onClick={() =>
                  showModal({
                    name: fqn,
                    onExport: exportTableDetailsInCSV,
                    exportTypes: [ExportTypes.CSV],
                  })
                }
              />
            ),
            key: 'export-button',
          },
        ]
      : []),
  ];
};
export const getTableWidgetFromKey = (
  widgetConfig: WidgetConfig
): JSX.Element | null => {
  if (widgetConfig.i.startsWith(DetailPageWidgetKeys.TABLE_SCHEMA)) {
    return <SchemaTable />;
  } else if (
    widgetConfig.i.startsWith(DetailPageWidgetKeys.TABLE_CONSTRAINTS)
  ) {
    return <TableConstraints />;
  } else if (
    widgetConfig.i.startsWith(DetailPageWidgetKeys.FREQUENTLY_JOINED_TABLES)
  ) {
    return <FrequentlyJoinedTables />;
  } else if (widgetConfig.i.startsWith(DetailPageWidgetKeys.PARTITIONED_KEYS)) {
    return <PartitionedKeys />;
  } else {
    return (
      <CommonWidgets
        entityType={EntityType.TABLE}
        widgetConfig={widgetConfig}
      />
    );
  }
};

/**
 * Helper function to find a column by entity link in a nested structure
 * Recursively searches through the column hierarchy to find a matching column
 *
 * @param tableFqn - The fully qualified name of the table
 * @param columns - Array of columns to search through
 * @param entityLink - The entity link to match against
 * @returns The matching column or null if not found
 */
export const findColumnByEntityLink = (
  tableFqn: string,
  columns: Column[],
  entityLink: string
): Column | null => {
  for (const column of columns) {
    const columnName = EntityLink.getTableColumnNameFromColumnFqn(
      column.fullyQualifiedName ?? '',
      false
    );

    // Generate the entity link for this column and compare with the target entity link
    const columnEntityLink = EntityLink.getTableEntityLink(
      tableFqn,
      columnName
    );
    if (columnEntityLink === entityLink) {
      return column;
    }

    // If this column has children, recursively search them
    if (column.children && column.children.length > 0) {
      const found = findColumnByEntityLink(
        tableFqn,
        column.children,
        entityLink
      );
      if (found) {
        return found;
      }
    }
  }

  return null;
};

/**
 * Helper function to update a column in a nested structure
 * Recursively traverses the column hierarchy to find and update the target column
 *
 * @param columns - Array of columns to search through
 * @param targetFqn - The fully qualified name of the column to update
 * @param update - The properties to update on the matching column
 * @returns Updated array of columns with the target column modified
 */
export const updateColumnInNestedStructure = (
  columns: Column[],
  targetFqn: string,
  update: Partial<Column>
): Column[] => {
  return columns.map((column: Column) => {
    if (column.fullyQualifiedName === targetFqn) {
      return {
        ...column,
        ...update,
      };
    }
    // If this column has children, recursively search them
    else if (column.children && column.children.length > 0) {
      return {
        ...column,
        children: updateColumnInNestedStructure(
          column.children,
          targetFqn,
          update
        ),
      };
    } else {
      return column;
    }
  });
};

export const pruneEmptyChildren = (columns: Column[]): Column[] => {
  return columns.map((column) => {
    // If column has no children or empty children array, remove children property
    if (!column.children || column.children.length === 0) {
      return omit(column, 'children');
    }

    // If column has children, recursively prune them
    const prunedChildren = pruneEmptyChildren(column.children);

    // If after pruning, children array becomes empty, remove children property
    if (prunedChildren.length === 0) {
      return omit(column, 'children');
    }

    return {
      ...column,
      children: prunedChildren,
    };
  });
};
