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

import { ButtonGroup, ButtonGroupItem } from '@openmetadata/ui-core-components';
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
 * Manages table/card/tree view switching with ButtonGroup from ui-core-components.
 *
 * @param config.defaultView - Initial view mode ('table' | 'card')
 *
 * @example
 * ```typescript
 * const { view, viewToggle } = useViewToggle({ defaultView: 'table' });
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
  const availableViews = useMemo<ViewMode[]>(
    () => (views && views.length > 0 ? views : ['table', 'card']),
    [views]
  );

  const initialView = useMemo<ViewMode>(() => {
    return availableViews.includes(defaultView)
      ? defaultView
      : availableViews[0];
  }, [availableViews, defaultView]);

  const [view, setView] = useState<ViewMode>(initialView);

  const setTableView = useCallback(() => {
    setView('table');
  }, []);

  const setCardView = useCallback(() => {
    setView('card');
  }, []);

  const setTreeView = useCallback(() => {
    setView('tree');
  }, []);

  const isTableView = view === 'table';
  const isCardView = view === 'card';
  const isTreeView = view === 'tree';

  const getIconElement = useCallback((mode: ViewMode, isActive: boolean) => {
    const iconClass = `tw:size-4 ${
      isActive ? 'tw:text-fg-brand-primary' : 'tw:text-fg-secondary'
    }`;
    switch (mode) {
      case 'card':
        return <Grid01 className={iconClass} />;
      case 'tree':
        return <WorkflowIcon aria-label="Tree view" className={iconClass} />;
      case 'table':
      default:
        return <Menu01 className={iconClass} />;
    }
  }, []);

  const viewToggle = useMemo(
    () => (
      <ButtonGroup
        disallowEmptySelection
        selectedKeys={new Set([view])}
        size="sm"
        onSelectionChange={(keys) => {
          const selected = Array.from(keys as Set<string>)[0] as ViewMode;
          if (selected) {
            setView(selected);
          }
        }}>
        {availableViews.map((mode) => {
          const isActive = view === mode;

          return (
            <ButtonGroupItem
              aria-label={mode}
              className={isActive ? 'tw:bg-brand-primary!' : ''}
              data-testid={`${mode}-view-toggle`}
              iconLeading={getIconElement(mode, isActive)}
              id={mode}
              key={mode}
            />
          );
        })}
      </ButtonGroup>
    ),
    [availableViews, getIconElement, setView, view]
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
