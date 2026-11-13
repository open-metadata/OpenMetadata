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

import type { BadgeColors } from '@openmetadata/ui-core-components';
import {
  Box,
  ButtonUtility,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  Alert,
  ArrayType,
  BinaryType,
  Bitmap,
  BooleanType,
  ChevronDown,
  ChevronRight,
  Clock,
  ConstraintDistribution,
  ConstraintDistributionRemoved,
  ConstraintForeignKey,
  ConstraintForeignKeyRemoved,
  ConstraintKey,
  ConstraintKeyRemoved,
  ConstraintNotNull,
  ConstraintNotNullRemoved,
  ConstraintSort,
  ConstraintSortRemoved,
  ConstraintUnique,
  ConstraintUniqueRemoved,
  CurrencyDollarSuccess,
  DateTimeType,
  DateType,
  DecimalType,
  DoubleType,
  EnumType,
  GeometryType,
  Help,
  IntegerType,
  IpAddressType,
  Json,
  Map02,
  NumberType,
  Polygon,
  RecordType,
  Reorder,
  RequestUpdateDescription,
  StringType,
  Struct,
  TimestampType,
  UnionType,
  Varchar,
  VariantType,
  Xml,
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { uniqBy } from 'lodash';
import { FC, Fragment } from 'react';
import { ExpandableConfig } from '../components/common/Table/Table.interface';
import ConstraintIcon from '../components/discovery/database/ConstraintIcon/ConstraintIcon';
import { ConstraintTypes } from '../enums/table.enum';
import {
  ConstraintType,
  DataType,
  TableConstraint,
} from '../generated/entity/data/table';
import { t } from './i18next/LocalUtil';

// These moved to EntityIconUtils/EntityServiceIconUtils so that importing TableUtils no longer
// drags the entity-icon graph into every consumer. Re-exported because downstream repos (Collate)
// still import them from here; they tree-shake away for callers that do not use them.
export {
  EntityIconSize,
  ENTITY_ICON_SIZE_CLASS_MAP,
  getEntityIcon,
  getEntityTypeIcon,
} from './EntityIconUtils';
export { getServiceIcon } from './EntityServiceIconUtils';

interface ConstraintIconConfig {
  getTitle: () => string;
  icon: SvgComponent;
  deletedIcon: SvgComponent;
  dataTestId: string;
}

const CONSTRAINT_ICON_CONFIG: Record<string, ConstraintIconConfig> = {
  [ConstraintTypes.PRIMARY_KEY]: {
    getTitle: () => t('label.primary-key'),
    icon: ConstraintKey,
    deletedIcon: ConstraintKeyRemoved,
    dataTestId: 'primary-key',
  },
  [ConstraintTypes.UNIQUE]: {
    getTitle: () => t('label.unique'),
    icon: ConstraintUnique,
    deletedIcon: ConstraintUniqueRemoved,
    dataTestId: 'unique',
  },
  [ConstraintTypes.NOT_NULL]: {
    getTitle: () => t('label.not-null'),
    icon: ConstraintNotNull,
    deletedIcon: ConstraintNotNullRemoved,
    dataTestId: 'not-null',
  },
  [ConstraintTypes.FOREIGN_KEY]: {
    getTitle: () => t('label.foreign-key'),
    icon: ConstraintForeignKey,
    deletedIcon: ConstraintForeignKeyRemoved,
    dataTestId: 'foreign-key',
  },
  [ConstraintType.DistKey]: {
    getTitle: () => t('label.entity-key', { entity: t('label.dist') }),
    icon: ConstraintDistribution,
    deletedIcon: ConstraintDistributionRemoved,
    dataTestId: 'dist-key',
  },
  [ConstraintType.SortKey]: {
    getTitle: () => t('label.entity-key', { entity: t('label.sort') }),
    icon: ConstraintSort,
    deletedIcon: ConstraintSortRemoved,
    dataTestId: 'sort-key',
  },
  [ConstraintType.ClusterKey]: {
    getTitle: () => t('label.entity-key', { entity: t('label.cluster') }),
    icon: ConstraintDistribution,
    deletedIcon: ConstraintDistributionRemoved,
    dataTestId: 'cluster-key',
  },
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
  const config = CONSTRAINT_ICON_CONFIG[constraint];
  if (!config) {
    return null;
  }

  const title = config.getTitle();
  const icon = isConstraintDeleted ? config.deletedIcon : config.icon;
  const dataTestId = config.dataTestId;

  const ConstraintIcon = icon;

  return (
    <Tooltip
      arrow
      excludeTriggerFromTabOrder
      placement="bottom"
      title={title}
      triggerClassName={classNames('tw:inline-flex', className)}>
      <ConstraintIcon
        // The core icons default to aria-hidden; this one carries the label.
        aria-hidden={false}
        aria-label={title}
        className={classNames('tw:shrink-0', {
          'diff-added': isConstraintAdded,
          'diff-removed': isConstraintDeleted,
        })}
        data-testid={`constraint-icon-${dataTestId}`}
        height={width}
        role="img"
        width={width}
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
    [DataType.Array]: ArrayType,
    [DataType.Bit]: BinaryType,
    [DataType.Binary]: BinaryType,
    [DataType.Bitmap]: Bitmap,
    [DataType.Image]: Bitmap,
    [DataType.Boolean]: BooleanType,
    [DataType.Date]: DateType,
    [DataType.Year]: DateType,
    [DataType.Datetime]: DateTimeType,
    [DataType.Datetimerange]: DateTimeType,
    [DataType.Double]: DoubleType,
    [DataType.Float]: DoubleType,
    [DataType.Number]: DoubleType,
    [DataType.Decimal]: DecimalType,
    [DataType.Enum]: EnumType,
    [DataType.Error]: Alert,
    [DataType.Map]: Map02,
    [DataType.Geography]: Map02,
    [DataType.Geometry]: GeometryType,
    [DataType.Ipv4]: IpAddressType,
    [DataType.Ipv6]: IpAddressType,
    [DataType.JSON]: Json,
    [DataType.Numeric]: NumberType,
    [DataType.Long]: NumberType,
    [DataType.Money]: CurrencyDollarSuccess,
    [DataType.Char]: Varchar,
    [DataType.Text]: Varchar,
    [DataType.Ntext]: Varchar,
    [DataType.Mediumtext]: Varchar,
    [DataType.Varchar]: Varchar,
    [DataType.Int]: IntegerType,
    [DataType.Bigint]: IntegerType,
    [DataType.Largeint]: IntegerType,
    [DataType.Smallint]: IntegerType,
    [DataType.Tinyint]: IntegerType,
    [DataType.Polygon]: Polygon,
    [DataType.Null]: ConstraintNotNull,
    [DataType.Record]: RecordType,
    [DataType.Table]: RecordType,
    [DataType.String]: StringType,
    [DataType.Struct]: Struct,
    [DataType.Time]: Clock,
    [DataType.Timestamp]: TimestampType,
    [DataType.Timestampz]: TimestampType,
    [DataType.Tsquery]: RequestUpdateDescription,
    [DataType.Union]: UnionType,
    [DataType.Unknown]: Help,
    [DataType.Variant]: VariantType,
    [DataType.XML]: Xml,
  };

  const DataTypeIcon = dataTypeIcons[dataType as keyof typeof dataTypeIcons];

  // antd's <Icon component={null}> rendered nothing; rendering the component
  // directly means an unknown dataType has to be guarded here instead.
  if (!DataTypeIcon) {
    return null;
  }

  return (
    <DataTypeIcon
      aria-label={dataType}
      className="tw:shrink-0"
      height={width}
      role="img"
      width={width}
    />
  );
};

export function getTableExpandableConfig<T>(
  isDraggable?: boolean,
  expandIconClass?: string,
  DragIcon: FC<{ className?: string }> = Reorder
): ExpandableConfig<T> {
  const expandableConfig: ExpandableConfig<T> = {
    expandIcon: ({ expanded, onExpand, expandable, record }) => {
      const ExpandIcon = expanded ? ChevronDown : ChevronRight;

      return expandable ? (
        <>
          {isDraggable && <DragIcon className="drag-icon" />}
          <ButtonUtility
            aria-label={expanded ? t('label.collapse') : t('label.expand')}
            className={classNames(
              'table-expand-icon vertical-baseline',
              expandIconClass
            )}
            data-testid="expand-icon"
            icon={ExpandIcon}
            size="xs"
            onClick={(e: React.MouseEvent<HTMLButtonElement>) =>
              onExpand(record, e)
            }
          />
        </>
      ) : (
        isDraggable && (
          <>
            <DragIcon className="drag-icon" />
            <span className="expand-cell-empty-icon-container" />
          </>
        )
      );
    },
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
      className="d-flex constraint-columns tw:bg-(--om-legacy-color-f8f8f8) tw:dark:bg-transparent"
      data-testid={`${constraintType}-container`}
      key={constraintType}>
      <Box
        inline
        align="stretch"
        className="layout-space constraint-icon-container"
        direction="col"
        gap={0}
        itemClassName="layout-space-item">
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
      </Box>

      <Box
        inline
        align="stretch"
        className="layout-space"
        direction="col"
        gap={4}
        itemClassName="layout-space-item">
        {columns?.map((column) => (
          <Typography ellipsis={{ tooltip: true }} key={column}>
            {column}
          </Typography>
        ))}
      </Box>
    </div>
  );
};

const DATA_TYPE_FAMILIES: Array<[BadgeColors, DataType[]]> = [
  [
    'blue',
    [
      DataType.Char,
      DataType.Varchar,
      DataType.Text,
      DataType.Mediumtext,
      DataType.Ntext,
      DataType.String,
      DataType.Clob,
      DataType.UUID,
      DataType.Enum,
    ],
  ],
  [
    'success',
    [
      DataType.Bigint,
      DataType.Byteint,
      DataType.Decimal,
      DataType.Double,
      DataType.Float,
      DataType.Int,
      DataType.Largeint,
      DataType.Long,
      DataType.Money,
      DataType.Number,
      DataType.Numeric,
      DataType.Smallint,
      DataType.Tinyint,
      DataType.Uint,
    ],
  ],
  [
    'orange',
    [
      DataType.Date,
      DataType.Datetime,
      DataType.Datetimerange,
      DataType.Interval,
      DataType.Time,
      DataType.Timestamp,
      DataType.Timestampz,
      DataType.Year,
    ],
  ],
  ['purple', [DataType.Boolean, DataType.Bit]],
  [
    'pink',
    [
      DataType.Array,
      DataType.JSON,
      DataType.Map,
      DataType.Record,
      DataType.Set,
      DataType.Struct,
      DataType.Super,
      DataType.Tuple,
      DataType.Union,
      DataType.Variant,
      DataType.XML,
    ],
  ],
];

/** Badge colour per data-type family, so every surface colours types alike. */
const DATA_TYPE_BADGE_COLORS = new Map<string, BadgeColors>(
  DATA_TYPE_FAMILIES.flatMap(([color, types]) =>
    types.map((type) => [type, color] as const)
  )
);

/**
 * Colour for a column data-type badge: text, numeric, temporal, boolean and
 * complex types each get one colour; anything else (binary, spatial, …) is
 * gray. Accepts the `DataType` value or a display string such as
 * `varchar(50)`, whose leading word is the type.
 */
export const getDataTypeBadgeColor = (dataType = ''): BadgeColors =>
  DATA_TYPE_BADGE_COLORS.get(dataType.toUpperCase().split(/[^A-Z0-9_]/)[0]) ??
  'gray';
