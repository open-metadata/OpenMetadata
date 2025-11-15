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
import { Divider, Space, Tooltip, Typography } from 'antd';
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
import { CSSProperties, Fragment, lazy, Suspense } from 'react';
import { NavigateFunction } from 'react-router-dom';
import { ReactComponent as ImportIcon } from '..//assets/svg/ic-import.svg';
import { ReactComponent as AlertIcon } from '../assets/svg/alert.svg';
import { ReactComponent as AnnouncementIcon } from '../assets/svg/announcements-black.svg';
import { ReactComponent as ApplicationIcon } from '../assets/svg/application.svg';
import { ReactComponent as AutomatorBotIcon } from '../assets/svg/automator-bot.svg';
import { ReactComponent as GlossaryTermIcon } from '../assets/svg/book.svg';
import { ReactComponent as BotIcon } from '../assets/svg/bot.svg';
import { ReactComponent as ChartIcon } from '../assets/svg/chart.svg';
import { ReactComponent as ClassificationIcon } from '../assets/svg/classification.svg';
import { ReactComponent as ConversationIcon } from '../assets/svg/comment.svg';
import { ReactComponent as QueryIcon } from '../assets/svg/customproperties/sql-query.svg';
import { ReactComponent as IconDataModel } from '../assets/svg/data-model.svg';
import { ReactComponent as IconArray } from '../assets/svg/data-type-icon/array.svg';
import { ReactComponent as IconBinary } from '../assets/svg/data-type-icon/binary.svg';
import { ReactComponent as IconBitmap } from '../assets/svg/data-type-icon/bitmap.svg';
import { ReactComponent as IconBoolean } from '../assets/svg/data-type-icon/boolean.svg';
import { ReactComponent as IconDateTime } from '../assets/svg/data-type-icon/data-time-range.svg';
import { ReactComponent as IconDate } from '../assets/svg/data-type-icon/date.svg';
import { ReactComponent as IconDecimal } from '../assets/svg/data-type-icon/decimal.svg';
import { ReactComponent as IconDouble } from '../assets/svg/data-type-icon/double.svg';
import { ReactComponent as IconEnum } from '../assets/svg/data-type-icon/enum.svg';
import { ReactComponent as IconError } from '../assets/svg/data-type-icon/error.svg';
import { ReactComponent as IconGeometry } from '../assets/svg/data-type-icon/geometry.svg';
import { ReactComponent as IconInteger } from '../assets/svg/data-type-icon/integer.svg';
import { ReactComponent as IconIpVersion } from '../assets/svg/data-type-icon/ipv6.svg';
import { ReactComponent as IconJson } from '../assets/svg/data-type-icon/json.svg';
import { ReactComponent as IconMap } from '../assets/svg/data-type-icon/map.svg';
import { ReactComponent as IconMoney } from '../assets/svg/data-type-icon/money.svg';
import { ReactComponent as IconNull } from '../assets/svg/data-type-icon/null.svg';
import { ReactComponent as IconNumeric } from '../assets/svg/data-type-icon/numeric.svg';
import { ReactComponent as IconPolygon } from '../assets/svg/data-type-icon/polygon.svg';
import { ReactComponent as IconRecord } from '../assets/svg/data-type-icon/record.svg';
import { ReactComponent as IconString } from '../assets/svg/data-type-icon/string.svg';
import { ReactComponent as IconStruct } from '../assets/svg/data-type-icon/struct.svg';
import { ReactComponent as IconTime } from '../assets/svg/data-type-icon/time.svg';
import { ReactComponent as IconTimestamp } from '../assets/svg/data-type-icon/timestamp.svg';
import { ReactComponent as IconTsQuery } from '../assets/svg/data-type-icon/ts-query.svg';
import { ReactComponent as IconUnion } from '../assets/svg/data-type-icon/union.svg';
import { ReactComponent as IconUnknown } from '../assets/svg/data-type-icon/unknown.svg';
import { ReactComponent as IconVarchar } from '../assets/svg/data-type-icon/varchar.svg';
import { ReactComponent as IconVariant } from '../assets/svg/data-type-icon/variant.svg';
import { ReactComponent as IconXML } from '../assets/svg/data-type-icon/xml.svg';
import { ReactComponent as IconDrag } from '../assets/svg/drag.svg';
import { ReactComponent as IconForeignKeyLineThrough } from '../assets/svg/foreign-key-line-through.svg';
import { ReactComponent as IconForeignKey } from '../assets/svg/foreign-key.svg';
import { ReactComponent as GlossaryIcon } from '../assets/svg/glossary.svg';
import { ReactComponent as APICollectionIcon } from '../assets/svg/ic-api-collection-default.svg';
import { ReactComponent as APIEndpointIcon } from '../assets/svg/ic-api-endpoint-default.svg';
import { ReactComponent as APIServiceIcon } from '../assets/svg/ic-api-service-default.svg';
import { ReactComponent as IconDown } from '../assets/svg/ic-arrow-down.svg';
import { ReactComponent as IconRight } from '../assets/svg/ic-arrow-right.svg';
import { ReactComponent as IconTestCase } from '../assets/svg/ic-checklist.svg';
import { ReactComponent as DashboardIcon } from '../assets/svg/ic-dashboard.svg';
import { ReactComponent as DataQualityIcon } from '../assets/svg/ic-data-contract.svg';
import { ReactComponent as DataProductIcon } from '../assets/svg/ic-data-product.svg';
import { ReactComponent as DatabaseIcon } from '../assets/svg/ic-database.svg';
import { ReactComponent as DirectoryIcon } from '../assets/svg/ic-directory.svg';
import { ReactComponent as DomainIcon } from '../assets/svg/ic-domain.svg';
import { ReactComponent as DriveServiceIcon } from '../assets/svg/ic-drive-service.svg';
import { ReactComponent as ExportIcon } from '../assets/svg/ic-export.svg';
import { ReactComponent as FileIcon } from '../assets/svg/ic-file.svg';
import { ReactComponent as MlModelIcon } from '../assets/svg/ic-ml-model.svg';
import { ReactComponent as PersonaIcon } from '../assets/svg/ic-personas.svg';
import { ReactComponent as PipelineIcon } from '../assets/svg/ic-pipeline.svg';
import { ReactComponent as SchemaIcon } from '../assets/svg/ic-schema.svg';
import { ReactComponent as SpreadsheetIcon } from '../assets/svg/ic-spreadsheet.svg';
import { ReactComponent as ContainerIcon } from '../assets/svg/ic-storage.svg';
import { ReactComponent as IconStoredProcedure } from '../assets/svg/ic-stored-procedure.svg';
import { ReactComponent as TableIcon } from '../assets/svg/ic-table.svg';
import { ReactComponent as TeamIcon } from '../assets/svg/ic-teams.svg';
import { ReactComponent as TopicIcon } from '../assets/svg/ic-topic.svg';
import { ReactComponent as WorksheetIcon } from '../assets/svg/ic-worksheet.svg';
import { ReactComponent as IconDistLineThrough } from '../assets/svg/icon-dist-line-through.svg';
import { ReactComponent as IconDistKey } from '../assets/svg/icon-distribution.svg';
import { ReactComponent as IconKeyLineThrough } from '../assets/svg/icon-key-line-through.svg';
import { ReactComponent as IconKey } from '../assets/svg/icon-key.svg';
import { ReactComponent as IconNotNullLineThrough } from '../assets/svg/icon-not-null-line-through.svg';
import { ReactComponent as IconNotNull } from '../assets/svg/icon-not-null.svg';
import { ReactComponent as RoleIcon } from '../assets/svg/icon-role-grey.svg';
import { ReactComponent as IconSortLineThrough } from '../assets/svg/icon-sort-line-through.svg';
import { ReactComponent as IconSortKey } from '../assets/svg/icon-sort.svg';
import { ReactComponent as IconTestSuite } from '../assets/svg/icon-test-suite.svg';
import { ReactComponent as IconUniqueLineThrough } from '../assets/svg/icon-unique-line-through.svg';
import { ReactComponent as IconUnique } from '../assets/svg/icon-unique.svg';
import { ReactComponent as KPIIcon } from '../assets/svg/kpi.svg';
import { ReactComponent as LocationIcon } from '../assets/svg/location.svg';
import { ReactComponent as MetadataServiceIcon } from '../assets/svg/metadata-service.svg';
import { ReactComponent as MetricIcon } from '../assets/svg/metric.svg';
import { ReactComponent as NotificationIcon } from '../assets/svg/notification.svg';
import { ReactComponent as PolicyIcon } from '../assets/svg/policies.svg';
import { ReactComponent as ServicesIcon } from '../assets/svg/services.svg';
import { ReactComponent as TagIcon } from '../assets/svg/tag.svg';
import { ReactComponent as TaskIcon } from '../assets/svg/task-ic.svg';
import { ReactComponent as UserIcon } from '../assets/svg/user.svg';
import { ActivityFeedTab } from '../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import { ActivityFeedLayoutType } from '../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import { CustomPropertyTable } from '../components/common/CustomPropertyTable/CustomPropertyTable';
import ErrorPlaceHolder from '../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../components/common/Loader/Loader';
import { ManageButtonItemLabel } from '../components/common/ManageButtonContentItem/ManageButtonContentItem.component';
import QueryViewer from '../components/common/QueryViewer/QueryViewer.component';
import TabsLabel from '../components/common/TabsLabel/TabsLabel.component';
import { TabProps } from '../components/common/TabsLabel/TabsLabel.interface';
import { GenericTab } from '../components/Customization/GenericTab/GenericTab';
import { CommonWidgets } from '../components/DataAssets/CommonWidgets/CommonWidgets';
import DataObservabilityTab from '../components/Database/Profiler/DataObservability/DataObservabilityTab';
import SampleDataTableComponent from '../components/Database/SampleDataTable/SampleDataTable.component';
import SchemaTable from '../components/Database/SchemaTable/SchemaTable.component';
import TableQueries from '../components/Database/TableQueries/TableQueries';
import { ContractTab } from '../components/DataContract/ContractTab/ContractTab';
import { useEntityExportModalProvider } from '../components/Entity/EntityExportModalProvider/EntityExportModalProvider.component';
import KnowledgeGraph from '../components/KnowledgeGraph/KnowledgeGraph';
import { SourceType } from '../components/SearchedData/SearchedData.interface';
import { NON_SERVICE_TYPE_ASSETS } from '../constants/Assets.constants';
import { FQN_SEPARATOR_CHAR } from '../constants/char.constants';
import { DE_ACTIVE_COLOR, NO_DATA_PLACEHOLDER } from '../constants/constants';
import { ExportTypes } from '../constants/Export.constants';
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

