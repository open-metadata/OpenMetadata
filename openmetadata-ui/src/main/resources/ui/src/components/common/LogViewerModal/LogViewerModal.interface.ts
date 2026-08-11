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
export type LogViewerStatusTone = 'success' | 'error' | 'warning' | 'muted';

export interface LogViewerStatus {
  label: string;
  tone?: LogViewerStatusTone; // default 'muted'
}

export interface LogViewerModalBaseProps {
  open: boolean;
  onClose: () => void;
  title: string;
  loading?: boolean;
  theme?: 'dark' | 'light';
  follow?: boolean;
  enableSearch?: boolean;
  enableCopy?: boolean;
  colorize?: boolean;
  onDownload?: () => void;
  status?: LogViewerStatus;
  totalLines?: number;
  runId?: string;
  lastRun?: string;
  // Infinite-scroll pagination: the caller owns fetching/paging and appends to
  // `logs`; the modal invokes `onLoadMore` when the viewport nears the bottom.
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  // Shows a loader in place of the download button while a download is running.
  downloading?: boolean;
  // The full log text. Callers that poll an in-progress run keep growing this.
  logs: string;
  // 'stream' means the underlying run is LIVE: the modal shows the live
  // indicator and auto-follows the tail. Today liveness is produced by the
  // caller polling and growing `logs` while the run is active, then flipping
  // back to 'static' once the run reaches a terminal state. `fqn`/`runId` are
  // reserved for re-enabling a self-fetching SSE stream (via `useLogStream`)
  // once the backend endpoint is available again — see useLogStream.ts.
  mode?: 'static' | 'stream';
  fqn?: string;
}

export type LogViewerModalProps = LogViewerModalBaseProps;
