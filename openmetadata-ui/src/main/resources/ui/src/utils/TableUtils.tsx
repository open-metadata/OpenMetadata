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

import Icon, { FilterOutlined, SearchOutlined } from '@ant-design/icons';
import { Tooltip } from 'antd';
import { ExpandableConfig } from 'antd/lib/table/interface';
import classNames from 'classnames';
import { t } from 'i18next';
import {
  isUndefined,
  lowerCase,
  omit,
  reduce,
  toString,
  uniqBy,
  uniqueId,
  upperCase,
} from 'lodash';
import { EntityTags } from 'Models';
import React from 'react';
import { ReactComponent as AnnouncementIcon } from '../assets/svg/announcements-black.svg';
import { ReactComponent as IconTerm } from '../assets/svg/book.svg';
import { ReactComponent as ClassificationIcon } from '../assets/svg/classification.svg';
import { ReactComponent as ConversationIcon } from '../assets/svg/comment.svg';
import { ReactComponent as IconDataModel } from '../assets/svg/data-model.svg';
import { ReactComponent as IconDrag } from '../assets/svg/drag.svg';
import { ReactComponent as IconForeignKeyLineThrough } from '../assets/svg/foreign-key-line-through.svg';
import { ReactComponent as IconForeignKey } from '../assets/svg/foreign-key.svg';
import { ReactComponent as GlossaryIcon } from '../assets/svg/glossary.svg';
import { ReactComponent as IconDown } from '../assets/svg/ic-arrow-down.svg';
import { ReactComponent as IconRight } from '../assets/svg/ic-arrow-right.svg';
import { ReactComponent as TestCaseIcon } from '../assets/svg/ic-checklist.svg';
import { ReactComponent as DashboardIcon } from '../assets/svg/ic-dashboard.svg';
import { ReactComponent as DataProductIcon } from '../assets/svg/ic-data-product.svg';
import { ReactComponent as DatabaseIcon } from '../assets/svg/ic-database.svg';
import { ReactComponent as DomainIcon } from '../assets/svg/ic-domain.svg';
import { ReactComponent as MlModelIcon } from '../assets/svg/ic-ml-model.svg';
import { ReactComponent as PipelineIcon } from '../assets/svg/ic-pipeline.svg';
import { ReactComponent as SchemaIcon } from '../assets/svg/ic-schema.svg';
import { ReactComponent as ContainerIcon } from '../assets/svg/ic-storage.svg';
import { ReactComponent as IconStoredProcedure } from '../assets/svg/ic-stored-procedure.svg';
import { ReactComponent as TableIcon } from '../assets/svg/ic-table.svg';
import { ReactComponent as TopicIcon } from '../assets/svg/ic-topic.svg';
import { ReactComponent as IconKeyLineThrough } from '../assets/svg/icon-key-line-through.svg';
import { ReactComponent as IconKey } from '../assets/svg/icon-key.svg';
import { ReactComponent as IconNotNullLineThrough } from '../assets/svg/icon-not-null-line-through.svg';
import { ReactComponent as IconNotNull } from '../assets/svg/icon-not-null.svg';
import { ReactComponent as IconTestSuite } from '../assets/svg/icon-test-suite.svg';
import { ReactComponent as IconUniqueLineThrough } from '../assets/svg/icon-unique-line-through.svg';
import { ReactComponent as IconUnique } from '../assets/svg/icon-unique.svg';
import { ReactComponent as TaskIcon } from '../assets/svg/task-ic.svg';
import { SourceType } from '../components/SearchedData/SearchedData.interface';
import { FQN_SEPARATOR_CHAR } from '../constants/char.constants';
import {
  DE_ACTIVE_COLOR,
  PRIMERY_COLOR,
  TEXT_BODY_COLOR,
} from '../constants/constants';
import { EntityType, FqnPart } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { ConstraintTypes, PrimaryTableDataTypes } from '../enums/table.enum';
import { SearchIndexField } from '../generated/entity/data/searchIndex';
import {
  Column,
  DataType,
  TableConstraint,
} from '../generated/entity/data/table';
import { Field } from '../generated/type/schema';
import { LabelType, State, TagLabel } from '../generated/type/tagLabel';
import {
  getPartialNameFromTableFQN,
  getTableFQNFromColumnFQN,
  sortTagsCaseInsensitive,
} from './CommonUtils';
import serviceUtilClassBase from './ServiceUtilClassBase';
import { ordinalize } from './StringsUtils';
import { TableFieldsInfoCommonEntities } from './TableUtils.interface';

