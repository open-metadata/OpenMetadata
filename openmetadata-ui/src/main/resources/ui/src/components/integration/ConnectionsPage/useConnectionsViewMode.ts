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

import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCurrentUserPreferences } from '../../../hooks/currentUserStore/useCurrentUserStore';
import { VIEW_MODE_PARAM } from './ConnectionsPage.constants';

export type ConnectionsViewMode = 'grid' | 'list';

const isConnectionsViewMode = (
  value: string | null | undefined
): value is ConnectionsViewMode => value === 'grid' || value === 'list';

export const useConnectionsViewMode = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    preferences: { connectionsViewMode },
    setPreference,
  } = useCurrentUserPreferences();
  const viewModeParam = searchParams.get(VIEW_MODE_PARAM);
  const viewMode = isConnectionsViewMode(viewModeParam)
    ? viewModeParam
    : isConnectionsViewMode(connectionsViewMode)
    ? connectionsViewMode
    : 'grid';

  const setViewMode = useCallback(
    (nextViewMode: ConnectionsViewMode) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.set(VIEW_MODE_PARAM, nextViewMode);

          return next;
        },
        { replace: true }
      );
      setPreference({ connectionsViewMode: nextViewMode });
    },
    [setSearchParams, setPreference]
  );

  return { setViewMode, viewMode };
};
