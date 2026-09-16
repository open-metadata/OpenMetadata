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

import { lazy, Suspense, useCallback, useState } from 'react';

export interface OpenLogsParams {
  logEntityType: string;
  fqn: string;
  runId?: string;
}

const LogsViewerModalContainer = lazy(
  () => import('../components/common/LogViewerModal/LogsViewerModalContainer')
);

/**
 * Local, providerless logs-modal hook. A caller that can open logs uses this
 * hook, calls `openLogs(...)`, and renders the returned `logsModal` element in
 * its own JSX. The heavy modal lives behind `lazy(() => import(...))`, so its
 * chunk is downloaded only when a user actually opens logs on that page — no
 * logs code is shipped in the always-loaded app bundle.
 */
export const useLogsModal = () => {
  const [params, setParams] = useState<OpenLogsParams | null>(null);

  const openLogs = useCallback((nextParams: OpenLogsParams) => {
    setParams(nextParams);
  }, []);

  const closeLogs = useCallback(() => {
    setParams(null);
  }, []);

  const logsModal = params ? (
    <Suspense fallback={null}>
      <LogsViewerModalContainer {...params} onClose={closeLogs} />
    </Suspense>
  ) : null;

  return { openLogs, logsModal };
};
