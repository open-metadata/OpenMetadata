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

import Icon from '@ant-design/icons';
import { Space, Tooltip, Typography } from 'antd';
import { ExpandableConfig } from 'antd/lib/table/interface';
import classNames from 'classnames';
import { uniqBy } from 'lodash';
import { ElementType, Fragment, type CSSProperties } from 'react';
import { ReactComponent as AlertIcon } from '../assets/svg/alert.svg';
import { ReactComponent as AnnouncementIcon } from '../assets/svg/announcements-black.svg';
import { ReactComponent as ApplicationIcon } from '../assets/svg/application.svg';
import { ReactComponent as AutomatorBotIcon } from '../assets/svg/automator-bot.svg';
import { ReactComponent as BotIcon } from '../assets/svg/bot.svg';
import { ReactComponent as ClassificationIcon } from '../assets/svg/classification.svg';
import { ReactComponent as ConversationIcon } from '../assets/svg/comment.svg';
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
import { ReactComponent as IconDown } from '../assets/svg/ic-arrow-down.svg';
import { ReactComponent as IconRight } from '../assets/svg/ic-arrow-right.svg';
import { ReactComponent as DataQualityIcon } from '../assets/svg/ic-data-contract.svg';
import { ReactComponent as PersonaIcon } from '../assets/svg/ic-personas.svg';
import { ReactComponent as PipelineIcon } from '../assets/svg/ic-pipeline.svg';
import { ReactComponent as TeamIcon } from '../assets/svg/ic-teams.svg';
import { ReactComponent as IconDistLineThrough } from '../assets/svg/icon-dist-line-through.svg';
import { ReactComponent as IconDistKey } from '../assets/svg/icon-distribution.svg';
import { ReactComponent as IconKeyLineThrough } from '../assets/svg/icon-key-line-through.svg';
import { ReactComponent as IconKey } from '../assets/svg/icon-key.svg';
import { ReactComponent as IconNotNullLineThrough } from '../assets/svg/icon-not-null-line-through.svg';
import { ReactComponent as IconNotNull } from '../assets/svg/icon-not-null.svg';
import { ReactComponent as RoleIcon } from '../assets/svg/icon-role-grey.svg';
import { ReactComponent as IconSortLineThrough } from '../assets/svg/icon-sort-line-through.svg';
import { ReactComponent as IconSortKey } from '../assets/svg/icon-sort.svg';
import { ReactComponent as IconUniqueLineThrough } from '../assets/svg/icon-unique-line-through.svg';
import { ReactComponent as IconUnique } from '../assets/svg/icon-unique.svg';
import { ReactComponent as KPIIcon } from '../assets/svg/kpi.svg';
import { ReactComponent as LocationIcon } from '../assets/svg/location.svg';
import { ReactComponent as NotificationIcon } from '../assets/svg/notification.svg';
import { ReactComponent as PolicyIcon } from '../assets/svg/policies.svg';
import { ReactComponent as ServicesIcon } from '../assets/svg/services.svg';
import { ReactComponent as TaskIcon } from '../assets/svg/task-ic.svg';
import { ReactComponent as UserIcon } from '../assets/svg/user.svg';
import {
  ENTITY_ICON_MAPPER,
  NON_SERVICE_TYPE_ASSETS,
} from '../constants/Assets.constants';
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

