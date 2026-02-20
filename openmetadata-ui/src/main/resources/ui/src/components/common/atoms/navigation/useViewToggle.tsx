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

import { Button, ButtonGroup, useTheme } from '@mui/material';
import { defaultColors } from '@openmetadata/ui-core-components';
import { Grid01, Menu01 } from '@untitledui/icons';
import { useCallback, useMemo, useState } from 'react';
import { ReactComponent as WorkflowIcon } from '../../../../assets/svg/data-flow.svg';

export type ViewMode = 'table' | 'card' | 'tree';

interface UseViewToggleConfig {
  defaultView?: ViewMode;
  views?: ViewMode[];
}

/**
 * Complete view toggle system with state management and UI
 *
 * @description
 * Provides view mode state management and toggle button UI in a single hook.
 * Manages table/card view switching with MUI ButtonGroup, proper styling,
 * and brand colors for active states.
 *
 * @param config.defaultView - Initial view mode ('table' | 'card')
 *
 * @example
 * ```typescript
 * const { view, viewToggle } = useViewToggle({ defaultView: 'table' });
 *
 * // Use in layout:
 * <Box sx={{ display: 'flex', gap: 2 }}>
 *   {filters}
 *   {viewToggle}
 * </Box>
 *
 * // Conditional rendering:
 * {view === 'table' ? <DataTable /> : <CardView />}
 * ```
 *
 * @stability Stable - Self-contained with stable dependencies
 * @complexity Medium - State management + UI rendering
 */
export const useViewToggle = ({
  defaultView = 'table',
  views,
}: UseViewToggleConfig = {}) => {
  const theme = useTheme();

  const availableViews = useMemo<ViewMode[]>(
    () => (views && views.length > 0 ? views : ['table', 'card']),
    [views]
  );

  const initialView = useMemo<ViewMode>(() => {
    return availableViews.includes(defaultView)
      ? defaultView
      : availableViews[0];
  }, [availableViews, defaultView]);

  // State management
  const [view, setView] = useState<ViewMode>(initialView);

  // State change functions
  const setTableView = useCallback(() => {
    setView('table');
  }, []);

  const setCardView = useCallback(() => {
    setView('card');
  }, []);

  const setTreeView = useCallback(() => {
    setView('tree');
  }, []);

  // Computed state
  const isTableView = view === 'table';
  const isCardView = view === 'card';
  const isTreeView = view === 'tree';

  const renderIcon = useCallback((mode: ViewMode) => {
    switch (mode) {
      case 'card':
        return <Grid01 size={16} />;
      case 'tree':
        return <WorkflowIcon aria-label="Tree view" height={16} width={16} />;
      case 'table':
      default:
        return <Menu01 size={16} />;
    }
  }, []);

  const viewToggle = useMemo(
    () => (
      <ButtonGroup
        size="small"
        sx={{
          '& .MuiButton-root': {
            padding: '6px',
            minWidth: 'auto',
            '&:first-of-type': {
              borderTopLeftRadius: '4px',
              borderBottomLeftRadius: '4px',
              borderTopRightRadius: '0px',
              borderBottomRightRadius: '0px',
            },
            '&:last-of-type': {
              borderTopLeftRadius: '0px',
              borderBottomLeftRadius: '0px',
              borderTopRightRadius: '4px',
              borderBottomRightRadius: '4px',
            },
          },
        }}
        variant="outlined">
        {availableViews.map((mode) => {
          const isActive = view === mode;

          return (
            <Button
              data-testid={`${mode}-view-toggle`}
              key={mode}
              sx={{
                backgroundColor: isActive
                  ? `${defaultColors.blue[50]} !important`
                  : 'transparent',
                color: isActive
                  ? theme.palette.allShades?.brand?.[600]
                  : 'inherit',
                '& svg': {
                  color: isActive
                    ? theme.palette.allShades?.brand?.[600]
                    : 'inherit',
                },
              }}
              title={mode}
              variant="outlined"
              onClick={() => setView(mode)}>
              {renderIcon(mode)}
            </Button>
          );
        })}
      </ButtonGroup>
    ),
    [availableViews, renderIcon, setView, theme, view]
  );

  return {
    view,
    viewToggle,
    setView,
    setTableView,
    setCardView,
    setTreeView,
    isTableView,
    isCardView,
    isTreeView,
  };
};
