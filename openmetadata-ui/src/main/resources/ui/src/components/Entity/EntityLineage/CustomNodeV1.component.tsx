/* eslint-disable i18next/no-literal-string */
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
import { useTranslation } from 'react-i18next';
import { Handle, NodeProps, Position } from 'reactflow';
import { useLineageProvider } from '../../../context/LineageProvider/LineageProvider';
import { EntityLineageNodeType } from '../../../enums/entity.enum';
import { LineageDirection } from '../../../generated/api/lineage/lineageDirection';
import { LineageLayer } from '../../../generated/configuration/lineageSettings';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import DownloadIcon from '@mui/icons-material/SaveAlt';

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
import { Divider, IconButton, Menu, MenuItem } from '@mui/material';

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
          getExpandHandle(LineageDirection.Downstream, () =>
            onExpand(LineageDirection.Downstream)
          )}

        {hasIncomers &&
          (isUpstreamNode || isRootNode) &&
          getCollapseHandle(LineageDirection.Upstream, () =>
            onCollapse(LineageDirection.Upstream)
          )}

        {!hasIncomers &&
          !upstreamExpandPerformed &&
          upstreamLineageLength > 0 &&
          getExpandHandle(LineageDirection.Upstream, () =>
            onExpand(LineageDirection.Upstream)
          )}
      </>
    );
  }
);

const MeatballMenu = () => {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <div className="manage-node">
      <IconButton
        aria-controls={open ? 'menu' : undefined}
        aria-haspopup="true"
        aria-label="more options"
        onClick={(e) => {
          e.stopPropagation();
          setAnchorEl(e.currentTarget);
        }}>
        <MoreVertIcon sx={{ pointerEvents: 'none' }} />
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        className="manage-node-menu"
        id="menu"
        open={open}
        sx={{
          '.MuiPaper-root': {
            width: 'max-content',
            marginLeft: '6px',
            marginTop: 0,
            '.MuiMenuItem-root': {
              fontWeight: 400,
              svg: {
                fontSize: 20,
              },
            },
          },
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        onClick={(e) => {
          e.stopPropagation();
        }}
        onClose={() => setAnchorEl(null)}>
        <MenuItem onClick={handleClose}>
          <ArrowBackIcon />
          Edit Upstream
        </MenuItem>
        <MenuItem onClick={handleClose}>
          <ArrowForwardIcon />
          Edit DownStream
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleClose}>
          <TrendingDownIcon />
          View Impact
        </MenuItem>
        <MenuItem onClick={handleClose}>
          <DownloadIcon /> Download Impact
        </MenuItem>
      </Menu>
    </div>
  );
};
const CustomNodeV1 = (props: NodeProps) => {
  const { data, type, isConnectable } = props;
  const { t } = useTranslation();

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
      <MeatballMenu />
    </div>
  );
};

export default memo(CustomNodeV1);
