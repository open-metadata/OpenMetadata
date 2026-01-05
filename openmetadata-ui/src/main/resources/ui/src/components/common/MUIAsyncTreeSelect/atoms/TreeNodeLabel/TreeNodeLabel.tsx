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

import { Box, Checkbox, CircularProgress, Typography } from '@mui/material';
import React, { FC, memo } from 'react';
import { TreeNode } from '../../../atoms/asyncTreeSelect/types';

export interface TreeNodeLabelProps {
  node: TreeNode;
  depth: number;
  isSelected: boolean;
  isLoading: boolean;
  showCheckbox: boolean;
  showIcon: boolean;
  multiple: boolean;
  disabled: boolean;
  onNodeClick: (node: TreeNode) => void;
  onMouseDown: (e: React.MouseEvent) => void;
}

const TreeNodeLabel: FC<TreeNodeLabelProps> = ({
  node,
  depth,
  isSelected,
  isLoading,
  showCheckbox,
  showIcon,
  multiple,
  disabled,
  onNodeClick,
  onMouseDown,
}) => {
  return (
    <Box
      data-nodeid={node.id}
      sx={{
        display: 'flex',
        alignItems: 'center',
        py: 0.5,
        pl: depth * 2,
        pr: 1,
        width: '100%',
        cursor: 'pointer',
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (node.allowSelection !== false && !disabled) {
          onNodeClick(node);
        }
      }}
      onMouseDown={onMouseDown}>
      {showCheckbox && multiple && node.allowSelection !== false && (
        <Checkbox
          checked={isSelected}
          disabled={disabled || node.disabled}
          sx={{ p: 0.5, mr: 1.5 }}
          onChange={(e) => {
            e.stopPropagation();
            onNodeClick(node);
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            onMouseDown(e);
          }}
        />
      )}
      {node.icon && showIcon && (
        <Box sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
          {node.icon}
        </Box>
      )}
      <Typography
        sx={{
          color: node.disabled ? 'text.disabled' : 'text.primary',
          fontWeight: isSelected ? 'medium' : 'normal',
        }}
        variant="body2">
        {node.label}
      </Typography>
      {isLoading && <CircularProgress size={16} sx={{ ml: 1 }} thickness={2} />}
    </Box>
  );
};

export default memo(TreeNodeLabel);
