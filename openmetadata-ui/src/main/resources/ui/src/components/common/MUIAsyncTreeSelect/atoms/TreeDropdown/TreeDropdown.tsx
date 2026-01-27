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

import { ClickAwayListener, Paper, Popper } from '@mui/material';
import React, { FC, memo, ReactNode } from 'react';

export interface TreeDropdownProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  children: ReactNode;
  maxHeight?: number;
  minWidth?: number;
  borderColor?: string;
  onClickAway: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
}

const TreeDropdown: FC<TreeDropdownProps> = ({
  open,
  anchorEl,
  children,
  maxHeight = 300,
  minWidth,
  borderColor = 'divider',
  onClickAway,
  onMouseDown,
}) => {
  const handleClickAway = (event: MouseEvent | TouchEvent) => {
    // Don't close if clicking within the dropdown itself
    const target = event.target as Node;
    const dropdownElement = (event as any).currentTarget;
    if (dropdownElement && dropdownElement.contains(target)) {
      return;
    }
    onClickAway();
  };

  return (
    <Popper
      anchorEl={anchorEl}
      open={open}
      placement="bottom-start"
      style={{ zIndex: 1300 }}>
      <ClickAwayListener onClickAway={handleClickAway}>
        <Paper
          elevation={0}
          sx={{
            mt: 1,
            maxHeight,
            overflow: 'auto',
            minWidth: minWidth || anchorEl?.clientWidth || 200,
            border: 1,
            borderColor,
            boxShadow:
              '0px 12px 16px -4px rgba(10, 13, 18, 0.08), 0px 4px 6px -2px rgba(10, 13, 18, 0.03)',
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={onMouseDown}>
          {children}
        </Paper>
      </ClickAwayListener>
    </Popper>
  );
};

export default memo(TreeDropdown);
