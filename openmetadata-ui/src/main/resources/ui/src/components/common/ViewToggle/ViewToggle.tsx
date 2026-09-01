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
import { FC, useCallback, useState } from 'react';
import { ReactComponent as WorkflowIcon } from '../../../assets/svg/data-flow.svg';

export enum ViewMode {
  Table = 'table',
  Card = 'card',
  Tree = 'tree',
}

interface ViewToggleProps {
  value: ViewMode;
  onChange: (view: ViewMode) => void;
  views?: ViewMode[];
}

const DEFAULT_VIEWS: ViewMode[] = [ViewMode.Table, ViewMode.Card];

const readPersistedView = (
  storageKey: string,
  defaultView: ViewMode,
  views: ViewMode[]
): ViewMode => {
  try {
    const stored = localStorage.getItem(storageKey);

    return stored !== null && views.includes(stored as ViewMode)
      ? (stored as ViewMode)
      : defaultView;
  } catch {
    return defaultView;
  }
};

const persistView = (storageKey: string, view: ViewMode): void => {
  try {
    localStorage.setItem(storageKey, view);
  } catch {
    // ignore storage errors (e.g. private mode quota)
  }
};

/**
 * Persisted `ViewMode` state for a listing page's `ViewToggle` -- e.g.
 * remembering the last view (table/grid/tree) a user picked as their
 * default for next time, on this browser. `views` scopes which stored
 * values are accepted for `storageKey` -- pass the same list given to
 * `<ViewToggle views={...} />` -- so this one hook backs a two-option
 * toggle (Data Products: table/card) and a three-option one (Domains:
 * table/card/tree) without any change here.
 *
 * @param storageKey persistence key (include a version suffix, e.g. `.v1`,
 *   so a later incompatible change to what's stored doesn't hand back a
 *   value written under the old shape)
 * @param views the views this toggle accepts; a stored value outside this
 *   list (stale, or from a different toggle) falls back to `defaultView`
 * @param defaultView value used when nothing is stored yet, storage is
 *   unavailable (e.g. private browsing), or the stored value isn't in `views`
 */
export const usePersistedViewMode = (
  storageKey: string,
  views: ViewMode[] = DEFAULT_VIEWS,
  defaultView: ViewMode = ViewMode.Table
): [ViewMode, (view: ViewMode) => void] => {
  const [view, setView] = useState<ViewMode>(() =>
    readPersistedView(storageKey, defaultView, views)
  );

  const setPersistedView = useCallback(
    (next: ViewMode) => {
      setView(next);
      persistView(storageKey, next);
    },
    [storageKey]
  );

  return [view, setPersistedView];
};

const getIconElement = (mode: ViewMode, isActive: boolean) => {
  const iconClass = `tw:size-4 ${
    isActive ? 'tw:text-fg-brand-primary' : 'tw:text-fg-secondary'
  }`;
  switch (mode) {
    case ViewMode.Card:
      return <Grid01 className={iconClass} />;
    case ViewMode.Tree:
      return <WorkflowIcon aria-label="Tree view" className={iconClass} />;
    case ViewMode.Table:
    default:
      return <Menu01 className={iconClass} />;
  }
};

const ViewToggle: FC<ViewToggleProps> = ({
  value,
  onChange,
  views = DEFAULT_VIEWS,
}) => {
  const availableViews = views.length > 0 ? views : DEFAULT_VIEWS;

  return (
    <ButtonGroup
      disallowEmptySelection
      selectedKeys={new Set([value])}
      size="sm"
      onSelectionChange={(keys) => {
        const selected = Array.from(keys as Set<string>)[0] as ViewMode;
        if (selected) {
          onChange(selected);
        }
      }}>
      {availableViews.map((mode) => {
        const isActive = value === mode;

        return (
          <ButtonGroupItem
            aria-label={mode}
            className={isActive ? '!tw:bg-brand-primary' : ''}
            data-testid={`${mode}-view-toggle`}
            iconLeading={getIconElement(mode, isActive)}
            id={mode}
            key={mode}
          />
        );
      })}
    </ButtonGroup>
  );
};

export default ViewToggle;