// Data-asset and data/infra-service entity types use the new branded SVGs
// from ENTITY_ICON_MAPPER (the explore redesign's design system); governance
// and admin entities without an ENTITY_ICON_MAPPER entry keep their existing
// branded SVGs. All entries are rendered as <Icon className={} style={} />,
// which accepts the broader React.ElementType shape ENTITY_ICON_MAPPER uses.
const entityIconMapping: Record<string, ElementType> = {
  [SearchIndex.DATABASE]: ENTITY_ICON_MAPPER[EntityType.DATABASE].icon,
  [SearchIndex.DATABASE_SERVICE]:
    ENTITY_ICON_MAPPER[EntityType.DATABASE_SERVICE].icon,
  [SearchIndex.DATABASE_SCHEMA]:
    ENTITY_ICON_MAPPER[EntityType.DATABASE_SCHEMA].icon,
  [SearchIndex.TOPIC]: ENTITY_ICON_MAPPER[EntityType.TOPIC].icon,
  [EntityType.MESSAGING_SERVICE]:
    ENTITY_ICON_MAPPER[EntityType.MESSAGING_SERVICE].icon,
  [SearchIndex.DASHBOARD]: ENTITY_ICON_MAPPER[EntityType.DASHBOARD].icon,
  [EntityType.DASHBOARD_SERVICE]:
    ENTITY_ICON_MAPPER[EntityType.DASHBOARD_SERVICE].icon,
  [SearchIndex.MLMODEL]: ENTITY_ICON_MAPPER[EntityType.MLMODEL].icon,
  [EntityType.MLMODEL_SERVICE]:
    ENTITY_ICON_MAPPER[EntityType.MLMODEL_SERVICE].icon,
  [SearchIndex.PIPELINE]: ENTITY_ICON_MAPPER[EntityType.PIPELINE].icon,
  [EntityType.PIPELINE_SERVICE]:
    ENTITY_ICON_MAPPER[EntityType.PIPELINE_SERVICE].icon,
  [SearchIndex.CONTAINER]: ENTITY_ICON_MAPPER[EntityType.CONTAINER].icon,
  [EntityType.STORAGE_SERVICE]:
    ENTITY_ICON_MAPPER[EntityType.STORAGE_SERVICE].icon,
  [SearchIndex.DASHBOARD_DATA_MODEL]:
    ENTITY_ICON_MAPPER[EntityType.DASHBOARD_DATA_MODEL].icon,
  [SearchIndex.STORED_PROCEDURE]:
    ENTITY_ICON_MAPPER[EntityType.STORED_PROCEDURE].icon,
  [EntityType.CLASSIFICATION]:
    ENTITY_ICON_MAPPER[EntityType.CLASSIFICATION].icon,
  [SearchIndex.TAG]: ENTITY_ICON_MAPPER[EntityType.TAG].icon,
  [SearchIndex.GLOSSARY]: ENTITY_ICON_MAPPER[EntityType.GLOSSARY].icon,
  [SearchIndex.GLOSSARY_TERM]:
    ENTITY_ICON_MAPPER[EntityType.GLOSSARY_TERM].icon,
  [SearchIndex.DOMAIN]: ENTITY_ICON_MAPPER[EntityType.DOMAIN].icon,
  [SearchIndex.CHART]: ENTITY_ICON_MAPPER[EntityType.CHART].icon,
  [SearchIndex.TABLE]: ENTITY_ICON_MAPPER[EntityType.TABLE].icon,
  [SearchIndex.COLUMN]: ENTITY_ICON_MAPPER[EntityType.TABLE_COLUMN].icon,
  [SearchIndex.ML_MODEL_SERVICE]:
    ENTITY_ICON_MAPPER[EntityType.MLMODEL_SERVICE].icon,
  [EntityType.METADATA_SERVICE]:
    ENTITY_ICON_MAPPER[EntityType.METADATA_SERVICE].icon,
  [SearchIndex.DATA_PRODUCT]: ENTITY_ICON_MAPPER[EntityType.DATA_PRODUCT].icon,
  [EntityType.TEST_CASE]: ENTITY_ICON_MAPPER[EntityType.TEST_CASE].icon,
  [EntityType.TEST_SUITE]: ENTITY_ICON_MAPPER[EntityType.TEST_SUITE].icon,
  [EntityType.DATA_CONTRACT]: ENTITY_ICON_MAPPER[EntityType.DATA_CONTRACT].icon,
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
  [EntityType.API_ENDPOINT]: ENTITY_ICON_MAPPER[EntityType.API_ENDPOINT].icon,
  [EntityType.METRIC]: ENTITY_ICON_MAPPER[EntityType.METRIC].icon,
  [EntityType.API_SERVICE]: ENTITY_ICON_MAPPER[EntityType.API_SERVICE].icon,
  [EntityType.API_COLLECTION]:
    ENTITY_ICON_MAPPER[EntityType.API_COLLECTION].icon,
  ['location']: LocationIcon,
  [EntityType.QUERY]: ENTITY_ICON_MAPPER[EntityType.QUERY].icon,
  [EntityType.DIRECTORY]: ENTITY_ICON_MAPPER[EntityType.DIRECTORY].icon,
  [EntityType.FILE]: ENTITY_ICON_MAPPER[EntityType.FILE].icon,
  [EntityType.SPREADSHEET]: ENTITY_ICON_MAPPER[EntityType.SPREADSHEET].icon,
  [EntityType.WORKSHEET]: ENTITY_ICON_MAPPER[EntityType.WORKSHEET].icon,
  [EntityType.DRIVE_SERVICE]: ENTITY_ICON_MAPPER[EntityType.DRIVE_SERVICE].icon,
  [EntityType.KNOWLEDGE_PAGE]:
    ENTITY_ICON_MAPPER[EntityType.KNOWLEDGE_PAGE].icon,
  [EntityType.KNOWLEDGE_CENTER]:
    ENTITY_ICON_MAPPER[EntityType.KNOWLEDGE_CENTER].icon,
  [EntityType.knowledgePanels]:
    ENTITY_ICON_MAPPER[EntityType.KNOWLEDGE_CENTER].icon,
  [EntityType.SEARCH_INDEX]: ENTITY_ICON_MAPPER[EntityType.SEARCH_INDEX].icon,
  [EntityType.SEARCH_SERVICE]:
    ENTITY_ICON_MAPPER[EntityType.SEARCH_SERVICE].icon,
};

export const getEntityIcon = (
  indexType: string,
  iconClass = '',
  iconStyle = {}
) => {
  const className = iconClass;
  const style: CSSProperties = iconStyle;

  const Icon = entityIconMapping[indexType];

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
    const iconEntityType =
      source.entityType === EntityType.TAG
        ? EntityType.CLASSIFICATION
        : source.entityType;

    return searchClassBase.getEntityIcon(
      iconEntityType ?? '',
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
