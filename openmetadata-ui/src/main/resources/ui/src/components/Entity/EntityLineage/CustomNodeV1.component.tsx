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
import { focusToCoordinates } from '../../../utils/EntityLineageUtils';
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

  const {
    isEditMode,
    tracedNodes,
    selectedNode,
    onNodeCollapse,
    removeNodeHandler,
    loadChildNodesHandler,
    activeLayer,
    dataQualityLineage,
    nodes,
    newlyLoadedNodeIds,
    reactFlowInstance,
    zoomValue,
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

  const isColumnLayerEnabled = useMemo(
    () => activeLayer.includes(LineageLayer.ColumnLevelLineage),
    [activeLayer]
  );

  const [isChildrenListExpanded, setIsChildrenListExpanded] =
    useState(isColumnLayerEnabled);
  const toggleColumnsList = useCallback(() => {
    setIsChildrenListExpanded((prev) => !prev);
  }, []);

  const [
    isOnlyShowColumnsWithLineageFilterActive,
    setIsOnlyShowColumnsWithLineageFilterActive,
  ] = useState(false);

  const [isNodeExpanded, setIsNodeExpanded] = useState(false);

  const toggleOnlyShowColumnsWithLineageFilterActive = useCallback(() => {
    setIsOnlyShowColumnsWithLineageFilterActive((prev) => !prev);
  }, []);

  useEffect(() => {
    setIsChildrenListExpanded(isColumnLayerEnabled);
  }, [isColumnLayerEnabled]);

  useEffect(() => {
    setIsOnlyShowColumnsWithLineageFilterActive(
      isColumnLayerEnabled && !isEditMode
    );
  }, [isColumnLayerEnabled, isEditMode]);

  useEffect(() => {
    const newlyLoadedNodes = nodes.filter((node) =>
      newlyLoadedNodeIds.includes(node.id)
    );

    if (!isNodeExpanded || newlyLoadedNodes.length === 0) {
      return;
    }

    /**
     * When a node expands one level, new nodes load at the same vertical
     * position—they share the same x-coordinate but have different y-coordinates.
     * We can focus on the midpoint of all coordinates, which is the centroid.
     *
     * Though for a single level, x-coordinates are identical for all points,
     * but finding their center helps when users click expand-all.
     * In that case, nodes open to multiple levels.
     */

    const newPositionToFocus =
      newlyLoadedNodes.length > 0
        ? {
            x:
              newlyLoadedNodes.reduce(
                (sum, node) => sum + (node.position?.x ?? 0),
                0
              ) / newlyLoadedNodes.length,
            y:
              newlyLoadedNodes.reduce(
                (sum, node) => sum + (node.position?.y ?? 0),
                0
              ) / newlyLoadedNodes.length,
          }
        : { x: 0, y: 0 };

    focusToCoordinates(newPositionToFocus, reactFlowInstance, zoomValue);
    setIsNodeExpanded(false);
  }, [nodes, newlyLoadedNodeIds, isNodeExpanded, reactFlowInstance, zoomValue]);

  const containerClass = getNodeClassNames({
    isSelected,
    showDqTracing: showDqTracing ?? false,
    isTraced,
    isBaseNode: isRootNode,
    isChildrenListExpanded,
  });

  const onExpand = useCallback(
    (direction: LineageDirection, depth = 1) => {
      loadChildNodesHandler(node, direction, depth).then(() => {
        setIsNodeExpanded(true);
      });
    },
    [loadChildNodesHandler, node]
  );

  const onCollapse = useCallback(
    (direction = LineageDirection.Downstream) => {
      onNodeCollapse(props, direction);
      focusToCoordinates(
        { x: props.xPos, y: props.yPos },
        reactFlowInstance,
        zoomValue
      );
    },
    [onNodeCollapse, props, reactFlowInstance, zoomValue]
  );

  const nodeLabel = useMemo(() => {
    if (isNewNode) {
      return label;
    }

    return (
      <>
        <LineageNodeLabelV1
          isChildrenListExpanded={isChildrenListExpanded}
          isOnlyShowColumnsWithLineageFilterActive={
            isOnlyShowColumnsWithLineageFilterActive
          }
          node={node}
          toggleColumnsList={toggleColumnsList}
          toggleOnlyShowColumnsWithLineageFilterActive={
            toggleOnlyShowColumnsWithLineageFilterActive
          }
        />
        {isSelected && isEditMode && !isRootNode && (
          <LineageNodeRemoveButton onRemove={() => removeNodeHandler(props)} />
        )}
      </>
    );
  }, [
    isNewNode,
    label,
    isChildrenListExpanded,
    isOnlyShowColumnsWithLineageFilterActive,
    node,
    toggleColumnsList,
    toggleOnlyShowColumnsWithLineageFilterActive,
    isSelected,
    isEditMode,
    isRootNode,
    removeNodeHandler,
    props,
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
        <NodeHandles
          expandCollapseHandles={handlesElement}
          id={id}
          isConnectable={isConnectable}
          nodeType={nodeType}
        />
        <NodeChildren
          isChildrenListExpanded={isChildrenListExpanded}
          isConnectable={isConnectable}
          isOnlyShowColumnsWithLineageFilterActive={
            isOnlyShowColumnsWithLineageFilterActive
          }
          node={node}
        />
      </div>
    </div>
  );
};

export default memo(CustomNodeV1);
