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

import { TreeItem } from '@mui/x-tree-view';
import React, { FC, memo, ReactNode } from 'react';
import { TreeNode } from '../../../atoms/asyncTreeSelect/types';
import { TreeNodeLabel } from '../TreeNodeLabel';

export interface TreeNodeItemProps {
  node: TreeNode;
  depth?: number;
  isSelected: boolean;
  isLoading: boolean;
  isFocused: boolean;
  showCheckbox: boolean;
  showIcon: boolean;
  multiple: boolean;
  disabled: boolean;
  renderNode?: (node: TreeNode, isSelected: boolean) => ReactNode;
  onNodeClick: (node: TreeNode) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  renderChildren: () => ReactNode;
}

const TreeNodeItem: FC<TreeNodeItemProps> = ({
  node,
  depth = 0,
  isSelected,
  isLoading,
  isFocused,
  showCheckbox,
  showIcon,
  multiple,
  disabled,
  renderNode,
  onNodeClick,
  onMouseDown,
  renderChildren,
}) => {
  return (
    <TreeItem
      itemId={node.id}
      label={
        renderNode ? (
          renderNode(node, isSelected)
        ) : (
          <TreeNodeLabel
            depth={depth}
            disabled={disabled || node.disabled || false}
            isLoading={isLoading}
            isSelected={isSelected}
            multiple={multiple}
            node={node}
            showCheckbox={showCheckbox}
            showIcon={showIcon}
            onMouseDown={onMouseDown}
            onNodeClick={onNodeClick}
          />
        )
      }
      sx={{
        '& > .MuiTreeItem-content': {
          py: 0,
          minHeight: 32,
          backgroundColor: isFocused ? 'action.hover' : 'transparent',
          borderRadius: 0.5,
          '&:focus': {
            outline: 'none',
            backgroundColor: isFocused ? 'action.hover' : 'transparent',
          },
          '&:hover': {
            backgroundColor: 'action.hover',
          },
        },
        '& > .MuiTreeItem-content .MuiTreeItem-label': {
          p: 0,
          width: '100%',
          backgroundColor: 'transparent',
        },
      }}
      onMouseDown={onMouseDown}>
      {renderChildren()}
    </TreeItem>
  );
};

export default memo(TreeNodeItem);
