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

import { Button, Tooltip } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Handle, NodeProps, Position } from 'reactflow';
import { ReactComponent as ZoomInIcon } from '../../../assets/svg/ic-zoom-in.svg';
import { NODE_WIDTH } from '../../../constants/Lineage.constants';
import { EntityLineageNodeType } from '../../../enums/entity.enum';
import { LineageDirection } from '../../../generated/api/lineage/lineageDirection';
import {
  LineageBand,
  LineageSceneNode,
} from '../../../generated/api/lineage/lineageScene';
import { useLineageStore } from '../../../hooks/useLineageStore';
import { useLineageHandlers } from '../../Lineage/Lineage/LineageHandlersContext';
import LineageNodeMenu from '../../Lineage/LineageNodeMenu/LineageNodeMenu';
import './custom-node.less';
import {
  getCollapseHandle,
  getExpandHandle,
  getNodeClassNames,
} from './CustomNode.utils';
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

const getHandleVisibility = ({
  hasOutgoers,
  hasIncomers,
  isDownstreamNode,
  isUpstreamNode,
  isRootNode,
  upstreamExpandPerformed,
  downstreamExpandPerformed,
  upstreamLineageLength,
}: ExpandCollapseHandlesProps) => ({
  showDownstreamCollapse: hasOutgoers && (isDownstreamNode || isRootNode),
  showDownstreamExpand: !hasOutgoers && !downstreamExpandPerformed,
  showUpstreamCollapse: hasIncomers && (isUpstreamNode || isRootNode),
  showUpstreamExpand:
    !hasIncomers && !upstreamExpandPerformed && upstreamLineageLength > 0,
});

const ExpandCollapseHandles = memo((props: ExpandCollapseHandlesProps) => {
  const { onCollapse, onExpand } = props;

  const {
    showDownstreamCollapse,
    showDownstreamExpand,
    showUpstreamCollapse,
    showUpstreamExpand,
  } = getHandleVisibility(props);

  return (
    <>
      {showDownstreamCollapse &&
        getCollapseHandle(LineageDirection.Downstream, onCollapse)}

      {showDownstreamExpand &&
        getExpandHandle(LineageDirection.Downstream, (depth = 1) =>
          onExpand(LineageDirection.Downstream, depth)
        )}

      {showUpstreamCollapse &&
        getCollapseHandle(LineageDirection.Upstream, () =>
          onCollapse(LineageDirection.Upstream)
        )}

      {showUpstreamExpand &&
        getExpandHandle(LineageDirection.Upstream, (depth = 1) =>
          onExpand(LineageDirection.Upstream, depth)
        )}
    </>
  );
});

const SceneDrillButton = ({
  node,
  label,
  onDrill,
}: {
  node?: LineageSceneNode;
  label?: string;
  onDrill?: (node: LineageSceneNode) => void;
}) => {
  const { t } = useTranslation();
  if (!node?.isExpandable || !onDrill) {
    return null;
  }
  const drillLabel = label || t('label.zoom-in');

  return (
    <Tooltip title={drillLabel}>
      <Button
        aria-label={drillLabel}
        // Less paints the static light brand tint (@primary-1) in every state.
        className="lineage-scene-drill-button nodrag nopan tw:dark:bg-brand-primary!"
        color="tertiary"
        iconLeading={ZoomInIcon}
        size="sm"
        onClick={(event: MouseEvent<HTMLButtonElement>) => {
          event.stopPropagation();
          onDrill(node);
        }}
      />
    </Tooltip>
  );
};

