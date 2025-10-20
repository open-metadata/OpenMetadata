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

import { Theme } from '@mui/material';

/**
 * Reusable container styles for Domain-related pages
 * Provides consistent styling with white background, border, and nested element overrides
 *
 * @param theme - MUI theme object for accessing palette colors
 * @returns SxProps object for MUI Box component
 */
export const getDomainContainerStyles = (theme: Theme) => ({
  backgroundColor: 'background.paper',
  border: '1px solid',
  borderColor: theme.palette.allShades?.blueGray?.[100],
  borderRadius: 1.5,
  marginBottom: 5,
  '& .grid-container': {
    background: 'none',
    paddingRight: '1px',
  },
  '& .resizable-panels-layout': {
    background: 'none !important',
  },
  '& .custom-properties-card': {
    border: 'none',
    padding: 0,
  },
  '& .assets-tab-container': {
    border: '1px solid',
    borderColor: theme.palette.allShades?.blueGray?.[100],
  },
  '& .grid-container > #KnowledgePanel\\.LeftPanel': {
    border: 'none',
    padding: 0,
  },
  '& .entity-header-title': {
    alignItems: 'center',
  },
  '& .entity-header-name': {
    fontSize: '20px',
    lineHeight: '30px',
  },
  '& .entity-header-display-name': {
    fontSize: '14px !important',
    lineHeight: '20px !important',
  },
  '& .ant-btn.entity-follow-button': {
    padding: '2px 4px',
  },
  '& .entity-follow-button svg': {
    width: '12px',
  },
  '& .entity-follow-button > .ant-typography': {
    fontSize: '12px',
    lineHeight: '18px',
  },
  '& .copy-button svg': {
    width: '14px',
  },
  '& .left-panel-documentation-tab > .ant-card:first-child': {
    border: 'none',
  },
  '& .left-panel-documentation-tab > .ant-card:first-child > .ant-card-body:first-child':
    {
      padding: 0,
    },
  '& .right-panel-documentation-tab > .ant-card:first-child': {
    border: 'none',
  },
  '& .right-panel-documentation-tab > .ant-card:first-child > .ant-card-body:first-child':
    {
      padding: '0 0 0 18px',
    },
});
