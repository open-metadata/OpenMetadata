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
}

export type LogViewerModalProps = LogViewerModalBaseProps &
  (
    | { mode?: 'static'; logs: string; fqn?: never }
    | { mode: 'stream'; fqn: string; runId: string; logs?: string }
  );