export const getUsagePercentile = (pctRank: number, isLiteral = false) => {
  const percentile = Math.round(pctRank * 10) / 10;
  const ordinalPercentile = ordinalize(percentile);
  const usagePercentile = `${
    isLiteral ? t('label.usage') : ''
  } ${ordinalPercentile} ${t('label.pctile-lowercase')}`;

  return usagePercentile;
};

export const getTierFromTableTags = (
  tags: Array<EntityTags>
): EntityTags['tagFQN'] => {
  const tierTag = tags.find(
    (item) =>
      item.tagFQN.startsWith(`Tier${FQN_SEPARATOR_CHAR}Tier`) &&
      !isNaN(parseInt(item.tagFQN.substring(9).trim()))
  );

  return tierTag?.tagFQN || '';
};

export const getTierTags = (tags: Array<TagLabel>) => {
  const tierTag = tags.find(
    (item) =>
      item.tagFQN.startsWith(`Tier${FQN_SEPARATOR_CHAR}Tier`) &&
      !isNaN(parseInt(item.tagFQN.substring(9).trim()))
  );

  return tierTag;
};

export const getTagsWithoutTier = (
  tags: Array<EntityTags>
): Array<EntityTags> => {
  return tags.filter(
    (item) =>
      !item.tagFQN.startsWith(`Tier${FQN_SEPARATOR_CHAR}Tier`) ||
      isNaN(parseInt(item.tagFQN.substring(9).trim()))
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

export const getServiceIcon = (source: SourceType) => {
  if (source.entityType === EntityType.GLOSSARY_TERM) {
    return (
      <GlossaryIcon
        className="service-icon h-7"
        style={{ color: DE_ACTIVE_COLOR }}
      />
    );
  } else if (source.entityType === EntityType.TAG) {
    return (
      <ClassificationIcon
        className="service-icon h-7"
        style={{ color: DE_ACTIVE_COLOR }}
      />
    );
  } else if (source.entityType === EntityType.DATA_PRODUCT) {
    return (
      <DataProductIcon
        className="service-icon h-7"
        style={{ color: DE_ACTIVE_COLOR }}
      />
    );
  } else if (source.entityType === EntityType.DOMAIN) {
    return (
      <DomainIcon
        className="service-icon h-7"
        style={{ color: DE_ACTIVE_COLOR }}
      />
    );
  } else if (source.entityType === EntityType.TEST_CASE) {
    return (
      <TestCaseIcon
        className="service-icon h-7"
        style={{ color: DE_ACTIVE_COLOR }}
      />
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

export const getEntityIcon = (indexType: string) => {
  switch (indexType) {
    case SearchIndex.DATABASE:
    case EntityType.DATABASE:
      return <DatabaseIcon />;

    case SearchIndex.DATABASE_SCHEMA:
    case EntityType.DATABASE_SCHEMA:
      return <SchemaIcon />;

    case SearchIndex.TOPIC:
    case EntityType.TOPIC:
    case EntityType.MESSAGING_SERVICE:
    case SearchIndex.MESSAGING_SERVICE:
      return <TopicIcon />;

    case SearchIndex.DASHBOARD:
    case EntityType.DASHBOARD:
    case EntityType.DASHBOARD_SERVICE:
    case SearchIndex.DASHBOARD_SERVICE:
      return <DashboardIcon />;

    case SearchIndex.MLMODEL:
    case EntityType.MLMODEL:
    case EntityType.MLMODEL_SERVICE:
    case SearchIndex.ML_MODEL_SERVICE:
      return <MlModelIcon />;

    case SearchIndex.PIPELINE:
    case EntityType.PIPELINE:
    case EntityType.PIPELINE_SERVICE:
    case SearchIndex.PIPELINE_SERVICE:
    case 'ingestionPipeline':
      return <PipelineIcon />;

    case SearchIndex.CONTAINER:
    case EntityType.CONTAINER:
    case EntityType.STORAGE_SERVICE:
    case SearchIndex.STORAGE_SERVICE:
      return <ContainerIcon />;

    case SearchIndex.DASHBOARD_DATA_MODEL:
    case EntityType.DASHBOARD_DATA_MODEL:
      return <IconDataModel />;

    case SearchIndex.STORED_PROCEDURE:
    case EntityType.STORED_PROCEDURE:
      return <IconStoredProcedure />;

    case SearchIndex.TAG:
    case EntityType.TAG:
    case 'tagCategory':
      return <ClassificationIcon />;
    case SearchIndex.GLOSSARY:
    case EntityType.GLOSSARY:
      return <GlossaryIcon />;
    case EntityType.GLOSSARY_TERM:
    case SearchIndex.GLOSSARY_TERM:
      return <IconTerm />;
    case EntityType.SEARCH_INDEX:
    case SearchIndex.SEARCH_INDEX:
    case EntityType.SEARCH_SERVICE:
    case SearchIndex.SEARCH_SERVICE:
      return (
        <SearchOutlined
          className="text-sm text-inherit"
          style={{ color: DE_ACTIVE_COLOR }}
        />
      );

    case EntityType.DOMAIN:
    case SearchIndex.DOMAIN:
      return <DomainIcon />;

    case EntityType.DATA_PRODUCT:
    case SearchIndex.DATA_PRODUCT:
      return <DataProductIcon />;

    case 'announcement':
      return <AnnouncementIcon />;

    case 'conversation':
      return <ConversationIcon />;

    case 'task':
      return <TaskIcon />;

    case EntityType.TEST_CASE:
    case EntityType.TEST_SUITE:
      return <IconTestSuite height={16} width={16} />;

    case SearchIndex.TABLE:
    case EntityType.TABLE:
    default:
      return <TableIcon />;
  }
};

export const makeRow = <T extends Column | SearchIndexField>(column: T) => {
  return {
    description: column.description ?? '',
    // Sorting tags as the response of PATCH request does not return the sorted order
    // of tags, but is stored in sorted manner in the database
    // which leads to wrong PATCH payload sent after further tags removal
    tags: sortTagsCaseInsensitive(column.tags ?? []),
    key: column?.name,
    ...column,
  };
};

export const makeData = <T extends Column | SearchIndexField>(
  columns: T[] = []
): Array<T & { id: string }> => {
  return columns.map((column) => ({
    ...makeRow(column),
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
  const columnLink = '<#E::table::ENTITY_FQN::columns::COLUMN>';
  const tableLink = '<#E::table::ENTITY_FQN>';

  if (includeColumn) {
    const tableFqn = getTableFQNFromColumnFQN(fqn);
    const columnName = getPartialNameFromTableFQN(fqn, [FqnPart.NestedColumn]);

    return columnLink
      .replace('ENTITY_FQN', tableFqn)
      .replace('COLUMN', columnName);
  } else {
    return tableLink.replace('ENTITY_FQN', fqn);
  }
};

export function getTableExpandableConfig<T>(
  isDraggable?: boolean
): ExpandableConfig<T> {
  const expandableConfig: ExpandableConfig<T> = {
    expandIcon: ({ expanded, onExpand, expandable, record }) =>
      expandable ? (
        <>
          {isDraggable && (
            <IconDrag className="m-r-xs drag-icon" height={12} width={8} />
          )}
          <Icon
            className="m-r-xs vertical-baseline"
            component={expanded ? IconDown : IconRight}
            data-testid="expand-icon"
            style={{ fontSize: '10px', color: TEXT_BODY_COLOR }}
            onClick={(e) => onExpand(record, e)}
          />
        </>
      ) : (
        isDraggable && (
          <>
            <IconDrag className="m-r-xs drag-icon" height={12} width={8} />
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

export const getUpdatedTags = <T extends TableFieldsInfoCommonEntities>(
  newFieldTags: Array<EntityTags>,
  field?: T
): TagLabel[] => {
  const prevTagsFqn = field?.tags?.map((tag) => tag.tagFQN);

  return reduce(
    newFieldTags,
    (acc: Array<EntityTags>, cv: EntityTags) => {
      if (prevTagsFqn?.includes(cv.tagFQN)) {
        const prev = field?.tags?.find((tag) => tag.tagFQN === cv.tagFQN);

        return [...acc, prev];
      } else {
        return [
          ...acc,
          {
            ...omit(cv, 'isRemovable'),
            labelType: LabelType.Manual,
            state: State.Confirmed,
          },
        ];
      }
    },
    []
  );
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

export const updateFieldTags = <T extends TableFieldsInfoCommonEntities>(
  changedFieldFQN: string,
  newFieldTags: EntityTags[],
  searchIndexFields?: Array<T>
) => {
  searchIndexFields?.forEach((field) => {
    if (field.fullyQualifiedName === changedFieldFQN) {
      field.tags = getUpdatedTags<T>(newFieldTags, field);
    } else {
      updateFieldTags(
        changedFieldFQN,
        newFieldTags,
        field?.children as Array<T>
      );
    }
  });
};
export const FilterIcon = (filtered: boolean) => (
  <FilterOutlined style={{ color: filtered ? PRIMERY_COLOR : undefined }} />
);

export const getFilterIcon = (dataTestId: string) => (filtered: boolean) =>
  (
    <FilterOutlined
      data-testid={dataTestId}
      style={{ color: filtered ? PRIMERY_COLOR : undefined }}
    />
  );
