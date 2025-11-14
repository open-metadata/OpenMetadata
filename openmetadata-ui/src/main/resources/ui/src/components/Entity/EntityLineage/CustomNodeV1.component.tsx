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

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Handle, NodeProps, Position } from 'reactflow';
import { useLineageProvider } from '../../../context/LineageProvider/LineageProvider';
import { EntityLineageNodeType } from '../../../enums/entity.enum';
import { LineageDirection } from '../../../generated/api/lineage/lineageDirection';
import { LineageLayer } from '../../../generated/configuration/lineageSettings';
import LineageNodeRemoveButton from '../../Lineage/LineageNodeRemoveButton';
import './custom-node.less';
import {
  getCollapseHandle,
  getExpandHandle,
  getNodeClassNames,
} from './CustomNode.utils';
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
    isDownstreamNode,
    isUpstreamNode,
    isRootNode,
    isCollapsed,
    upstreamLineageLength,
    paging,
    onCollapse,
    onExpand,
  }: ExpandCollapseHandlesProps) => {
    if (isEditMode) {
      return null;
    }

    const hasOutgoers = (paging?.entityDownstreamCount ?? 0) > 0;
    const hasIncomers = (paging?.entityUpstreamCount ?? 0) > 0;

    if (isRootNode) {
      return (
        <>
          {hasOutgoers &&
            getCollapseHandle(LineageDirection.Downstream, onCollapse)}

          {hasIncomers &&
            getCollapseHandle(LineageDirection.Upstream, () =>
              onCollapse(LineageDirection.Upstream)
            )}
        </>
      );
    } else if (isDownstreamNode) {
      if (hasOutgoers) {
        return (
          <>
            {getCollapseHandle(LineageDirection.Downstream, onCollapse)}
            {isCollapsed &&
              getExpandHandle(LineageDirection.Downstream, () =>
                onExpand(LineageDirection.Downstream)
              )}
          </>
        );
      }
    } else if (isUpstreamNode) {
      if (hasIncomers) {
        return (
          <>
            {getCollapseHandle(LineageDirection.Upstream, () =>
              onCollapse(LineageDirection.Upstream)
            )}
          </>
        );
      }

      return (
        <>
          {!isCollapsed &&
            upstreamLineageLength > 0 &&
            getExpandHandle(LineageDirection.Upstream, () =>
              onExpand(LineageDirection.Upstream)
            )}
        </>
      );
    }

    return null;
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
    isUpstreamNode = false,
    isDownstreamNode = false,
  } = data;

  const nodeType = isEditMode ? EntityLineageNodeType.DEFAULT : type;
  const isSelected = selectedNode === node;
  const { id, fullyQualifiedName, upstreamLineage = [], isCollapsed } = node;
  const [isTraced, setIsTraced] = useState(false);

  const showDqTracing = useMemo(
    () =>
      activeLayer.includes(LineageLayer.DataObservability) &&
      dataQualityLineage?.nodes?.some((dqNode) => dqNode.id === id),
    [activeLayer, dataQualityLineage, id]
  );

  const containerClass = getNodeClassNames({
    isSelected,
    showDqTracing: showDqTracing ?? false,
    isTraced,
    isBaseNode: isRootNode,
  });

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
    }

    return (
      <>
        <LineageNodeLabelV1 node={node} />
        {isSelected && isEditMode && !isRootNode && (
          <LineageNodeRemoveButton onRemove={() => removeNodeHandler(props)} />
        )}
      </>
    );
  }, [node.id, isNewNode, label, isSelected, isEditMode, isRootNode]);

  const expandCollapseProps = useMemo<ExpandCollapseHandlesProps>(
    () => ({
      isDownstreamNode,
      isEditMode,
      isRootNode,
      isUpstreamNode,
      nodeDepth: node.nodeDepth || 0,
      paging: node.paging,
      isCollapsed,
      upstreamLineageLength: upstreamLineage.length,
      onCollapse,
      onExpand,
    }),
    [
      isDownstreamNode,
      isEditMode,
      isRootNode,
      isUpstreamNode,
      upstreamLineage.length,
      onCollapse,
      onExpand,
      isCollapsed,
      node.paging,
      node.nodeDepth,
    ]
  );

  const handlesElement = useMemo(
    () => <ExpandCollapseHandles {...expandCollapseProps} />,
    [expandCollapseProps]
  );

  useEffect(() => {
    setIsTraced(tracedNodes.includes(id));
  }, [tracedNodes, id]);

  return (
    <div
      className={containerClass}
      data-testid={`lineage-node-${fullyQualifiedName}`}>
      <NodeHandles
        expandCollapseHandles={handlesElement}
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
