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
import {
  IconButton,
  IconButtonProps,
  styled,
  ToggleButtonGroup,
  ToggleButtonGroupProps,
} from '@mui/material';
import type { MenuProps } from '@mui/material/Menu';
import Menu from '@mui/material/Menu';

export const StyledMenu = styled((props: MenuProps) => <Menu {...props} />)(
  ({ theme }) => ({
    '& .MuiPaper-root': {
      width: 'auto',
      '& .MuiMenu-list': {
        padding: '0',
      },
      '& .MuiMenuItem-root': {
        margin: '0',
        padding: '10px 16px',
        borderRadius: '0px',
        '& svg': {
          height: 24,
          marginRight: theme.spacing(1.5),
        },
        '&:active': {
          backgroundColor: theme.palette.allShades.blue[25],
        },
        '&.Mui-selected': {
          backgroundColor: theme.palette.allShades.blue[25],
          color: theme.palette.allShades.blue[700],
        },
        '&:hover': {
          backgroundColor: theme.palette.allShades.blue[25],
        },
      },
    },
  })
);

export const StyledToggleButtonGroup = styled(
  (props: ToggleButtonGroupProps) => <ToggleButtonGroup {...props} />
)(({ theme }) => ({
  '.MuiToggleButton-root': {
    padding: theme.spacing(2, 4),
    '&.Mui-selected': {
      outlineColor: theme.palette.allShades.blue[700],
      backgroundColor: theme.palette.allShades.blue[50],
      color: theme.palette.allShades.blue[700],

      '.MuiChip-root': {
        color: theme.palette.allShades.blue[700],
        backgroundColor: theme.palette.allShades.blue[100],
      },
      '&:hover': {
        backgroundColor: theme.palette.allShades.blue[100],
      },
    },
    '&:hover': {
      outlineColor: theme.palette.allShades.blue[100],
      backgroundColor: theme.palette.allShades.blue[100],
      color: theme.palette.allShades.blue[700],
    },
    color: theme.palette.allShades.gray[700],
    '.MuiChip-root': {
      marginLeft: theme.spacing(1.5),
      border: 'none',
      borderRadius: theme.spacing(4),
      backgroundColor: theme.palette.allShades.gray[100],
    },
  },
}));

export const StyledIconButton = styled((props: IconButtonProps) => (
  <IconButton {...props} />
))(({ theme }) => ({
  padding: '11px 8px',
  '& svg': {
    height: 18,
    color: theme.palette.allShades.gray[500],
  },
  boxShadow: 'none',
  outline: '1px solid',
  outlineColor: theme.palette.allShades.gray[300],
  backgroundColor: theme.palette.allShades.gray[50],

  '&.MuiIconButton-colorPrimary': {
    outline: '1px solid',
    outlineColor: theme.palette.allShades.blue[700],
    backgroundColor: theme.palette.allShades.blue[50],

    '& svg': {
      color: theme.palette.allShades.blue[700],
    },
  },
}));
