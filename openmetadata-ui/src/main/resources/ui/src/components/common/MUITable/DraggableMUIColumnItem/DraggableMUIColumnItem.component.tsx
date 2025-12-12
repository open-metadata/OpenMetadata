/*
 *  Copyright 2025 Collate.
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
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { Box, IconButton, MenuItem, Typography } from '@mui/material';
import { useCallback, useMemo } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { ReactComponent as ColumnDragIcon } from '../../../../assets/svg/menu-duo.svg';
import { DraggableMUIColumnItemProps } from './DraggableMUIColumnItem.interface';

const DraggableMUIColumnItem: React.FC<DraggableMUIColumnItemProps> = ({
  currentItem,
  index,
  itemList,
  selectedOptions,
  onSelect,
  onMoveItem,
}) => {
  const { value, label } = currentItem;
  const moveDropdownMenuItem = useCallback(
    (fromIndex: number, toIndex: number) => {
      const updatedList = [...itemList];
      const [movedItem] = updatedList.splice(fromIndex, 1);
      updatedList.splice(toIndex, 0, movedItem);
      onMoveItem(updatedList);
    },
    [itemList, onMoveItem]
  );

  const [{ isDragging }, drag] = useDrag({
    type: 'CHECKBOX',
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: 'CHECKBOX',
    hover: (draggedItem: { index: number }) => {
      if (draggedItem.index !== index) {
        moveDropdownMenuItem(draggedItem.index, index);
        draggedItem.index = index;
      }
    },
  });

  const isItemSelected = useMemo(
    () => selectedOptions.includes(value),
    [selectedOptions, value]
  );

  return (
    <MenuItem
      ref={(node) => {
        drag(drop(node));
      }}
      sx={{
        opacity: isDragging ? 0.5 : 1,
        cursor: 'move',
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 2,
        py: 1,
      }}
      onClick={() => onSelect(value, !isItemSelected)}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          minWidth: 16,
        }}>
        <ColumnDragIcon
          data-testid="draggable-menu-item-drag-icon"
          height={16}
          style={{ color: 'rgba(0, 0, 0, 0.54)' }}
          width={16}
        />
      </Box>
      <Typography
        sx={{
          flex: 1,
          fontSize: '0.875rem',
        }}>
        {label}
      </Typography>
      <IconButton edge="end" size="small" sx={{ p: 0 }}>
        {isItemSelected ? (
          <VisibilityIcon fontSize="small" />
        ) : (
          <VisibilityOffIcon fontSize="small" />
        )}
      </IconButton>
    </MenuItem>
  );
};

export default DraggableMUIColumnItem;
