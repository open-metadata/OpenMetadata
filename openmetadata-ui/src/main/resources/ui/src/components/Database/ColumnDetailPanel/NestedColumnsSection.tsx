/*
 *  Copyright 2025 Collate.
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
import { Badge } from '@openmetadata/ui-core-components';
import { Typography } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ColumnIcon } from '../../../assets/svg/ic-column-new.svg';
import { Column } from '../../../generated/entity/data/table';
import { getEntityName } from '../../../utils/EntityUtils';
import { getNestedSectionTitle } from '../../../utils/TableUtils';
import { NestedColumnsSectionProps } from './NestedColumnsSection.interface';

const NestedColumnItem: React.FC<{
  column: Column;
  depth: number;
  onColumnClick: (column: Column) => void;
}> = ({ column, depth, onColumnClick }) => {
  const hasChildren = column.children && column.children.length > 0;

  return (
    <div key={column.fullyQualifiedName}>
      <p
        className="tw:group tw:flex tw:items-center tw:gap-1 tw:border-0 tw:bg-transparent tw:py-1 tw:text-left"
        style={{ paddingLeft: `${depth * 8}px` }}>
        <ColumnIcon
          className="tw:text-brand-700"
          style={{
            width: 11,
            height: 11,
            strokeWidth: '1.2px',
          }}
        />
        <Typography.Link
          className="nested-column-name tw:text-sm tw:font-normal group-hover:tw:underline"
          onClick={() => onColumnClick(column)}>
          {getEntityName(column)}
        </Typography.Link>
      </p>
      {hasChildren && (
        <div className="tw:pl-2">
          {column.children?.map((child) => (
            <NestedColumnItem
              column={child}
              depth={depth + 1}
              key={child.fullyQualifiedName}
              onColumnClick={onColumnClick}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const NestedColumnsSection: React.FC<NestedColumnsSectionProps> = ({
  columns,
  entityType,
  onColumnClick,
}) => {
  const { t } = useTranslation();

  if (columns.length === 0) {
    return null;
  }

  return (
    <div className="tw:border-b-[0.6px] tw:border-tertiary tw:px-4 tw:pb-4">
      <div className="tw:mb-3 tw:flex tw:items-center tw:gap-2">
        <span className="tw:text-[13px] tw:font-semibold tw:text-primary">
          {t(getNestedSectionTitle(entityType))}
        </span>

        <Badge
          className="tw:text-[10px] tw:font-medium tw:text-tertiary"
          color="gray"
          size="sm"
          type="color">
          {columns.length}
        </Badge>
      </div>
      <div className="tw:flex tw:flex-col tw:gap-0.5">
        {columns.map((column) => (
          <NestedColumnItem
            column={column}
            depth={0}
            key={column.fullyQualifiedName}
            onColumnClick={onColumnClick}
          />
        ))}
      </div>
    </div>
  );
};
