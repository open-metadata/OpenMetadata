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
import { Grid01, Menu01 } from '@untitledui/icons';
import { useCallback, useMemo, useState } from 'react';

export type ViewMode = 'table' | 'card';

interface UseViewToggleConfig {
  defaultView?: ViewMode;
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
}: UseViewToggleConfig = {}) => {
  // State management
  const [view, setView] = useState<ViewMode>(defaultView);
  const theme = useTheme();

  // State change functions
  const setTableView = useCallback(() => {
    setView('table');
  }, []);

  const setCardView = useCallback(() => {
    setView('card');
  }, []);

  // Computed state
  const isTableView = view === 'table';
  const isCardView = view === 'card';

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
        <Button
          sx={{
            backgroundColor:
              view === 'table'
                ? theme.palette.allShades?.brand?.[50]
                : 'inherit',
            color:
              view === 'table'
                ? theme.palette.allShades?.brand?.[600]
                : 'inherit',
            '& svg': {
              color:
                view === 'table'
                  ? theme.palette.allShades?.brand?.[600]
                  : 'inherit',
            },
          }}
          variant="outlined"
          onClick={setTableView}>
          <Menu01 size={16} />
        </Button>
        <Button
          sx={{
            backgroundColor:
              view === 'card'
                ? theme.palette.allShades?.brand?.[50]
                : 'inherit',
            color:
              view === 'card'
                ? theme.palette.allShades?.brand?.[600]
                : 'inherit',
            '& svg': {
              color:
                view === 'card'
                  ? theme.palette.allShades?.brand?.[600]
                  : 'inherit',
            },
          }}
          variant="outlined"
          onClick={setCardView}>
          <Grid01 size={16} />
        </Button>
      </ButtonGroup>
    ),
    [view, setTableView, setCardView, theme]
  );

  return {
    view,
    viewToggle,
    setView,
    setTableView,
    setCardView,
    isTableView,
    isCardView,
  };
};
