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

import { DownOutlined, SearchOutlined, UpOutlined } from '@ant-design/icons';
import { Button, Input } from 'antd';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NodeProps, useUpdateNodeInternals } from 'reactflow';
import { BORDER_COLOR } from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import { getEntityName } from '../../../utils/EntityUtils';
import SVGIcons from '../../../utils/SvgUtils';
import { getConstraintIcon } from '../../../utils/TableUtils';
import './custom-node.less';
import { getColumnHandle, getHandle } from './CustomNode.utils';
import './entity-lineage.style.less';
import { ModifiedColumn } from './EntityLineage.interface';
import LineageNodeLabelV1 from './LineageNodeLabelV1';

const CustomNodeV1 = (props: NodeProps) => {
  const { t } = useTranslation();
  const updateNodeInternals = useUpdateNodeInternals();
  const { data, type, isConnectable, selected, id } = props;
  /* eslint-disable-next-line */
  const {
    columns,
    label,
    removeNodeHandler,
    handleColumnClick,
    onNodeExpand,
    isEditMode,
    isExpanded,
    isNewNode,
    isTraced,
    selectedColumns = [],
    lineageLeafNodes,
    isNodeLoading,
    loadNodeHandler,
    onSelect,
    node,
  } = data;
  const [searchValue, setSearchValue] = useState('');
  const [filteredColumns, setFilteredColumns] = useState<ModifiedColumn[]>([]);
  const [showAllColumns, setShowAllColumns] = useState(false);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const value = e.target.value;
    setSearchValue(value);

    if (value.trim() === '') {
      // If search value is empty, show all columns or the default number of columns
      const filterColumns = Object.values(columns || {}) as ModifiedColumn[];
      setFilteredColumns(
        showAllColumns ? filterColumns : filterColumns.slice(0, 5)
      );
    } else {
      // Filter columns based on search value
      const filtered = (
        Object.values(columns || {}) as ModifiedColumn[]
      ).filter((column) =>
        getEntityName(column).toLowerCase().includes(value.toLowerCase())
      );
      setFilteredColumns(filtered);
    }
  };

  const handleShowMoreClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setShowAllColumns(true);
    setFilteredColumns(Object.values(columns));
  };

  const nodeLabel = useMemo(() => {
    if (isNewNode && !node) {
      return label;
    } else {
      return (
        <>
          <LineageNodeLabelV1 node={node} />
          {selected && isEditMode ? (
            <Button
              className="lineage-node-remove-btn bg-body-hover"
              icon={
                <SVGIcons
                  alt="times-circle"
                  icon="icon-times-circle"
                  width="16px"
                />
              }
              type="link"
              onClick={() => removeNodeHandler?.(props)}
            />
          ) : null}
        </>
      );
    }
  }, [node, isNewNode, label, selected, isEditMode]);

  useEffect(() => {
    updateNodeInternals(id);
    if (!isExpanded) {
      setShowAllColumns(false);
    } else if (!isEmpty(columns) && Object.values(columns).length < 5) {
      setShowAllColumns(true);
    }
  }, [isEditMode, isExpanded, columns]);

  useEffect(() => {
    if (!isEmpty(columns)) {
      setFilteredColumns(
        Object.values(columns).slice(0, 5) as ModifiedColumn[]
      );
    }
  }, [columns]);

  return (
    <div
      className={classNames(
        'lineage-node p-0',
        selected || data.selected
          ? 'custom-node-header-active'
          : 'custom-node-header-normal',
        { 'custom-node-header-tracing': isTraced }
      )}>
      {getHandle(
        node,
        type,
        isConnectable,
        lineageLeafNodes,
        isNodeLoading,
        'lineage-node-handle',
        onSelect,
        loadNodeHandler
      )}
      <div className="lineage-node-content">
        <div className="label-container bg-white">{nodeLabel}</div>

        {node && node.type === EntityType.TABLE && (
          <div className="column-container bg-grey-1 p-sm">
            <Button
              className="flex-center text-primary rounded-4"
              size="small"
              type="text"
              onClick={(e) => {
                e.stopPropagation();
                onNodeExpand?.(!isExpanded, node);
              }}>
              {t('label.column-plural')}
              {isExpanded ? (
                <UpOutlined style={{ fontSize: '12px' }} />
              ) : (
                <DownOutlined style={{ fontSize: '12px' }} />
              )}
            </Button>

            {isExpanded && (
              <div className="m-t-md">
                <div className="search-box">
                  <Input
                    placeholder={t('label.search-entity', {
                      entity: t('label.column-plural'),
                    })}
                    suffix={<SearchOutlined color={BORDER_COLOR} />}
                    value={searchValue}
                    onChange={handleSearchChange}
                  />
                </div>

                <section className="m-t-md" id="table-columns">
                  <div className="border rounded-4">
                    {filteredColumns.map((column) => {
                      const isColumnTraced = selectedColumns.includes(
                        column.fullyQualifiedName
                      );

                      return (
                        <div
                          className={classNames(
                            'custom-node-column-container',
                            isColumnTraced
                              ? 'custom-node-header-tracing'
                              : 'custom-node-column-lineage-normal bg-white'
                          )}
                          data-testid="column"
                          key={column.fullyQualifiedName}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleColumnClick(column.fullyQualifiedName);
                          }}>
                          {getColumnHandle(
                            column.type,
                            isConnectable,
                            'lineage-column-node-handle',
                            column.fullyQualifiedName
                          )}
                          {getConstraintIcon({ constraint: column.constraint })}
                          <p className="p-xss">{getEntityName(column)}</p>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {!showAllColumns && (
                  <Button
                    className="m-t-xs text-primary"
                    type="text"
                    onClick={handleShowMoreClick}>
                    {t('label.show-more-entity', {
                      entity: t('label.column-plural'),
                    })}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomNodeV1;