const EntityLineageTab = lazy(() =>
  import('../components/Lineage/EntityLineageTab/EntityLineageTab').then(
    (module) => ({ default: module.EntityLineageTab })
  )
);

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
    [EntityType.DIRECTORY]: DirectoryIcon,
    [SearchIndex.DIRECTORY_SEARCH_INDEX]: DirectoryIcon,
    [EntityType.FILE]: FileIcon,
    [SearchIndex.FILE_SEARCH_INDEX]: FileIcon,
    [EntityType.SPREADSHEET]: SpreadsheetIcon,
    [SearchIndex.SPREADSHEET_SEARCH_INDEX]: SpreadsheetIcon,
    [EntityType.WORKSHEET]: WorksheetIcon,
    [SearchIndex.WORKSHEET_SEARCH_INDEX]: WorksheetIcon,
    [EntityType.DRIVE_SERVICE]: DriveServiceIcon,
    [SearchIndex.DRIVE_SERVICE]: DriveServiceIcon,
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

export const getEntityTypeIcon = (entityType?: string) => {
  return searchClassBase.getEntityIcon(entityType ?? '');
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
        <DataObservabilityTab
          permissions={tablePermissions}
          table={tableDetails}
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
        <Suspense fallback={<Loader />}>
          <EntityLineageTab
            deleted={Boolean(deleted)}
            entity={tableDetails as SourceType}
            entityType={EntityType.TABLE}
            hasEditAccess={editLineagePermission}
          />
        </Suspense>
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
            <Space className="p-y-xss" size="small">
              <div>
                <Typography.Text className="text-grey-muted">
                  {`${t('label.dbt-source-project')}: `}
                </Typography.Text>
                <Typography.Text data-testid="dbt-source-project-id">
                  {tableDetails?.dataModel?.dbtSourceProject ??
                    NO_DATA_PLACEHOLDER}
                </Typography.Text>
              </div>

              <Divider
                className="self-center vertical-divider"
                type="vertical"
              />

              <div>
                <Typography.Text className="text-grey-muted">
                  {`${t('label.path')}: `}
                </Typography.Text>
                <Typography.Text>
                  {tableDetails?.dataModel?.path}
                </Typography.Text>
              </div>
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
export const getColumnOptionsFromTableColumn = (
  columns: Column[],
  useFullyQualifiedName = false
) => {
  const options: {
    label: string;
    value: string;
  }[] = [];

  columns.forEach((item) => {
    options.push({
      label: item.name,
      value: useFullyQualifiedName
        ? item.fullyQualifiedName ?? item.name
        : item.name,
    });

    if (!isEmpty(item.children)) {
      options.push(
        ...getColumnOptionsFromTableColumn(
          item.children ?? [],
          useFullyQualifiedName
        )
      );
    }
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

export const getSchemaFieldCount = <T extends { children?: T[] }>(
  fields: T[]
): number => {
  let count = 0;

  const countFields = (items: T[]): void => {
    items.forEach((item) => {
      count++;
      if (item.children && item.children.length > 0) {
        countFields(item.children);
      }
    });
  };

  countFields(fields);

  return count;
};

export const getSchemaDepth = <T extends { children?: T[] }>(
  fields: T[]
): number => {
  if (!fields || fields.length === 0) {
    return 0;
  }

  let maxDepth = 1;

  const calculateDepth = (items: T[], currentDepth: number): void => {
    items.forEach((item) => {
      maxDepth = Math.max(maxDepth, currentDepth);
      if (item.children && item.children.length > 0) {
        calculateDepth(item.children, currentDepth + 1);
      }
    });
  };

  calculateDepth(fields, 1);

  return maxDepth;
};

export const isLargeSchema = <T extends { children?: T[] }>(
  fields: T[],
  threshold = 500
): boolean => {
  return getSchemaFieldCount(fields) > threshold;
};

export const shouldCollapseSchema = <T extends { children?: T[] }>(
  fields: T[],
  threshold = 50
): boolean => {
  return getSchemaFieldCount(fields) > threshold;
};

export const getExpandAllKeysToDepth = <
  T extends { children?: T[]; name?: string }
>(
  fields: T[],
  maxDepth = 3
): string[] => {
  const keys: string[] = [];

  const collectKeys = (items: T[], currentDepth = 0): void => {
    if (currentDepth >= maxDepth) {
      return;
    }

    items.forEach((item) => {
      if (item.children && item.children.length > 0) {
        if (item.name) {
          keys.push(item.name);
        }
        // Continue collecting keys from children up to maxDepth
        collectKeys(item.children, currentDepth + 1);
      }
    });
  };

  collectKeys(fields);

  return keys;
};

export const getSafeExpandAllKeys = <
  T extends { children?: T[]; name?: string }
>(
  fields: T[],
  isLargeSchema: boolean,
  allKeys: string[]
): string[] => {
  if (!isLargeSchema) {
    return allKeys;
  }

  // For large schemas, expand to exactly 2 levels deep
  return getExpandAllKeysToDepth(fields, 2);
};
