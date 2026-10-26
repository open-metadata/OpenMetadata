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

import { Box, Button, Tooltip } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
  type RefObject,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Handle, NodeProps, Position, useReactFlow } from 'reactflow';
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
import { isContainerSceneNode } from '../../Lineage/LineageMap/LineageMap.utils';
import LineageNodeMenu from '../../Lineage/LineageNodeMenu/LineageNodeMenu';
import './custom-node.less';
import { BASE_NODE_FILL_CLASS } from './CustomNode.constants';
import {
  getCollapseHandle,
  getExpandHandle,
  getNodeClassNames,
  hasBaseNodeFill,
} from './CustomNode.utils';
import {
  ExpandCollapseHandlesProps,
  NodeHandlesProps,
} from './EntityLineage.interface';
import LineageNodeLabelV1 from './LineageNodeLabelV1';
import NodeChildren from './NodeChildren/NodeChildren.component';

// Scene nodes open through onSceneNodeSelect; classic nodes open the drawer,
// except temp tables, which have no entity page.
const canOpenNodeEntity = (
  hasSceneSelect: boolean,
  isSceneNode: boolean,
  isTempTable: boolean
) => hasSceneSelect || (!isSceneNode && !isTempTable);

const NodeHandles = memo(
  ({
    nodeType,
    id,
    showEdgeHandles,
    expandCollapseHandles,
  }: NodeHandlesProps) => {
    if (nodeType === EntityLineageNodeType.NOT_CONNECTED) {
      return null;
    }
    // Lineage is added from the node menus, so these only mark where the
    // classic graph's edges meet the node; the expand / collapse buttons sit
    // over them. Scene map nodes draw no handles.
    const showTarget =
      showEdgeHandles && nodeType !== EntityLineageNodeType.INPUT;
    const showSource =
      showEdgeHandles && nodeType !== EntityLineageNodeType.OUTPUT;

    return (
      <>
        {showTarget && (
          <Handle
            className="lineage-node-handle"
            id={id}
            isConnectable={false}
            position={Position.Left}
            type="target"
          />
        )}
        {showSource && (
          <Handle
            className="lineage-node-handle"
            id={id}
            isConnectable={false}
            position={Position.Right}
            type="source"
          />
        )}
        {expandCollapseHandles}
      </>
    );
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
  const { data, type } = props;

  const { onNodeCollapse, loadChildNodesHandler, onNodeClick } =
    useLineageHandlers();
  const { getNode } = useReactFlow();
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
    onSceneShowFields,
  } = data;

  // sync expand state based on column layer active
  useEffect(() => {
    setColumnsExpanded(isColumnLevelLineage);
  }, [isColumnLevelLineage]);

  // The Asset band has no field list to expand, so asking for a node's fields
  // moves the scene to the Field band instead.
  const toggleColumnsExpanded = useCallback(() => {
    if (sceneBand === LineageBand.Asset && onSceneShowFields) {
      onSceneShowFields();

      return;
    }
    setColumnsExpanded((prev) => !prev);
  }, [onSceneShowFields, sceneBand]);

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

  const badgeClass = classNames('lineage-node-badge-container', {
    [BASE_NODE_FILL_CLASS]: hasBaseNodeFill({
      isBaseNode: isRootNode,
      isSelected,
    }),
  });

  const containerClass = classNames(
    getNodeClassNames({
      isSelected,
      showDqTracing: Boolean(showDqTracing),
      isTraced: tracedNodes.has(id),
      isBaseNode: isRootNode,
      isChildrenListExpanded: columnsExpanded || isColumnLevelLineage,
    }),
    {
      'lineage-temp-node': Boolean(node.isTempTable),
      'lineage-scene-node': Boolean(sceneNode),
      // Container nodes (service, database, schema, domain, data product) use
      // the container card, with its centred drill cue, in every band.
      'lineage-scene-layer-node tw:bg-raised':
        Boolean(sceneNode) &&
        (sceneBand === LineageBand.Layer || isContainerSceneNode(sceneNode)),
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

  const handleColumnLineageEdit = useCallback(
    (
      columnFqn: string,
      direction: LineageDirection,
      triggerRef: RefObject<HTMLElement>
    ) => {
      onSceneLineageEdit?.({
        nodeId: props.id,
        columnFqn,
        direction,
        triggerRef,
      });
    },
    [onSceneLineageEdit, props.id]
  );

  const onColumnLineageEdit =
    isNodeEditable && onSceneLineageEdit ? handleColumnLineageEdit : undefined;
  const hasLineageNodeMenu = Boolean(isNodeEditable && onSceneLineageEdit);

  const handleEntityClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (onSceneNodeSelect) {
        onSceneNodeSelect(props.id);

        return;
      }
      // Classic asset lineage: the name opens the same drawer as a node click.
      const flowNode = getNode(props.id);
      if (flowNode) {
        onNodeClick(flowNode);
      }
    },
    [getNode, onNodeClick, onSceneNodeSelect, props.id]
  );
  const canOpenEntity = canOpenNodeEntity(
    Boolean(onSceneNodeSelect),
    Boolean(sceneNode),
    Boolean(node.isTempTable)
  );

  const nodeLabel = useMemo(() => {
    return (
      <LineageNodeLabelV1
        actions={
          isNodeEditable && onSceneLineageEdit ? (
            <LineageNodeMenu
              canDelete={Boolean(isNodeRemovable) && !isRootNode}
              onDelete={() => onSceneNodeRemove?.(props)}
              onEdit={(direction, triggerRef) =>
                onSceneLineageEdit({ nodeId: props.id, direction, triggerRef })
              }
            />
          ) : undefined
        }
        isChildrenListExpanded={columnsExpanded}
        isOnlyShowColumnsWithLineageFilterActive={showColumnsWithLineageOnly}
        node={node}
        titleColor={isRootNode ? 'link-primary' : undefined}
        toggleColumnsList={toggleColumnsExpanded}
        toggleOnlyShowColumnsWithLineageFilterActive={
          toggleShowColumnsWithLineageOnly
        }
        onEntityClick={canOpenEntity ? handleEntityClick : undefined}
      />
    );
  }, [
    node,
    onSceneNodeSelect,
    handleEntityClick,
    canOpenEntity,
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
        isOnlyShowColumnsWithLineageFilterActive={showColumnsWithLineageOnly}
        node={node}
        onColumnHover={onSceneColumnHover}
        onColumnLineageEdit={onColumnLineageEdit}
        onColumnSelect={onSceneColumnSelect}
      />
    );
  }, [
    columnsExpanded,
    node,
    onColumnLineageEdit,
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
        <div className={badgeClass}>
          <div className="lineage-node-badge" />
        </div>
      )}
      <div
        className={classNames('lineage-node-content', {
          'has-lineage-node-menu': hasLineageNodeMenu,
          'has-scene-drill-button': Boolean(
            sceneNode?.isExpandable && onSceneDrill
          ),
        })}>
        <SceneDrillButton
          label={sceneDrillLabel}
          node={sceneNode}
          onDrill={onSceneDrill}
        />
        <Box
          align="start"
          className="label-container tw:bg-raised"
          justify="between">
          {nodeLabel}
        </Box>
        <NodeHandles
          expandCollapseHandles={handlesElement}
          id={id}
          nodeType={nodeType}
          showEdgeHandles={!sceneNode}
        />
        {childElement}
      </div>
    </div>
  );
};

export default memo(CustomNodeV1);
