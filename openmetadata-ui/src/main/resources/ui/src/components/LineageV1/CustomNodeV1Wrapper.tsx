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

import { Button } from 'antd';
import classNames from 'classnames';
import { memo, useCallback, useMemo, useState } from 'react';
import { Handle, Node as ReactFlowNode, NodeProps, Position } from 'reactflow';
import { ReactComponent as MinusIcon } from '../../assets/svg/control-minus.svg';
import { ReactComponent as PlusIcon } from '../../assets/svg/plus-outlined.svg';
import { useLineageActions } from '../../context/LineageV1/hooks/useLineageActions';
import { useLineageUI } from '../../context/LineageV1/hooks/useLineageUI';
import { EntityLineageNodeType } from '../../enums/entity.enum';
import { LineageDirection } from '../../generated/api/lineage/lineageDirection';
import '../Entity/EntityLineage/custom-node.less';
import { getNodeClassNames } from '../Entity/EntityLineage/CustomNode.utils';
import '../Entity/EntityLineage/entity-lineage.style.less';
import {
  ExpandCollapseHandlesProps,
  NodeHandlesProps,
} from '../Entity/EntityLineage/EntityLineage.interface';
import LineageNodeLabelV1Wrapper from './LineageNodeLabelV1Wrapper';
import LineageNodeRemoveButtonV1 from './LineageNodeRemoveButtonV1';
import NodeChildrenV1 from './NodeChildrenV1';

// Helper functions for expand/collapse handles
const getExpandHandle = ({
  direction,
  hasIncomers,
  hasOutgoers,
  upstreamLineageLength,
  onClick,
}: {
  direction: LineageDirection;
  hasIncomers?: boolean;
  hasOutgoers?: boolean;
  upstreamLineageLength?: number;
  onClick: () => void;
}) => {
  // Don't show expand handle if there are already connections
  if (direction === LineageDirection.Upstream && hasIncomers) {
    return null;
  }
  if (direction === LineageDirection.Downstream && hasOutgoers) {
    return null;
  }
  // Don't show expand handle if there's no data to expand
  if (
    direction === LineageDirection.Upstream &&
    (!upstreamLineageLength || upstreamLineageLength === 0)
  ) {
    return null;
  }

  return (
    <Button
      className={classNames(
        'absolute lineage-node-handle flex-center',
        direction === LineageDirection.Downstream
          ? 'react-flow__handle-right'
          : 'react-flow__handle-left'
      )}
      icon={
        <PlusIcon className="lineage-expand-icon" data-testid="plus-icon" />
      }
      shape="circle"
      size="small"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    />
  );
};

const getCollapseHandle = ({
  direction,
  isRootNode,
  hasIncomers,
  hasOutgoers,
  isUpstreamNode,
  isDownstreamNode,
  onClick,
}: {
  direction: LineageDirection;
  isRootNode?: boolean;
  hasIncomers?: boolean;
  hasOutgoers?: boolean;
  isUpstreamNode?: boolean;
  isDownstreamNode?: boolean;
  onClick: () => void;
}) => {
  // Only show collapse handle if node has connections and is either root or matches direction
  if (direction === LineageDirection.Upstream) {
    if (!hasIncomers || (!isRootNode && !isUpstreamNode)) {
      return null;
    }
  } else {
    if (!hasOutgoers || (!isRootNode && !isDownstreamNode)) {
      return null;
    }
  }

  return (
    <Button
      className={classNames(
        'absolute lineage-node-minus lineage-node-handle flex-center',
        direction === LineageDirection.Downstream
          ? 'react-flow__handle-right'
          : 'react-flow__handle-left'
      )}
      data-testid={
        direction === LineageDirection.Downstream
          ? 'downstream-collapse-handle'
          : 'upstream-collapse-handle'
      }
      icon={
        <MinusIcon className="lineage-expand-icon" data-testid="minus-icon" />
      }
      shape="circle"
      size="small"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    />
  );
};

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
    isRootNode,
    upstreamExpandPerformed,
    downstreamExpandPerformed,
    hasIncomers,
    hasOutgoers,
    isUpstreamNode,
    isDownstreamNode,
    upstreamLineageLength,
    onExpand,
    onCollapse,
  }: ExpandCollapseHandlesProps) => {
    const upstreamCollapseHandle = useMemo(
      () =>
        getCollapseHandle({
          direction: LineageDirection.Upstream,
          isRootNode,
          hasIncomers,
          isUpstreamNode,
          onClick: () => onCollapse(LineageDirection.Upstream),
        }),
      [
        isRootNode,
        upstreamExpandPerformed,
        hasIncomers,
        isUpstreamNode,
        onCollapse,
      ]
    );

    const downstreamCollapseHandle = useMemo(
      () =>
        getCollapseHandle({
          direction: LineageDirection.Downstream,
          isRootNode,
          hasOutgoers,
          isDownstreamNode,
          onClick: () => onCollapse(LineageDirection.Downstream),
        }),
      [
        isRootNode,
        downstreamExpandPerformed,
        hasOutgoers,
        isDownstreamNode,
        onCollapse,
      ]
    );

    const upstreamExpandHandle = useMemo(
      () =>
        getExpandHandle({
          upstreamLineageLength,
          direction: LineageDirection.Upstream,
          hasIncomers,
          onClick: () => onExpand(LineageDirection.Upstream),
        }),
      [upstreamLineageLength, hasIncomers, isUpstreamNode, onExpand]
    );

    const downstreamExpandHandle = useMemo(
      () =>
        getExpandHandle({
          direction: LineageDirection.Downstream,
          hasOutgoers,
          onClick: () => onExpand(LineageDirection.Downstream),
        }),
      [hasOutgoers, isDownstreamNode, onExpand]
    );

    if (isEditMode) {
      return null;
    }

    return (
      <>
        {upstreamCollapseHandle}
        {downstreamCollapseHandle}
        {upstreamExpandHandle}
        {downstreamExpandHandle}
      </>
    );
  }
);

