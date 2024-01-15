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
import { BORDER_COLOR } from '../../../constants/constants';
import { EntityLineageNodeType, EntityType } from '../../../enums/entity.enum';
import { formTwoDigitNumber } from '../../../utils/CommonUtils';
import { checkUpstreamDownstream } from '../../../utils/EntityLineageUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import SVGIcons from '../../../utils/SvgUtils';
import { getConstraintIcon, getEntityIcon } from '../../../utils/TableUtils';
import { useLineageProvider } from '../../LineageProvider/LineageProvider';
import './custom-node.less';
import {
  getCollapseHandle,
  getColumnHandle,
  getExpandHandle,
} from './CustomNode.utils';
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
    upstreamDownstreamData,
    onColumnClick,
    onNodeCollapse,
    removeNodeHandler,
    loadChildNodesHandler,
  } = useLineageProvider();

  const { label, isNewNode, node = {}, isRootNode } = data;
  const nodeType = isEditMode ? EntityLineageNodeType.DEFAULT : type;
  const isSelected = selectedNode === node;
  const { columns, id, testSuite, lineage, fullyQualifiedName } = node;
  const [searchValue, setSearchValue] = useState('');
  const [filteredColumns, setFilteredColumns] = useState<ModifiedColumn[]>([]);
  const [showAllColumns, setShowAllColumns] = useState(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isTraced, setIsTraced] = useState<boolean>(false);

  const getActiveNode = useCallback(
    (nodeId) => {
      return nodes.find((item) => item.id === nodeId);
    },
    [id, nodes]
  );

  const { hasDownstream, hasUpstream } = useMemo(() => {
    return checkUpstreamDownstream(id, lineage ?? []);
  }, [id, lineage]);

  const { hasOutgoers, hasIncomers, isUpstreamLeafNode, isDownstreamLeafNode } =
    useMemo(() => {
      const activeNode = getActiveNode(id);
      if (!activeNode) {
        return {
          hasOutgoers: false,
          hasIncomers: false,
          isUpstreamLeafNode: false,
          isDownstreamLeafNode: false,
        };
      }
      const outgoers = getOutgoers(activeNode, nodes, edges);
      const incomers = getIncomers(activeNode, nodes, edges);

      return {
        hasOutgoers: outgoers.length > 0,
        hasIncomers: incomers.length > 0,
        isUpstreamLeafNode: incomers.length === 0 && hasUpstream,
        isDownstreamLeafNode: outgoers.length === 0 && hasDownstream,
      };
    }, [id, nodes, edges, hasUpstream, hasDownstream]);

  const supportsColumns = useMemo(() => {
    if (node && node.entityType === EntityType.TABLE) {
      return true;
    }

    return false;
  }, [node]);

  const { isUpstreamNode, isDownstreamNode } = useMemo(() => {
    return {
      isUpstreamNode: upstreamDownstreamData.upstreamNodes.some(
        (item) => item.fullyQualifiedName === fullyQualifiedName
      ),
      isDownstreamNode: upstreamDownstreamData.downstreamNodes.some(
        (item) => item.fullyQualifiedName === fullyQualifiedName
      ),
    };
  }, [fullyQualifiedName, upstreamDownstreamData]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
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
    },
    [columns]
  );

  const handleShowMoreClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      setShowAllColumns(true);
      setFilteredColumns(Object.values(columns ?? []));
    },
    []
  );

  const onExpand = useCallback(
    (direction: EdgeTypeEnum) => {
      loadChildNodesHandler(node, direction);
    },
    [loadChildNodesHandler, node]
  );

  const onCollapse = useCallback(
    (direction = EdgeTypeEnum.DOWN_STREAM) => {
      onNodeCollapse(props, direction);
    },
    [loadChildNodesHandler, props]
  );

  const nodeLabel = useMemo(() => {
    if (isNewNode) {
      return label;
    } else {
      return (
        <>
          <LineageNodeLabelV1 node={node} />
          {isSelected && isEditMode && !isRootNode ? (
            <Button
              className="lineage-node-remove-btn bg-body-hover"
              data-testid="lineage-node-remove-btn"
              icon={
                <SVGIcons
                  alt="times-circle"
                  icon="icon-times-circle"
                  width="16px"
                />
              }
              type="link"
              onClick={() => removeNodeHandler(props)}
            />
          ) : null}
        </>
      );
    }
  }, [node, isNewNode, label, isSelected, isEditMode]);

  const getExpandCollapseHandles = useCallback(() => {
    if (isEditMode) {
      return null;
    }

    return (
      <>
        {hasOutgoers &&
          (isDownstreamNode || isRootNode) &&
          getCollapseHandle(EdgeTypeEnum.DOWN_STREAM, onCollapse)}
        {isDownstreamLeafNode &&
          (isDownstreamNode || isRootNode) &&
          getExpandHandle(EdgeTypeEnum.DOWN_STREAM, () =>
            onExpand(EdgeTypeEnum.DOWN_STREAM)
          )}
        {hasIncomers &&
          (isUpstreamNode || isRootNode) &&
          getCollapseHandle(EdgeTypeEnum.UP_STREAM, () =>
            onCollapse(EdgeTypeEnum.UP_STREAM)
          )}
        {isUpstreamLeafNode &&
          (isUpstreamNode || isRootNode) &&
          getExpandHandle(EdgeTypeEnum.UP_STREAM, () =>
            onExpand(EdgeTypeEnum.UP_STREAM)
          )}
      </>
    );
  }, [
    node,
    nodes,
    edges,
    hasOutgoers,
    hasIncomers,
    isUpstreamLeafNode,
    isDownstreamLeafNode,
    isUpstreamNode,
    isDownstreamNode,
    isEditMode,
    isRootNode,
  ]);

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
            {getExpandCollapseHandles()}
          </>
        );

      case EntityLineageNodeType.INPUT:
        return (
          <>
            <Handle
              className="lineage-node-handle"
              id={id}
              isConnectable={isConnectable}
              position={Position.Right}
              type="source"
            />
            {getExpandCollapseHandles()}
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
            {getExpandCollapseHandles()}
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
      )}
      data-testid={`lineage-node-${fullyQualifiedName}`}>
      {getHandle()}
      <div className="lineage-node-content">
        <div className="label-container bg-white">{nodeLabel}</div>
        {supportsColumns && (
          <div className="column-container bg-grey-1 p-sm p-y-xs">
            <div className="d-flex justify-between items-center">
              <Button
                className="flex-center text-primary rounded-4 p-xss"
                data-testid="expand-cols-btn"
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
                        column.fullyQualifiedName ?? ''
                      );

                      return (
                        <div
                          className={classNames(
                            'custom-node-column-container',
                            isColumnTraced
                              ? 'custom-node-header-tracing'
                              : 'custom-node-column-lineage-normal bg-white'
                          )}
                          data-testid={`column-${column.fullyQualifiedName}`}
                          key={column.fullyQualifiedName}
                          onClick={(e) => {
                            e.stopPropagation();
                            onColumnClick(column.fullyQualifiedName ?? '');
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
                    data-testid="show-more-cols-btn"
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
