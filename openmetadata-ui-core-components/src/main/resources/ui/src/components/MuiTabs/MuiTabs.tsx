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

import { Tab, Tabs as MuiTabs, useTheme } from '@mui/material';
import React from 'react';
import type { TabsProps } from '../../types/Tabs.types';

export const Tabs: React.FC<TabsProps> = ({
  value,
  onChange = () => {},
  tabs,
  marginTop = '13px',
  'aria-label': ariaLabel = 'tabs',
  variant = 'standard',
  activeTextColor,
  indicatorColor,
  fontSize,
  fontWeight,
  selectedFontWeight,
  ...muiTabsProps
}) => {
  const theme = useTheme();

  return (
    <MuiTabs
      {...muiTabsProps}
      aria-label={ariaLabel}
      data-testid="common-tabs"
      indicatorColor="primary"
      variant={variant}
      value={value}
      onChange={onChange}
      textColor="inherit"
      sx={{
        marginTop,
        borderRadius: '12px',
        borderColor: theme.palette.allShades.blueGray[100],
        border: 'none',
        background: theme.palette.allShades.white,
        color: theme.palette.allShades.gray[900],
        '& .MuiTab-root': {
          textTransform: 'none',
          fontSize: fontSize ?? theme.typography.body2.fontSize,
          fontWeight: fontWeight ?? theme.typography.body2.fontWeight,
          color: theme.palette.allShades.gray[900],
          '&.Mui-selected': {
            color: activeTextColor ?? theme.palette.allShades.blue[700],
            fontWeight: selectedFontWeight ?? theme.typography.subtitle2.fontWeight,
          },
          '&.Mui-disabled': {
            color: theme.palette.allShades?.gray?.[600],
            cursor: 'not-allowed',
          },
        },
        '& .MuiTabs-indicator': {
          height: '2px',
          backgroundColor: indicatorColor ?? theme.palette.allShades.blue[700],
        },
        ...muiTabsProps.sx,
      }}
    >
      {tabs.map((tab) => (
        <Tab
          key={tab.value}
          data-testid={`common-tab-${tab.value}`}
          disabled={tab.disabled}
          label={tab.label}
          value={tab.value}
        />
      ))}
    </MuiTabs>
  );
};
