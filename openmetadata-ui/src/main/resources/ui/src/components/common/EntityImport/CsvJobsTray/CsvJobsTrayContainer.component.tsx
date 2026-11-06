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
import { FC, lazy, Suspense, useEffect, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { CSV_JOBS_REFRESH_EVENT } from './CsvJobsTray.constants';

const CsvJobsTray = lazy(() =>
  import('./CsvJobsTray.component').then(({ CsvJobsTray: Tray }) => ({
    default: Tray,
  }))
);

/**
 * Keeps the CSV jobs tray out of the main bundle. Nothing is loaded until the
 * user actually starts a CSV export/import (which dispatches
 * CSV_JOBS_REFRESH_EVENT); only then is the tray chunk fetched and mounted. Once
 * mounted it stays for the session and manages its own refresh via the event
 * and socket channels.
 */
export const CsvJobsTrayContainer: FC = () => {
  const [isTrayActivated, setIsTrayActivated] = useState(false);

  useEffect(() => {
    const activateTray = () => setIsTrayActivated(true);
    window.addEventListener(CSV_JOBS_REFRESH_EVENT, activateTray);

    return () =>
      window.removeEventListener(CSV_JOBS_REFRESH_EVENT, activateTray);
  }, []);

  // The tray is non-critical, on-demand UI; if the lazy chunk fails to load
  // (transient network error or a stale chunk after a deploy) degrade to
  // rendering nothing instead of crashing the surrounding subtree.
  return isTrayActivated ? (
    <ErrorBoundary fallback={<></>}>
      <Suspense fallback={null}>
        <CsvJobsTray />
      </Suspense>
    </ErrorBoundary>
  ) : null;
};
