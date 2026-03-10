/*
 *  Copyright 2026 Collate.
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
import { IconButton, IconButtonProps, styled } from '@mui/material';

export const StyledIconButton = styled((props: IconButtonProps) => (
  <IconButton {...props} />
))(({ theme }) => ({
  '&.MuiButtonBase-root': {
    padding: theme.spacing(1),
    // borderRadius: '6px',
    background: theme.palette.allShades.gray[100],
    color: '#535862',

    '& svg': {
      height: '20px',
      width: '20px',
    },

    '&.MuiButtonBase-root-MuiIconButton-root': {
      '&:hover': {
        backgroundColor: theme.palette.allShades.gray[200] + ' !important',
      },
    },

    '&.Mui-disabled': {
      background: theme.palette.allShades.gray[100] + ' !important',
      pointerEvents: 'none',
      color: '#D5D7DA',
    },
    '&:active': {
      backgroundColor: theme.palette.allShades.gray[200],
    },
    '&.Mui-selected': {
      backgroundColor: theme.palette.allShades.gray[200],
      color: theme.palette.allShades.blue[700],
    },
    '&:hover': {
      backgroundColor: theme.palette.allShades.gray[200],
    },
  },
}));
