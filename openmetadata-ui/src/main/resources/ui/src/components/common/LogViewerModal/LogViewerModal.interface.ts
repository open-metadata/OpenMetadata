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
import { RefObject } from 'react';
import { StreamHealth } from '../../../utils/SseStreamUtils';

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
  // The full log text. The caller grows this as the run produces output.
  logs: string;
  // 'stream' means the underlying run is LIVE: the modal shows the live
  // indicator and auto-follows the tail. The caller grows `logs` while the run
  // is active — over SSE where the deployment supports it, otherwise by polling
  // — then flips back to 'static' once the run reaches a terminal state.
  mode?: 'static' | 'stream';
  // Transport state of the SSE tail, when one is in use. 'connecting' after a
  // drop shows a reconnecting indicator in place of the live dot.
  streamHealth?: StreamHealth;
  // The server could not replay the whole backlog: what is shown starts partway
  // through the run and the rest has to come from the download.
  streamTruncated?: boolean;
  // A message from the server explaining why the tail stopped.
  streamError?: string | null;
}

export type LogViewerModalProps = LogViewerModalBaseProps;

/** The geometry the log viewer reports on every scroll. */
export interface LogViewerScrollValues {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

/** What a single scroll report says, before any decision is taken on it. */
export interface ScrollFacts {
  isBottom: boolean;
  fillsViewport: boolean;
  userMovedTheView: boolean;
  movedAwayFromTail: boolean;
  movedTowardsTail: boolean;
}

export interface UseLogAutoFollowParams {
  /** The modal's own open state: a closed viewer follows nothing. */
  open: boolean;
  isLive: boolean;
  /** The caller's static preference, used to seed and re-seed the live state. */
  follow: boolean;
  /** Watched to know when the library may have restored its own scroll offset. */
  logs: string;
  bodyRef: RefObject<HTMLDivElement | null>;
  /** Accessible name given to the scrolling element once it is found. */
  scrollerLabel: string;
  scrollToEnd: () => void;
}

export interface UseLogAutoFollowResult {
  followTail: boolean;
  /** Feed every scroll report through this; returns what the report said. */
  trackScroll: (values: LogViewerScrollValues) => ScrollFacts;
  resumeFollowingTail: () => void;
  toggleFollow: () => void;
  /** Call before a relayout (wrap, full screen) so it is not read as intent. */
  markViewerScroll: () => void;
}