const CustomNodeV1 = (props: NodeProps) => {
  const { data, type, isConnectable } = props;

  const { onNodeCollapse, loadChildNodesHandler } = useLineageHandlers();
  const dataQualityLineage = useLineageStore((s) => s.dataQualityLineage);

  const {
    tracedNodes,
    selectedNode,
    isColumnLevelLineage,
    isDQEnabled,
    nodeFilterState,
    setNodeFilterState,
  } = useLineageStore();

  const [columnsExpanded, setColumnsExpanded] = useState<boolean>();

  const {
    label,
    isNewNode,
    node = {},
    isRootNode,
    hasOutgoers = false,
    hasIncomers = false,
    isUpstreamNode = false,
    isDownstreamNode = false,
    sceneNode,
    sceneBand,
    nodeWidth = NODE_WIDTH,
    onSceneDrill,
    onSceneNodeSelect,
    sceneDrillLabel,
    onSceneColumnHover,
    onSceneColumnSelect,
    onSceneNodeRemove,
    isNodeRemovable = true,
    isNodeEditable,
    onSceneLineageEdit,
  } = data;

  // sync expand state based on column layer active
  useEffect(() => {
    setColumnsExpanded(isColumnLevelLineage);
  }, [isColumnLevelLineage]);

  const toggleColumnsExpanded = useCallback(() => {
    setColumnsExpanded((prev) => !prev);
  }, []);

  const nodeType = type;
  const isSelected = useMemo(() => selectedNode === node, [selectedNode, node]);
  const {
    id,
    fullyQualifiedName,
    upstreamLineage = [],
    upstreamExpandPerformed = false,
    downstreamExpandPerformed = false,
    nodeDepth,
  } = node;

  const showColumnsWithLineageOnly = useMemo(
    () => nodeFilterState.get(node.id) ?? false,
    [nodeFilterState, node.id]
  );

  useEffect(() => {
    if (isColumnLevelLineage) {
      setNodeFilterState(node.id, true);
    }

    // reset on unmount
    return () => {
      setNodeFilterState(node.id, false);
    };
  }, [isColumnLevelLineage, node.id, setNodeFilterState]);

  const showDqTracing = useMemo(
    () =>
      isDQEnabled &&
      dataQualityLineage?.nodes?.some((dqNode) => dqNode.id === id),
    [isDQEnabled, dataQualityLineage, id]
  );

  const containerClass = classNames(
    getNodeClassNames({
      isSelected,
      showDqTracing: Boolean(showDqTracing),
      isTraced: tracedNodes.has(id),
      isBaseNode: isRootNode,
      isChildrenListExpanded: columnsExpanded || isColumnLevelLineage,
    }),
    {
      'lineage-scene-node': Boolean(sceneNode),
      'lineage-scene-layer-node tw:bg-surface':
        Boolean(sceneNode) && sceneBand === LineageBand.Layer,
    }
  );
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

  const toggleShowColumnsWithLineageOnly = useCallback(() => {
    if (!node.id) {
      return;
    }
    setNodeFilterState(node.id, !showColumnsWithLineageOnly);
  }, [showColumnsWithLineageOnly, setNodeFilterState, node.id]);

  const handleEntityClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      onSceneNodeSelect?.(props.id);
    },
    [onSceneNodeSelect, props.id]
  );

  const nodeLabel = useMemo(() => {
    if (isNewNode) {
      return label;
    }

    return (
      <>
        <div className="tw:min-w-0 tw:flex-1">
          <LineageNodeLabelV1
            isChildrenListExpanded={columnsExpanded}
            isOnlyShowColumnsWithLineageFilterActive={
              showColumnsWithLineageOnly
            }
            node={node}
            toggleColumnsList={toggleColumnsExpanded}
            toggleOnlyShowColumnsWithLineageFilterActive={
              toggleShowColumnsWithLineageOnly
            }
            onEntityClick={onSceneNodeSelect ? handleEntityClick : undefined}
          />
        </div>
        {isNodeEditable && onSceneLineageEdit && (
          <LineageNodeMenu
            canDelete={Boolean(isNodeRemovable) && !isRootNode}
            onDelete={() => onSceneNodeRemove?.(props)}
            onEdit={(direction, triggerRef) =>
              onSceneLineageEdit({ nodeId: props.id, direction, triggerRef })
            }
          />
        )}
      </>
    );
  }, [
    node,
    onSceneNodeSelect,
    handleEntityClick,
    isNewNode,
    label,
    columnsExpanded,
    showColumnsWithLineageOnly,
    toggleShowColumnsWithLineageOnly,
    toggleColumnsExpanded,
    isNodeEditable,
    onSceneLineageEdit,
    isNodeRemovable,
    isRootNode,
    onSceneNodeRemove,
    props,
  ]);

  const expandCollapseProps = useMemo<ExpandCollapseHandlesProps>(
    () => ({
      upstreamExpandPerformed,
      downstreamExpandPerformed,
      hasIncomers,
      hasOutgoers,
      isDownstreamNode,
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

  const childElement = useMemo(() => {
    if (!columnsExpanded) {
      return null;
    }

    return (
      <NodeChildren
        isChildrenListExpanded={columnsExpanded}
        isConnectable={isConnectable}
        isOnlyShowColumnsWithLineageFilterActive={showColumnsWithLineageOnly}
        node={node}
        onColumnHover={onSceneColumnHover}
        onColumnSelect={onSceneColumnSelect}
      />
    );
  }, [
    columnsExpanded,
    isConnectable,
    node,
    onSceneColumnHover,
    onSceneColumnSelect,
    showColumnsWithLineageOnly,
  ]);

  return (
    <div
      className={containerClass}
      data-nodedepth={nodeDepth}
      data-testid={`lineage-node-${fullyQualifiedName}`}
      style={{ width: nodeWidth }}>
      {isRootNode && (
        <div className="lineage-node-badge-container tw:bg-surface">
          <div className="lineage-node-badge" />
        </div>
      )}
      <div className="lineage-node-content">
        <SceneDrillButton
          label={sceneDrillLabel}
          node={sceneNode}
          onDrill={onSceneDrill}
        />
        <div className="label-container tw:flex tw:items-start tw:justify-between tw:bg-surface">
          {nodeLabel}
        </div>
        <NodeHandles
          expandCollapseHandles={handlesElement}
          id={id}
          isConnectable={isConnectable}
          nodeType={nodeType}
        />
        {childElement}
      </div>
    </div>
  );
};

export default memo(CustomNodeV1);
