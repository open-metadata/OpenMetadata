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
import { uniqBy } from 'lodash';
import { Fragment, type CSSProperties } from 'react';
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
import { ReactComponent as ColumnIcon } from '../assets/svg/ic-column.svg';
import { ReactComponent as DashboardIcon } from '../assets/svg/ic-dashboard.svg';
import { ReactComponent as DataQualityIcon } from '../assets/svg/ic-data-contract.svg';
import { ReactComponent as DataProductIcon } from '../assets/svg/ic-data-product.svg';
import { ReactComponent as DatabaseIcon } from '../assets/svg/ic-database.svg';
import { ReactComponent as DirectoryIcon } from '../assets/svg/ic-directory.svg';
import { ReactComponent as DomainIcon } from '../assets/svg/ic-domain.svg';
import { ReactComponent as DriveServiceIcon } from '../assets/svg/ic-drive-service.svg';
import { ReactComponent as FileIcon } from '../assets/svg/ic-file.svg';
import { ReactComponent as KnowledgePageIcon } from '../assets/svg/ic-knowledge-page.svg';
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
import { NON_SERVICE_TYPE_ASSETS } from '../constants/Assets.constants';
import { DE_ACTIVE_COLOR } from '../constants/constants';
import { EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { ConstraintTypes } from '../enums/table.enum';
import {
  ConstraintType,
  DataType,
  TableConstraint,
} from '../generated/entity/data/table';
import ConstraintIcon from '../pages/TableDetailsPageV1/TableConstraints/ConstraintIcon';
import { t } from './i18next/LocalUtil';
import searchClassBase from './SearchClassBase';
import serviceUtilClassBase from './ServiceUtilClassBase';

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

const entityIconMapping: Record<string, SvgComponent> = {
  [SearchIndex.DATABASE]: DatabaseIcon,
  [SearchIndex.DATABASE_SERVICE]: DatabaseIcon,
  [SearchIndex.DATABASE_SCHEMA]: SchemaIcon,
  [SearchIndex.TOPIC]: TopicIcon,
  [EntityType.MESSAGING_SERVICE]: TopicIcon,
  [SearchIndex.DASHBOARD]: DashboardIcon,
  [EntityType.DASHBOARD_SERVICE]: DashboardIcon,
  [SearchIndex.MLMODEL]: MlModelIcon,
  [EntityType.MLMODEL_SERVICE]: MlModelIcon,
  [SearchIndex.PIPELINE]: PipelineIcon,
  [EntityType.PIPELINE_SERVICE]: PipelineIcon,
  [SearchIndex.CONTAINER]: ContainerIcon,
  [EntityType.STORAGE_SERVICE]: ContainerIcon,
  [SearchIndex.DASHBOARD_DATA_MODEL]: IconDataModel,
  [SearchIndex.STORED_PROCEDURE]: IconStoredProcedure,
  [EntityType.CLASSIFICATION]: ClassificationIcon,
  [SearchIndex.TAG]: TagIcon,
  [SearchIndex.GLOSSARY]: GlossaryIcon,
  [SearchIndex.GLOSSARY_TERM]: GlossaryTermIcon,
  [SearchIndex.DOMAIN]: DomainIcon,
  [SearchIndex.CHART]: ChartIcon,
  [SearchIndex.TABLE]: TableIcon,
  [SearchIndex.COLUMN]: ColumnIcon,
  [EntityType.METADATA_SERVICE]: MetadataServiceIcon,
  [SearchIndex.DATA_PRODUCT]: DataProductIcon,
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
  [EntityType.INGESTION_PIPELINE]: PipelineIcon,
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
  [EntityType.METRIC]: MetricIcon,
  [EntityType.API_SERVICE]: APIServiceIcon,
  [EntityType.API_COLLECTION]: APICollectionIcon,
  ['location']: LocationIcon,
  [EntityType.QUERY]: QueryIcon,
  [EntityType.DIRECTORY]: DirectoryIcon,
  [EntityType.FILE]: FileIcon,
  [EntityType.SPREADSHEET]: SpreadsheetIcon,
  [EntityType.WORKSHEET]: WorksheetIcon,
  [EntityType.DRIVE_SERVICE]: DriveServiceIcon,
  [EntityType.KNOWLEDGE_PAGE]: KnowledgePageIcon,
  [EntityType.KNOWLEDGE_CENTER]: KnowledgePageIcon,
  [EntityType.knowledgePanels]: KnowledgePageIcon,
};

export const getEntityIcon = (
  indexType: string,
  iconClass = '',
  iconStyle = {}
) => {
  let Icon;
  let className = iconClass;
  const style: CSSProperties = iconStyle;

  switch (indexType) {
    case EntityType.SEARCH_INDEX:
    case SearchIndex.SEARCH_INDEX:
    case EntityType.SEARCH_SERVICE:
    case SearchIndex.SEARCH_SERVICE:
      Icon = SearchOutlined;
      className = classNames('text-sm text-inherit', iconClass);

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

export const getServiceIcon = (source: {
  entityType?: EntityType | string;
}) => {
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

export function getTableExpandableConfig<T>(
  isDraggable?: boolean,
  expandIconClass?: string
): ExpandableConfig<T> {
  const expandableConfig: ExpandableConfig<T> = {
    expandIcon: ({ expanded, onExpand, expandable, record }) =>
      expandable ? (
        <>
          {isDraggable && <IconDrag className="drag-icon" />}
          <Icon
            className={classNames(
              'table-expand-icon vertical-baseline',
              expandIconClass
            )}
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
