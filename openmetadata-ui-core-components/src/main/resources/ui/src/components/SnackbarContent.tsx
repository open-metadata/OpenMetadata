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

import { MaterialDesignContent } from 'notistack';
import { styled } from '@mui/material/styles';

export const SnackbarContent = styled(MaterialDesignContent)(({ theme }) => ({
  // Base styles matching MuiAlert from data-display-theme.ts
  '&.notistack-MuiContent': {
    backgroundColor: theme.palette.background.paper || '#FFFFFF',
    border: `1px solid ${theme.palette.grey?.[300] || '#D2D4DB'}`,
    color: theme.palette.text.primary || '#181D27',
    borderRadius: '12px',
    boxShadow: '0px 1px 2px rgba(10, 13, 18, 0.05)',
    fontSize: '0.875rem',
    padding: '12px 16px',
    fontFamily: 'var(--font-inter, "Inter"), -apple-system, "Segoe UI", Roboto, Arial, sans-serif',

    // Override default notistack styles
    '& .notistack-MuiContent-message': {
      padding: 0,
      fontWeight: 400,
      lineHeight: '1.25rem',
    },
  },

  // Variant-specific border colors
  '&.notistack-MuiContent-error': {
    backgroundColor: theme.palette.background.paper || '#FFFFFF',
    borderColor: theme.palette.error.light || '#F79E9E',
    color: theme.palette.text.primary || '#181D27',
  },
  '&.notistack-MuiContent-success': {
    backgroundColor: theme.palette.background.paper || '#FFFFFF',
    borderColor: theme.palette.success.light || '#83D2A3',
    color: theme.palette.text.primary || '#181D27',
  },
  '&.notistack-MuiContent-warning': {
    backgroundColor: theme.palette.background.paper || '#FFFFFF',
    borderColor: theme.palette.warning.light || '#FFBE7F',
    color: theme.palette.text.primary || '#181D27',
  },
  '&.notistack-MuiContent-info': {
    backgroundColor: theme.palette.background.paper || '#FFFFFF',
    borderColor: theme.palette.info.light || '#7BAEFF',
    color: theme.palette.text.primary || '#181D27',
  },
  '&.notistack-MuiContent-default': {
    backgroundColor: theme.palette.background.paper || '#FFFFFF',
    borderColor: theme.palette.grey?.[300] || '#D2D4DB',
    color: theme.palette.text.primary || '#181D27',
  },
}));