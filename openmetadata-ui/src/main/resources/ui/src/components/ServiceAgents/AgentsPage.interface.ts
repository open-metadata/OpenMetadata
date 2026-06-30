/*
 *  Copyright 2025 Collate.
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

export type AgentStatus = 'running' | 'success' | 'failed' | 'queued';

export type RunStatus = 'success' | 'partial' | 'failed' | 'running' | 'skipped';

export type AgentTab = 'metadata' | 'ai';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface Agent {
  id: string;
  name: string;
  type: string;
  unit: string;
  verb: string;
  status: AgentStatus;
  pct: number;
  eta: number | null;
  assets: number;
  target: number;
  errors: number;
  warnings: number;
  after?: string;
  finishedAt?: string;
  failStep?: string;
}

export interface AgentsState {
  metadata: Agent[];
  ai: Agent[];
}

export interface RunAttention {
  severity: 'error' | 'warning';
  title: string;
  message: string;
  hint?: string;
}

export interface RunStep {
  name: string;
  status: RunStatus;
  records: number;
  filtered: number;
  updated: number;
  warnings: number;
  errors: number;
  attention?: RunAttention;
}

export interface RunTotals {
  records: number;
  filtered: number;
  updated: number;
  warnings: number;
  errors: number;
}

export interface AgentRun {
  id: string;
  status: RunStatus;
  startedAt: string;
  duration: number;
  totals: RunTotals;
  steps: RunStep[];
}

export interface LogLine {
  time: string;
  level: LogLevel;
  text: string;
}

export interface BreadcrumbItem {
  label: string;
  isLink: boolean;
}

export interface ServiceInfo {
  name: string;
  typeLabel: string;
  iconSrc: string;
  breadcrumb: BreadcrumbItem[];
}
