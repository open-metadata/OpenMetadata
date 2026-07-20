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

import {
  BookClosed,
  Code01,
  Database01,
  Grid01,
  LayersThree01,
  Shield01,
  Zap,
} from '@untitledui/icons';
import { TFunction } from 'i18next';
import { ReactComponent as LineageIcon } from '../../../assets/svg/agents/lineage.svg';
import { ReactComponent as SparkleIcon } from '../../../assets/svg/agents/sparkle.svg';
import {
  Agent,
  AgentActionPermissions,
  AgentStatus,
  RunStatus,
} from '../AgentsPage.interface';

// Safe default while permissions are unresolved — actions stay hidden until an
// explicit permission set is provided.
export const NO_AGENT_PERMISSIONS: AgentActionPermissions = {
  trigger: false,
  edit: false,
  delete: false,
};

export const ALL_AGENT_PERMISSIONS: AgentActionPermissions = {
  trigger: true,
  edit: true,
  delete: true,
};

// Single source of truth for every run entry point. An agent that is already
// running or queued must not be triggerable again — a second trigger would
// queue a duplicate run behind the one still waiting.
export const canRunAgent = (
  agent: Agent,
  permissions: AgentActionPermissions = NO_AGENT_PERMISSIONS
): boolean =>
  permissions.trigger &&
  agent.status !== 'running' &&
  agent.status !== 'queued';

export const fmtNum = (n: number): string => n.toLocaleString();

export type EtaState = 'idle' | 'wrapping' | 'seconds' | 'minutes';

export interface EtaInfo {
  state: EtaState;
  value?: number;
}

export const getEtaInfo = (s: number | null): EtaInfo => {
  let result: EtaInfo = { state: 'idle' };
  if (s !== null) {
    if (s <= 0) {
      result = { state: 'wrapping' };
    } else if (s < 60) {
      result = { state: 'seconds', value: s };
    } else {
      result = { state: 'minutes', value: Math.round(s / 60) };
    }
  }

  return result;
};

export const UNIT_LABEL_KEY: Record<string, string> = {
  queries: 'label.query-plural-lowercase',
  assets: 'label.asset-plural-lowercase',
  models: 'label.model-plural-lowercase',
};

export const UNIT_VERB_LABEL_KEY: Record<string, string> = {
  scanned: 'label.queries-scanned',
  processed: 'label.queries-processed',
  ingested: 'label.assets-ingested',
  profiled: 'label.assets-profiled',
  parsed: 'label.models-parsed',
};

export const getUnitLabelKey = (unit: string): string =>
  UNIT_LABEL_KEY[unit] ?? 'label.asset-plural-lowercase';

export const getUnitVerbLabelKey = (verb: string): string =>
  UNIT_VERB_LABEL_KEY[verb] ?? 'label.assets-ingested';

const EM_DASH = '—';

export const formatEtaLong = (info: EtaInfo, t: TFunction): string => {
  const byState: Record<EtaState, string> = {
    idle: EM_DASH,
    wrapping: t('label.wrapping-up'),
    seconds: t('message.seconds-left', { count: info.value }),
    minutes: t('message.minutes-left', { count: info.value }),
  };

  return byState[info.state];
};

export const formatEtaShort = (info: EtaInfo, t: TFunction): string => {
  const byState: Record<EtaState, string> = {
    idle: EM_DASH,
    wrapping: t('label.wrapping-up'),
    seconds: t('message.seconds-short', { count: info.value }),
    minutes: t('message.minutes-short', { count: info.value }),
  };

  return byState[info.state];
};

export const AGENT_TYPE_ICON: Record<string, SvgComponent> = {
  Metadata: Database01,
  Usage: Zap,
  Profiler: Grid01,
  Lineage: LineageIcon,
  'Auto Classification': SparkleIcon,
  dbt: Code01,
  Tier: LayersThree01,
  Documentation: BookClosed,
  'Data Quality': Shield01,
};

export const AGENT_TYPE_LABEL_KEY: Record<string, string> = {
  Metadata: 'label.metadata',
  Usage: 'label.usage',
  Profiler: 'label.profiler',
  Lineage: 'label.lineage',
  'Auto Classification': 'label.auto-classification',
  dbt: 'label.dbt-lowercase',
  Tier: 'label.tier',
  Documentation: 'label.documentation',
  'Data Quality': 'label.data-quality',
};

export const getAgentTypeLabelKey = (type: string): string =>
  AGENT_TYPE_LABEL_KEY[type] ?? 'label.metadata';

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
  none: { color: 'gray' },
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

export const RUN_DOT_CLASS: Record<string, string> = {
  failed: 'tw:bg-utility-error-500',
  partial: 'tw:bg-utility-warning-500',
  success: 'tw:bg-utility-success-500',
  skipped: 'tw:bg-utility-gray-300',
};

export const AGENT_ICON_CLASS: Record<AgentStatus, string> = {
  running: 'tw:text-fg-brand-primary',
  failed: 'tw:text-fg-error-primary',
  success: 'tw:text-fg-success-primary',
  queued: 'tw:text-fg-quaternary',
  none: 'tw:text-fg-quaternary',
};
