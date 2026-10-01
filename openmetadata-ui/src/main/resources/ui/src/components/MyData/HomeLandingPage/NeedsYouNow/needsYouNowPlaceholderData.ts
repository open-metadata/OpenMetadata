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

import { NeedsYouNowItem } from './needsYouNow.types';
import { SystemAlert } from '../SystemAlertBanner';

/**
 * Stand-in content for the two sections that have no backend yet. Both are
 * verbatim from the landing-page prototype so the layout can be reviewed at
 * realistic copy lengths; neither is wired to an API.
 *
 * Deliberately NOT translated — these strings stand in for server-supplied
 * content, exactly like the persona demo cards in `widgets/personaDemoData.ts`.
 * The surrounding chrome (headings, tabs, buttons) is translated as usual.
 *
 * Replacing them needs, per section:
 *  - banner: a platform-wide critical-incident feed (no endpoint today).
 *  - needs-you-now: one ranked feed merging tasks + failing services + failing
 *    tests + expiring certifications, ordered by impact and age.
 */
export const PLACEHOLDER_SYSTEM_ALERT: SystemAlert = {
  id: 'placeholder-ingestion-outage',
  title: 'Ingestion outage on Snowflake and Redshift',
  severity: 'Critical',
  description:
    'Metadata and profiler pipelines are paused while we rotate a compromised service credential. Expect stale assets until ~6:00 PM IST — no action needed from your team.',
};

export const PLACEHOLDER_NEEDS_YOU_NOW: NeedsYouNowItem[] = [
  {
    id: 'task-00424',
    kind: 'approval',
    ref: '#TASK-00424',
    title: 'Approve access to raw_orders for harsha',
    summary:
      'Waiting 13 days — the longest-pending request in your queue. harsha already owns two tables in the same schema, so this is a low-risk grant.',
    actor: 'harsha',
    age: '13 days ago',
  },
  {
    id: 'health-ingestion-stopped',
    kind: 'health',
    ref: '15 services',
    title: '15 of 25 services stopped ingesting',
    summary:
      'Profiler, metadata and usage ingestion failed across Redshift, Snowflake and Airflow inside the same 16-hour window — one credential or network change is the likely cause.',
    actor: 'Ingestion service',
    age: '16 hours ago',
    actionLabel: 'View failing services',
  },
  {
    id: 'task-00107',
    kind: 'approval',
    ref: '#TASK-00107',
    title: 'Request access to Customer Analytics',
    summary:
      'Oldest open request in the workspace. reethika lost access when the analytics group was renamed in June — three of her teammates were already re-granted.',
    actor: 'reethika',
    age: '3 months ago',
  },
  {
    id: 'quality-cert-expired',
    kind: 'quality',
    ref: 'Redshift',
    title: 'Gold certification on customers expired',
    summary:
      'red.dev.dbt_jaffle.customers lost its Gold badge on 2026-06-24 and is still referenced by 6 downstream dashboards.',
    actor: 'Governance',
    age: 'expired 24 Jun',
    actionLabel: 'Renew certification',
  },
  {
    id: 'task-00418',
    kind: 'approval',
    ref: '#TASK-00418',
    title: 'Approve AI descriptions on Customer360',
    summary:
      'The automation bot drafted descriptions for 4 undocumented columns. You approved three similar batches last month without edits.',
    actor: 'aiautomationapplicationbot',
    age: '22 days ago',
  },
  {
    id: 'quality-missing-descriptions',
    kind: 'quality',
    ref: 'Redshift',
    title: 'Two columns on customers have no description',
    summary:
      'first_order and most_recent_order feed 4 dashboards. Collate AI already has drafts ready for both.',
    actor: 'Governance',
    age: '12 days ago',
    actionLabel: 'Review AI drafts',
  },
  {
    id: 'task-00395',
    kind: 'approval',
    ref: '#TASK-00395',
    title: 'Approve tier change on ORDER_ITEMS',
    summary:
      'Moving ORDER_ITEMS to Tier 1 adds it to the daily profiler schedule and to executive lineage reports.',
    actor: 'aiautomationapplicationbot',
    age: '24 days ago',
  },
  {
    id: 'quality-undocumented-asset',
    kind: 'quality',
    ref: 'BigQuery',
    title: 'demo_dbt_jaffle.customers is fully undocumented',
    summary:
      'No table or column descriptions, no owner and no tier — the largest undocumented asset in BigQuery.',
    actor: 'Governance',
    age: '30 days ago',
    actionLabel: 'Add descriptions',
  },
];
