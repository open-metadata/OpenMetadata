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
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getIncomers,
  getOutgoers,
  Handle,
  NodeProps,
  Position,
  useUpdateNodeInternals,
} from 'reactflow';
import { ReactComponent as MinusIcon } from '../../../assets/svg/control-minus.svg';
import { ReactComponent as PlusIcon } from '../../../assets/svg/plus-outlined.svg';
import { BORDER_COLOR } from '../../../constants/constants';
import { EntityLineageNodeType, EntityType } from '../../../enums/entity.enum';
import { formTwoDigitNumber } from '../../../utils/CommonUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { checkUpstreamDownstream } from '../../../utils/LineageV1Utils';
import SVGIcons from '../../../utils/SvgUtils';
import { getConstraintIcon, getEntityIcon } from '../../../utils/TableUtils';
import { useLineageProvider } from '../../LineageProvider/LineageProvider';
import './custom-node.less';
import { getColumnHandle } from './CustomNode.utils';
import './entity-lineage.style.less';
import { EdgeTypeEnum, ModifiedColumn } from './EntityLineage.interface';
import LineageNodeLabelV1 from './LineageNodeLabelV1';

const CustomNodeV1 = (props: NodeProps) => {
  const { t } = useTranslation();
  const updateNodeInternals = useUpdateNodeInternals();
  const { data, type, isConnectable } = props;

  const {
    isEditMode,
    expandedNodes,
    tracedNodes,
    tracedColumns,
    selectedNode,
    nodes,
    edges,
    onColumnClick,
    onNodeCollapse,
    removeNodeHandler,
    loadChildNodesHandler,
  } = useLineageProvider();

  /* eslint-disable-next-line */
  const { label, isNewNode, node = {} } = data;
  const nodeType = isEditMode ? EntityLineageNodeType.DEFAULT : type;

  const isSelected = selectedNode === node;
  const { columns, id, testSuite, lineage } = node;
  const [searchValue, setSearchValue] = useState('');
  const [filteredColumns, setFilteredColumns] = useState<ModifiedColumn[]>([]);
  const [showAllColumns, setShowAllColumns] = useState(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isTraced, setIsTraced] = useState<boolean>(false);

  const { hasDownstream, hasUpstream } = useMemo(() => {
    return checkUpstreamDownstream(id, lineage ?? []);
  }, [id, lineage]);

  const hasOutgoers = useMemo(() => {
    const outgoers = getOutgoers(node, nodes, edges);

    return outgoers.length > 0;
  }, [node, nodes, edges]);

  const { isUpstreamLeafNode, isDownstreamLeafNode } = useMemo(() => {
    return {
      isUpstreamLeafNode:
        getIncomers(node, nodes, edges).length === 0 && hasUpstream,
      isDownstreamLeafNode:
        getOutgoers(node, nodes, edges).length === 0 && hasDownstream,
    };
  }, [node, nodes, edges]);

  const supportsColumns = useMemo(() => {
    if (node && node.entityType === EntityType.TABLE) {
      return true;
    }

    return false;
  }, [node]);

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
    setFilteredColumns(Object.values(columns ?? []));
  };

  const nodeLabel = useMemo(() => {
    if (isNewNode) {
      return label;
    } else {
      return (
        <>
          <LineageNodeLabelV1 node={node} />
          {isSelected && isEditMode ? (
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
  }, [node, isNewNode, label, isSelected, isEditMode]);

  const getHandle = useCallback(() => {
    switch (nodeType) {
      case EntityLineageNodeType.OUTPUT:
        return (
          <>
            <Handle
              className="lineage-node-handle"
              id={id}
              isConnectable={isConnectable}
              position={Position.Left}
              type="target"
            />
            {isDownstreamLeafNode && !isEditMode && (
              <Button
                className="absolute lineage-node-handle flex-center react-flow__handle-right"
                icon={<PlusIcon className="lineage-expand-icon" />}
                shape="circle"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  loadChildNodesHandler(node, EdgeTypeEnum.DOWN_STREAM);
                }}
              />
            )}
            {hasOutgoers && !isEditMode && (
              <Button
                className="absolute lineage-node-minus lineage-node-handle flex-center react-flow__handle-right"
                icon={<MinusIcon className="lineage-expand-icon" />}
                shape="circle"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onNodeCollapse(props, EdgeTypeEnum.DOWN_STREAM);
                }}
              />
            )}
          </>
        );

      case EntityLineageNodeType.INPUT:
        return (
          <>
            {isUpstreamLeafNode && !isEditMode && (
              <Button
                className="absolute lineage-node-handle flex-center react-flow__handle-left"
                icon={<PlusIcon className="lineage-expand-icon" />}
                shape="circle"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  loadChildNodesHandler(node, EdgeTypeEnum.UP_STREAM);
                }}
              />
            )}
            <Handle
              className="lineage-node-handle"
              id={id}
              isConnectable={isConnectable}
              position={Position.Right}
              type="source"
            />
            {hasOutgoers && !isEditMode && (
              <Button
                className="absolute lineage-node-minus lineage-node-handle flex-center react-flow__handle-right"
                icon={<MinusIcon className="lineage-expand-icon" />}
                shape="circle"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onNodeCollapse(props, EdgeTypeEnum.DOWN_STREAM);
                }}
              />
            )}
          </>
        );

      case EntityLineageNodeType.NOT_CONNECTED:
        return null;

      default:
        return (
          <>
            <Handle
              className="lineage-node-handle"
              id={id}
              isConnectable={isConnectable}
              position={Position.Left}
              type="target"
            />
            <Handle
              className="lineage-node-handle"
              id={id}
              isConnectable={isConnectable}
              position={Position.Right}
              type="source"
            />
            {hasOutgoers && !isEditMode && (
              <Button
                className="absolute lineage-node-minus lineage-node-handle flex-center react-flow__handle-right"
                icon={<MinusIcon className="lineage-expand-icon" />}
                shape="circle"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onNodeCollapse(props, EdgeTypeEnum.DOWN_STREAM);
                }}
              />
            )}

            {isDownstreamLeafNode && !isEditMode && (
              <Button
                className="absolute lineage-node-handle flex-center react-flow__handle-right"
                icon={<PlusIcon className="lineage-expand-icon" />}
                shape="circle"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  loadChildNodesHandler(node, EdgeTypeEnum.DOWN_STREAM);
                }}
              />
            )}
          </>
        );
    }
  }, [
    node,
    nodeType,
    isConnectable,
    isDownstreamLeafNode,
    isUpstreamLeafNode,
    loadChildNodesHandler,
  ]);

  useEffect(() => {
    setIsExpanded(expandedNodes.includes(id));
  }, [expandedNodes, id]);

  useEffect(() => {
    setIsTraced(tracedNodes.includes(id));
  }, [tracedNodes, id]);

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
        isSelected ? 'custom-node-header-active' : 'custom-node-header-normal',
        { 'custom-node-header-tracing': isTraced }
      )}>
      {getHandle()}
      <div className="lineage-node-content">
        <div className="label-container bg-white">{nodeLabel}</div>

        {supportsColumns && (
          <div className="column-container bg-grey-1 p-sm p-y-xs">
            <div className="d-flex justify-between items-center">
              <Button
                className="flex-center text-primary rounded-4 p-xss"
                icon={
                  <div className="d-flex w-5 h-5 m-r-xs text-base-color">
                    {getEntityIcon(node.entityType || '')}
                  </div>
                }
                type="text"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded((prevIsExpanded: boolean) => !prevIsExpanded);
                }}>
                {t('label.column-plural')}
                {isExpanded ? (
                  <UpOutlined style={{ fontSize: '12px' }} />
                ) : (
                  <DownOutlined style={{ fontSize: '12px' }} />
                )}
              </Button>
              {node.entityType === EntityType.TABLE && testSuite && (
                <div className="d-flex justify-between">
                  <div
                    className="profiler-item green"
                    data-testid="test-passed">
                    <div
                      className="font-medium"
                      data-testid="test-passed-value">
                      {formTwoDigitNumber(testSuite?.summary?.success ?? 0)}
                    </div>
                  </div>
                  <div
                    className="profiler-item amber"
                    data-testid="test-aborted">
                    <div
                      className="font-medium"
                      data-testid="test-aborted-value">
                      {formTwoDigitNumber(testSuite?.summary?.aborted ?? 0)}
                    </div>
                  </div>
                  <div className="profiler-item red" data-testid="test-failed">
                    <div
                      className="font-medium"
                      data-testid="test-failed-value">
                      {formTwoDigitNumber(testSuite?.summary?.failed ?? 0)}
                    </div>
                  </div>
                </div>
              )}
            </div>

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
                      const isColumnTraced = tracedColumns.includes(
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
                            onColumnClick(column.fullyQualifiedName);
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

export default memo(CustomNodeV1);
