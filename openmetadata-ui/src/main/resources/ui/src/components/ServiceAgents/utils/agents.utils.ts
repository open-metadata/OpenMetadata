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

import { FC } from 'react';
import {
  IcBook,
  IcCode,
  IcDb,
  IcGrid,
  IcLayers,
  IcLineage,
  IcShield,
  IcSparkle,
  IcZap,
} from '../AgentIcons';
import { AgentStatus, RunStatus } from '../AgentsPage.interface';

export const fmtNum = (n: number): string => n.toLocaleString();

export const fmtEta = (s: number | null): string => {
  let result = '—';
  if (s !== null) {
    if (s <= 0) {
      result = 'wrapping up';
    } else if (s < 60) {
      result = `~${s}s left`;
    } else {
      result = `~${Math.round(s / 60)} min left`;
    }
  }

  return result;
};

export const AGENT_TYPE_ICON: Record<string, FC> = {
  Metadata: IcDb,
  Usage: IcZap,
  Profiler: IcGrid,
  Lineage: IcLineage,
  'Auto Classification': IcSparkle,
  dbt: IcCode,
  Tier: IcLayers,
  Documentation: IcBook,
  'Data Quality': IcShield,
};

export interface PillMeta {
  bg: string;
  fg: string;
  bd: string;
  dot: string;
  pulse?: boolean;
}

export const STATUS_PILL_META: Record<AgentStatus, PillMeta> = {
  running: {
    bg: 'var(--blue-50)',
    fg: 'var(--blue-700)',
    bd: 'var(--blue-200)',
    dot: 'var(--blue-500)',
    pulse: true,
  },
  success: {
    bg: 'var(--success-50)',
    fg: 'var(--success-700)',
    bd: 'var(--success-200)',
    dot: 'var(--success-500)',
  },
  failed: {
    bg: 'var(--error-50)',
    fg: 'var(--error-700)',
    bd: 'var(--error-200)',
    dot: 'var(--error-500)',
  },
  queued: {
    bg: 'var(--gray-50)',
    fg: 'var(--fg-tertiary)',
    bd: 'var(--border-default)',
    dot: 'var(--gray-400)',
  },
};

export interface RunMeta {
  labelKey: string;
  fg: string;
  bg: string;
  bd: string;
  bar: string;
}

export const RUN_META: Record<RunStatus, RunMeta> = {
  success: {
    labelKey: 'label.success',
    fg: 'var(--success-700)',
    bg: 'var(--success-50)',
    bd: 'var(--success-200)',
    bar: 'var(--success-500)',
  },
  partial: {
    labelKey: 'label.partial-success',
    fg: 'var(--warning-700)',
    bg: 'var(--warning-50)',
    bd: 'var(--warning-200)',
    bar: 'var(--warning-500)',
  },
  failed: {
    labelKey: 'label.failed',
    fg: 'var(--error-700)',
    bg: 'var(--error-50)',
    bd: 'var(--error-200)',
    bar: 'var(--error-500)',
  },
  running: {
    labelKey: 'label.running',
    fg: 'var(--blue-700)',
    bg: 'var(--blue-50)',
    bd: 'var(--blue-200)',
    bar: 'var(--blue-500)',
  },
  skipped: {
    labelKey: 'label.did-not-run',
    fg: 'var(--fg-muted)',
    bg: 'var(--gray-50)',
    bd: 'var(--border-default)',
    bar: 'var(--gray-300)',
  },
};

export const RECENT_RUN_STATUSES: Record<AgentStatus, RunStatus[]> = {
  success: ['success', 'success', 'partial', 'success', 'success'],
  failed: ['failed', 'partial', 'success', 'success', 'failed'],
  running: ['success', 'success', 'partial', 'success', 'success'],
  queued: ['success', 'success', 'success', 'partial', 'success'],
};

export const agentAccentColor = (status: AgentStatus): string => {
  const map: Record<AgentStatus, string> = {
    running: 'var(--blue-600)',
    failed: 'var(--error-600)',
    success: 'var(--success-600)',
    queued: 'var(--gray-400)',
  };

  return map[status];
};
