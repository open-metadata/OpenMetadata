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

import { ReactComponent as BookIcon } from '../../../assets/svg/agents/book.svg';
import { ReactComponent as CodeIcon } from '../../../assets/svg/agents/code.svg';
import { ReactComponent as DatabaseIcon } from '../../../assets/svg/agents/database.svg';
import { ReactComponent as GridIcon } from '../../../assets/svg/agents/grid.svg';
import { ReactComponent as LayersIcon } from '../../../assets/svg/agents/layers.svg';
import { ReactComponent as LineageIcon } from '../../../assets/svg/agents/lineage.svg';
import { ReactComponent as ShieldIcon } from '../../../assets/svg/agents/shield.svg';
import { ReactComponent as SparkleIcon } from '../../../assets/svg/agents/sparkle.svg';
import { ReactComponent as ZapIcon } from '../../../assets/svg/agents/zap.svg';
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

export const AGENT_TYPE_ICON: Record<string, SvgComponent> = {
  Metadata: DatabaseIcon,
  Usage: ZapIcon,
  Profiler: GridIcon,
  Lineage: LineageIcon,
  'Auto Classification': SparkleIcon,
  dbt: CodeIcon,
  Tier: LayersIcon,
  Documentation: BookIcon,
  'Data Quality': ShieldIcon,
};

export type AgentBadgeColor =
  | 'brand'
  | 'error'
  | 'gray'
  | 'success'
  | 'warning';

export interface PillMeta {
  color: AgentBadgeColor;
  pulse?: boolean;
}

export const STATUS_PILL_META: Record<AgentStatus, PillMeta> = {
  running: { color: 'brand', pulse: true },
  success: { color: 'success' },
  failed: { color: 'error' },
  queued: { color: 'gray' },
};

export interface RunMeta {
  labelKey: string;
  color: AgentBadgeColor;
  barClassName: string;
  textClassName: string;
}

export const RUN_META: Record<RunStatus, RunMeta> = {
  success: {
    labelKey: 'label.success',
    color: 'success',
    barClassName: 'tw:bg-utility-success-500',
    textClassName: 'tw:text-utility-success-700',
  },
  partial: {
    labelKey: 'label.partial-success',
    color: 'warning',
    barClassName: 'tw:bg-utility-warning-500',
    textClassName: 'tw:text-utility-warning-700',
  },
  failed: {
    labelKey: 'label.failed',
    color: 'error',
    barClassName: 'tw:bg-utility-error-500',
    textClassName: 'tw:text-utility-error-700',
  },
  running: {
    labelKey: 'label.running',
    color: 'brand',
    barClassName: 'tw:bg-utility-brand-500',
    textClassName: 'tw:text-utility-brand-700',
  },
  skipped: {
    labelKey: 'label.did-not-run',
    color: 'gray',
    barClassName: 'tw:bg-utility-gray-300',
    textClassName: 'tw:text-quaternary',
  },
};

export const RECENT_RUN_STATUSES: Record<AgentStatus, RunStatus[]> = {
  success: ['success', 'success', 'partial', 'success', 'success'],
  failed: ['failed', 'partial', 'success', 'success', 'failed'],
  running: ['success', 'success', 'partial', 'success', 'success'],
  queued: ['success', 'success', 'success', 'partial', 'success'],
};

export const RUN_DOT_CLASS: Record<string, string> = {
  failed: 'tw:bg-utility-error-500',
  partial: 'tw:bg-utility-warning-500',
  success: 'tw:bg-utility-success-500',
};

export const AGENT_ICON_CLASS: Record<AgentStatus, string> = {
  running: 'tw:text-fg-brand-primary',
  failed: 'tw:text-fg-error-primary',
  success: 'tw:text-fg-success-primary',
  queued: 'tw:text-fg-quaternary',
};
