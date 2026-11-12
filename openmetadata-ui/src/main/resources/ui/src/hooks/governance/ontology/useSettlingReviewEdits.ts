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

import { useEffect, useRef } from 'react';
import type { ReviewSettings } from './useOntologyPublication.types';

type SettingsUpdate = (latest: ReviewSettings) => ReviewSettings;

interface SettlingReviewEdits {
  viewKind: 'loading' | 'unavailable' | 'ready';
  canEditSettings?: boolean;
  saving: boolean;
  settings?: ReviewSettings;
  save: (next: ReviewSettings) => Promise<void>;
}

/**
 * The panel refetches after every save and reads as busy until the last read
 * returns. Disabling the controls for that read would close a menu the user
 * has just opened, so they stay usable while a save settles, and a pick made
 * meanwhile is applied to the settings the refetch returns, if they are still
 * editable by then.
 */
export const useSettlingReviewEdits = ({
  viewKind,
  canEditSettings = false,
  saving,
  settings,
  save,
}: SettlingReviewEdits) => {
  const wasEditable = useRef(false);
  const queued = useRef<SettingsUpdate>();
  const settled = viewKind === 'ready' && !saving;
  const editable = settled && canEditSettings;
  if (settled) {
    wasEditable.current = canEditSettings;
  }
  const refreshing = (saving || viewKind === 'loading') && wasEditable.current;

  useEffect(() => {
    const update = queued.current;
    if (!settled || !update) {
      return;
    }
    queued.current = undefined;
    if (canEditSettings && settings) {
      void save(update(settings));
    }
  });

  const change = (update: SettingsUpdate) => {
    if (refreshing) {
      queued.current = update;
    } else if (editable && settings) {
      void save(update(settings));
    }
  };

  return { interactive: editable || refreshing, change };
};
