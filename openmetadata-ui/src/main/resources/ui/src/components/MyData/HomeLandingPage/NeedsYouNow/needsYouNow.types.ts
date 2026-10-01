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

import {
  AlertCircle,
  CheckCircle,
  ShieldTick,
} from '@openmetadata/ui-core-components/icons';

/**
 * The three streams the inbox merges. Each one comes from a different backend
 * today (tasks, ingestion-pipeline status, test results / certifications), which
 * is why the ranked cross-domain feed is still a backend ask.
 */
export type NeedsYouNowKind = 'approval' | 'health' | 'quality';

export interface NeedsYouNowItem {
  id: string;
  kind: NeedsYouNowKind;
  /** Mono chip beside the title — a task ref, an affected count, a service. */
  ref: string;
  title: string;
  summary: string;
  /** Who raised it — a user name for approvals, a system for the rest. */
  actor: string;
  /** Pre-formatted for now; becomes a timestamp once this is API-backed. */
  age: string;
  /** Approvals render Reject/Approve instead of a single action. */
  actionLabel?: string;
}

interface NeedsYouNowKindConfig {
  icon: typeof CheckCircle;
  /** Leading icon tile — tinted surface plus its matching foreground. */
  tile: string;
  /** i18n key for the tab that filters to this kind. */
  labelKey: string;
}

export const NEEDS_YOU_NOW_KINDS: Record<
  NeedsYouNowKind,
  NeedsYouNowKindConfig
> = {
  approval: {
    icon: CheckCircle,
    labelKey: 'label.approval-plural',
    tile: 'tw:bg-utility-blue-50 tw:text-utility-blue-600',
  },
  health: {
    icon: AlertCircle,
    labelKey: 'label.health',
    tile: 'tw:bg-utility-error-50 tw:text-utility-error-600',
  },
  quality: {
    icon: ShieldTick,
    labelKey: 'label.quality',
    tile: 'tw:bg-utility-purple-50 tw:text-utility-purple-600',
  },
};

/** Tab order, most actionable first; `all` is prepended by the section. */
export const NEEDS_YOU_NOW_KIND_ORDER: NeedsYouNowKind[] = [
  'approval',
  'health',
  'quality',
];
