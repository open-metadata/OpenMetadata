/*
 *  Copyright 2023 Collate.
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
import { KeyboardArrowDown } from '@mui/icons-material';
import {
  Box,
  Button,
  Menu,
  MenuItem,
  Typography,
  useTheme,
} from '@mui/material';
import { find } from 'lodash';
import { FC, useMemo, useState } from 'react';
import { Column } from '../../../../generated/entity/data/container';
import { getEntityName } from '../../../../utils/EntityUtils';

interface ColumnPickerMenuProps {
  activeColumnFqn: string;
  columns: Column[];
  handleChange: (key: string) => void;
}

const ColumnPickerMenu: FC<ColumnPickerMenuProps> = ({
  activeColumnFqn,
  columns,
  handleChange,
}) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const selectedItem = useMemo(() => {
    return find(
      columns,
      (column: Column) => column.fullyQualifiedName === activeColumnFqn
    );
  }, [activeColumnFqn, columns]);

  const handleMenuClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleOptionClick = (key: string) => {
    handleChange(key);
    handleMenuClose();
  };

  return (
    <Box data-testid="column-picker-menu">
      <Button
        data-testid="column-picker-menu-button"
        endIcon={<KeyboardArrowDown />}
        size="small"
        sx={{
          color: theme.palette.grey[900],
          fontWeight: 600,
          fontSize: theme.typography.pxToRem(12),
          height: '32px',
          textTransform: 'none',
          boxShadow: 'none',
          border: `1px solid ${theme.palette.grey[200]}`,
          '&:hover': {
            border: `1px solid ${theme.palette.grey[200]}`,
            boxShadow: 'none',
          },
        }}
        variant="outlined"
        onClick={handleMenuClick}>
        {getEntityName(selectedItem)}
      </Button>
      <Menu
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        open={open}
        sx={{
          '.MuiPaper-root': {
            maxHeight: '350px',
            width: 'max-content',
            minWidth: '200px',
          },
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        onClose={handleMenuClose}>
        {columns.map((column) => {
          const isSelected = column.fullyQualifiedName === activeColumnFqn;

          return (
            <MenuItem
              data-testid={`column-picker-menu-item-${column.fullyQualifiedName}`}
              key={column.fullyQualifiedName}
              selected={isSelected}
              sx={{
                '&.Mui-selected': {
                  backgroundColor: theme.palette.primary.main,
                  color: theme.palette.primary.contrastText,
                  '&:hover': {
                    backgroundColor: theme.palette.primary.dark,
                  },
                },
              }}
              onClick={() =>
                handleOptionClick(column.fullyQualifiedName || '')
              }>
              <Box alignItems="center" display="flex" gap={1}>
                <Typography
                  sx={{
                    color: 'inherit',
                    fontSize: theme.typography.pxToRem(14),
                  }}>
                  {getEntityName(column)}
                </Typography>
                <Typography
                  sx={{
                    color: isSelected
                      ? theme.palette.primary.contrastText
                      : theme.palette.grey[600],
                    fontSize: theme.typography.pxToRem(12),
                    opacity: isSelected ? 0.9 : 1,
                  }}>{`(${column.dataType})`}</Typography>
              </Box>
            </MenuItem>
          );
        })}
      </Menu>
    </Box>
  );
};

export default ColumnPickerMenu;
