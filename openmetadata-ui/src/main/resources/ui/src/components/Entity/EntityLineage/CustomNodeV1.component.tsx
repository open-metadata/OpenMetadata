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
    hasOutgoers,
    hasIncomers,
    isDownstreamNode,
    isUpstreamNode,
    isRootNode,
    upstreamExpandPerformed,
    downstreamExpandPerformed,
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
          !downstreamExpandPerformed &&
          getExpandHandle(LineageDirection.Downstream, (depth = 1) =>
            onExpand(LineageDirection.Downstream, depth)
          )}

        {hasIncomers &&
          (isUpstreamNode || isRootNode) &&
          getCollapseHandle(LineageDirection.Upstream, () =>
            onCollapse(LineageDirection.Upstream)
          )}

        {!hasIncomers &&
          !upstreamExpandPerformed &&
          upstreamLineageLength > 0 &&
          getExpandHandle(LineageDirection.Upstream, (depth = 1) =>
            onExpand(LineageDirection.Upstream, depth)
          )}
      </>
    );
  }
);

const CustomNodeV1 = (props: NodeProps) => {
  const { data, type, isConnectable } = props;
  const [isColumnsListExpanded, setIsColumnsListExpanded] = useState(false);
  const toggleColumnsList = useCallback(() => {
    setIsColumnsListExpanded((prev) => !prev);
  }, []);

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
    upstreamExpandPerformed = false,
    downstreamExpandPerformed = false,
  } = node;
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
    isColumnsListExpanded,
  });

  const onExpand = useCallback(
    (direction: LineageDirection, depth = 1) => {
      loadChildNodesHandler(node, direction, depth);
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
        <LineageNodeLabelV1
          isColumnsListExpanded={isColumnsListExpanded}
          node={node}
          toggleColumnsList={toggleColumnsList}
        />
        {isSelected && isEditMode && !isRootNode && (
          <LineageNodeRemoveButton onRemove={() => removeNodeHandler(props)} />
        )}
      </>
    );
  }, [
    node.id,
    isNewNode,
    label,
    isSelected,
    isEditMode,
    isRootNode,
    isColumnsListExpanded,
  ]);

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
      {isRootNode && (
        <div className="lineage-node-badge-container">
          <div className="lineage-node-badge" />
        </div>
      )}
      <div className="lineage-node-content">
        <div className="label-container bg-white">{nodeLabel}</div>
        <NodeChildren
          isColumnsListExpanded={isColumnsListExpanded}
          isConnectable={isConnectable}
          node={node}
        />
      </div>
      <NodeHandles
        expandCollapseHandles={handlesElement}
        id={id}
        isConnectable={isConnectable}
        nodeType={nodeType}
      />
    </div>
  );
};

export default memo(CustomNodeV1);
