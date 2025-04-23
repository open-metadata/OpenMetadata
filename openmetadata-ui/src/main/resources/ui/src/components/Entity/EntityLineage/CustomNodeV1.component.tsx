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

import classNames from 'classnames';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Handle, NodeProps, Position } from 'reactflow';
import { useLineageProvider } from '../../../context/LineageProvider/LineageProvider';
import { EntityLineageNodeType } from '../../../enums/entity.enum';
import { LineageDirection } from '../../../generated/api/lineage/lineageDirection';
import { LineageLayer } from '../../../generated/configuration/lineageSettings';
import LineageNodeRemoveButton from '../../Lineage/LineageNodeRemoveButton';
import './custom-node.less';
import { getCollapseHandle, getExpandHandle } from './CustomNode.utils';
import './entity-lineage.style.less';
import {
  ExpandCollapseHandlesProps,
  NodeHandlesProps,
} from './EntityLineage.interface';
import LineageNodeLabelV1 from './LineageNodeLabelV1';
import NodeChildren from './NodeChildren/NodeChildren.component';

const NodeHandles = memo(
  ({
    nodeType,
    id,
    isConnectable,
    expandCollapseHandles,
  }: NodeHandlesProps) => {
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
            {expandCollapseHandles}
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
            {expandCollapseHandles}
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
            {expandCollapseHandles}
          </>
        );
    }
  }
);

const ExpandCollapseHandles = memo(
  ({
    isEditMode,
    hasOutgoers,
    hasIncomers,
    isDownstreamNode,
    isUpstreamNode,
    isRootNode,
    expandPerformed,
    upstreamLineageLength,
    onCollapse,
    onExpand,
  }: ExpandCollapseHandlesProps) => {
    if (isEditMode) {
      return null;
    }

    return (
      <>
        {hasOutgoers &&
          (isDownstreamNode || isRootNode) &&
          getCollapseHandle(LineageDirection.Downstream, onCollapse)}
        {!hasOutgoers &&
          !expandPerformed &&
          getExpandHandle(LineageDirection.Downstream, () =>
            onExpand(LineageDirection.Downstream)
          )}
        {hasIncomers &&
          (isUpstreamNode || isRootNode) &&
          getCollapseHandle(LineageDirection.Upstream, () =>
            onCollapse(LineageDirection.Upstream)
          )}
        {!hasIncomers &&
          !expandPerformed &&
          upstreamLineageLength > 0 &&
          getExpandHandle(LineageDirection.Upstream, () =>
            onExpand(LineageDirection.Upstream)
          )}
      </>
    );
  }
);

const CustomNodeV1 = (props: NodeProps) => {
  const { data, type, isConnectable } = props;

  const {
    isEditMode,
    tracedNodes,
    selectedNode,
    onNodeCollapse,
    removeNodeHandler,
    loadChildNodesHandler,
    activeLayer,
    dataQualityLineage,
  } = useLineageProvider();

  const {
    label,
    isNewNode,
    node = {},
    isRootNode,
    hasOutgoers = false,
    hasIncomers = false,
    isUpstreamNode = false,
    isDownstreamNode = false,
  } = data;

  const nodeType = isEditMode ? EntityLineageNodeType.DEFAULT : type;
  const isSelected = selectedNode === node;
  const {
    id,
    fullyQualifiedName,
    upstreamLineage = [],
    expandPerformed = false,
  } = node;
  const [isTraced, setIsTraced] = useState<boolean>(false);

  const showDqTracing = useMemo(() => {
    return (
      (activeLayer.includes(LineageLayer.DataObservability) &&
        dataQualityLineage?.nodes?.some((dqNode) => dqNode.id === id)) ??
      false
    );
  }, [activeLayer, dataQualityLineage, id]);

  const onExpand = useCallback(
    (direction: LineageDirection) => {
      loadChildNodesHandler(node, direction);
    },
    [loadChildNodesHandler, node]
  );

  const onCollapse = useCallback(
    (direction = LineageDirection.Downstream) => {
      onNodeCollapse(props, direction);
    },
    [onNodeCollapse, props]
  );

  const nodeLabel = useMemo(() => {
    if (isNewNode) {
      return label;
    } else {
      return (
        <>
          <LineageNodeLabelV1 node={node} />
          {isSelected && isEditMode && !isRootNode ? (
            <LineageNodeRemoveButton
              onRemove={() => removeNodeHandler(props)}
            />
          ) : null}
        </>
      );
    }
  }, [node.id, isNewNode, label, isSelected, isEditMode]);

  useEffect(() => {
    setIsTraced(tracedNodes.includes(id));
  }, [tracedNodes, id]);

  return (
    <div
      className={classNames(
        'lineage-node p-0',
        isSelected ? 'custom-node-header-active' : 'custom-node-header-normal',
        {
          'data-quality-failed-custom-node-header': showDqTracing,
        },
        { 'custom-node-header-tracing': isTraced }
      )}
      data-testid={`lineage-node-${fullyQualifiedName}`}>
      <NodeHandles
        expandCollapseHandles={
          <ExpandCollapseHandles
            expandPerformed={expandPerformed}
            hasIncomers={hasIncomers}
            hasOutgoers={hasOutgoers}
            isDownstreamNode={isDownstreamNode}
            isEditMode={isEditMode}
            isRootNode={isRootNode}
            isUpstreamNode={isUpstreamNode}
            upstreamLineageLength={upstreamLineage.length}
            onCollapse={onCollapse}
            onExpand={onExpand}
          />
        }
        id={id}
        isConnectable={isConnectable}
        nodeType={nodeType}
      />
      <div className="lineage-node-content">
        <div className="label-container bg-white">{nodeLabel}</div>
        <NodeChildren isConnectable={isConnectable} node={node} />
      </div>
    </div>
  );
};

export default memo(CustomNodeV1);