const CustomNodeV1Wrapper = (props: NodeProps) => {
  const { type, id, isConnectable = false, data } = props;
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

  // Use new LineageV1 hooks
  const { selectedNode, isEditMode } = useLineageUI();
  const {
    onNodeClick,
    removeNodeHandler,
    onNodeCollapse,
    loadChildNodesHandler,
  } = useLineageActions();

  const [upstreamExpandPerformed, setUpstreamExpandPerformed] = useState(false);
  const [downstreamExpandPerformed, setDownstreamExpandPerformed] =
    useState(false);

  const nodeType = isEditMode ? EntityLineageNodeType.DEFAULT : type;
  const isSelected = selectedNode === node;
  const { fullyQualifiedName, upstreamLineage = [] } = node;

  const onExpand = useCallback(
    (direction = LineageDirection.Downstream) => {
      if (direction === LineageDirection.Upstream) {
        setUpstreamExpandPerformed(true);
      } else {
        setDownstreamExpandPerformed(true);
      }
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
    }

    return (
      <>
        <LineageNodeLabelV1Wrapper node={node} />
        {isSelected && isEditMode && !isRootNode && (
          <LineageNodeRemoveButtonV1
            onRemove={() => removeNodeHandler(props)}
          />
        )}
      </>
    );
  }, [node.id, isNewNode, label, isSelected, isEditMode, isRootNode]);

  const expandCollapseProps = useMemo<ExpandCollapseHandlesProps>(
    () => ({
      upstreamExpandPerformed,
      downstreamExpandPerformed,
      hasIncomers,
      hasOutgoers,
      isDownstreamNode,
      isEditMode,
      isRootNode,
      isUpstreamNode,
      upstreamLineageLength: upstreamLineage.length,
      onCollapse,
      onExpand,
    }),
    [
      upstreamExpandPerformed,
      downstreamExpandPerformed,
      hasIncomers,
      hasOutgoers,
      isDownstreamNode,
      isEditMode,
      isRootNode,
      isUpstreamNode,
      upstreamLineage.length,
      onCollapse,
      onExpand,
    ]
  );

  const nodeClasses = useMemo(
    () =>
      getNodeClassNames({
        isSelected,
        showDqTracing: false,
        isTraced: false,
        isBaseNode: isRootNode,
      }),
    [isSelected, isRootNode]
  );

  return (
    <div
      className={nodeClasses}
      data-testid={`lineage-node-${fullyQualifiedName}`}
      role="button"
      tabIndex={0}
      onClick={() =>
        !isNewNode &&
        onNodeClick({
          ...props,
          position: { x: 0, y: 0 },
        } as ReactFlowNode)
      }
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !isNewNode) {
          e.preventDefault();
          onNodeClick({
            ...props,
            position: { x: 0, y: 0 },
          } as ReactFlowNode);
        }
      }}>
      <NodeHandles
        expandCollapseHandles={
          <ExpandCollapseHandles {...expandCollapseProps} />
        }
        id={id}
        isConnectable={isConnectable}
        nodeType={nodeType as EntityLineageNodeType}
      />
      <div className="lineage-node-content">
        <div className="label-container bg-white">{nodeLabel}</div>
        <NodeChildrenV1 isConnectable={isConnectable} node={node} />
      </div>
    </div>
  );
};

export default memo(CustomNodeV1Wrapper);
