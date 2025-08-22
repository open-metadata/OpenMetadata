/*
 *  Copyright 2024 Collate.
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

import { DownOutlined, SearchOutlined, UpOutlined } from '@ant-design/icons';
import { Button, Collapse, Input, Space } from 'antd';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Handle, Position } from 'reactflow';
import { BORDER_COLOR } from '../../constants/constants';
import {
  DATATYPES_HAVING_SUBFIELDS,
  LINEAGE_COLUMN_NODE_SUPPORTED,
} from '../../constants/Lineage.constants';
import { useLineageUI } from '../../context/LineageV1/hooks/useLineageUI';
import { useLineageView } from '../../context/LineageV1/hooks/useLineageView';
import { EntityType } from '../../enums/entity.enum';
import { Column } from '../../generated/entity/data/table';
import { LineageLayer } from '../../generated/settings/settings';
import { getEntityChildrenAndLabel } from '../../utils/EntityLineageUtils';
import { getEntityName } from '../../utils/EntityUtils';
import searchClassBase from '../../utils/SearchClassBase';
import '../Entity/EntityLineage/entity-lineage.style.less';

const { Panel } = Collapse;

interface NodeChildrenV1Props {
  node: any;
  isConnectable: boolean;
}

const NodeChildrenV1 = memo(({ node, isConnectable }: NodeChildrenV1Props) => {
  const { t } = useTranslation();
  const { activeLayer, isEditMode } = useLineageUI();
  const { expandAllColumns } = useLineageView();
  
  const [searchValue, setSearchValue] = useState('');
  const [filteredColumns, setFilteredColumns] = useState<any[]>([]);
  const [showAllColumns, setShowAllColumns] = useState(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const showColumns = useMemo(() => {
    return activeLayer?.includes(LineageLayer.ColumnLevelLineage) ?? false;
  }, [activeLayer]);

  const supportsColumns = useMemo(() => {
    return (
      node &&
      LINEAGE_COLUMN_NODE_SUPPORTED.includes(node.entityType as EntityType)
    );
  }, [node]);

  const { children, childrenHeading } = useMemo(
    () => getEntityChildrenAndLabel(node),
    [node]
  );

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      e.stopPropagation();
      const value = e.target.value;
      setSearchValue(value);

      if (value.trim() === '') {
        // If search value is empty, show all columns
        const filterColumns = Object.values(children ?? {});
        setFilteredColumns(filterColumns);
      } else {
        // Filter columns based on search value
        const filtered = Object.values(children ?? {}).filter((column: any) =>
          getEntityName(column).toLowerCase().includes(value.toLowerCase())
        );
        setFilteredColumns(filtered);
        setShowAllColumns(true);
      }
    },
    [children]
  );

  const handleShowMoreClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setShowAllColumns(true);
  };

  const isColumnVisible = useCallback(
    (record: Column) => {
      if (expandAllColumns || isEditMode || showAllColumns) {
        return true;
      }
      // In simplified version, show all columns if we're showing columns
      return true;
    },
    [isEditMode, expandAllColumns, showAllColumns]
  );

  useEffect(() => {
    if (!isEmpty(children)) {
      setFilteredColumns(children);
    }
  }, [children]);

  useEffect(() => {
    setShowAllColumns(expandAllColumns);
  }, [expandAllColumns]);

  const renderColumn = useCallback(
    (column: Column) => {
      const columnName = getEntityName(column);
      const hasSubFields = column.children && column.children.length > 0;
      
      return (
        <div
          key={column.fullyQualifiedName}
          className="custom-node-column-container"
          data-testid={`column-${column.fullyQualifiedName}`}>
          {/* Column handle for connections */}
          {isConnectable && (
            <>
              <Handle
                className="lineage-column-node-handle"
                id={column.fullyQualifiedName}
                position={Position.Left}
                type="target"
              />
              <Handle
                className="lineage-column-node-handle"
                id={column.fullyQualifiedName}
                position={Position.Right}
                type="source"
              />
            </>
          )}
          
          <div className="custom-node-column-name">
            <span>{columnName}</span>
            {column.dataType && (
              <span className="text-grey-muted ml-1">({column.dataType})</span>
            )}
          </div>
          
          {/* Render sub-fields if any */}
          {hasSubFields && (
            <div className="ml-4">
              {column.children?.map((child: Column) => renderColumn(child))}
            </div>
          )}
        </div>
      );
    },
    [isConnectable]
  );

  // Don't render anything if columns are not enabled or node doesn't support columns
  if (!showColumns || !supportsColumns || isEmpty(children)) {
    return null;
  }

  const visibleColumns = filteredColumns.filter(isColumnVisible);
  const hasMoreColumns = !showAllColumns && filteredColumns.length > visibleColumns.length;

  return (
    <div className="custom-node-children-container">
      <Collapse
        bordered={false}
        className="custom-node-collapse"
        activeKey={isExpanded ? ['1'] : []}
        onChange={() => setIsExpanded(!isExpanded)}>
        <Panel
          header={
            <div className="custom-node-column-header">
              <span>{childrenHeading}</span>
              <span className="text-grey-muted ml-1">
                ({filteredColumns.length})
              </span>
            </div>
          }
          key="1"
          extra={
            isExpanded ? (
              <UpOutlined onClick={(e) => e.stopPropagation()} />
            ) : (
              <DownOutlined onClick={(e) => e.stopPropagation()} />
            )
          }>
          {/* Search input */}
          {filteredColumns.length > 5 && (
            <div className="p-2">
              <Input
                placeholder={t('label.search-entity', { entity: childrenHeading })}
                prefix={<SearchOutlined />}
                value={searchValue}
                onChange={handleSearchChange}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
          
          {/* Columns list */}
          <div className="custom-node-columns-list">
            {visibleColumns.map((column) => renderColumn(column))}
          </div>
          
          {/* Show more button */}
          {hasMoreColumns && (
            <div className="text-center p-2">
              <Button
                type="link"
                size="small"
                onClick={handleShowMoreClick}>
                {t('label.show-more')}
              </Button>
            </div>
          )}
        </Panel>
      </Collapse>
    </div>
  );
});

NodeChildrenV1.displayName = 'NodeChildrenV1';

export default NodeChildrenV1;