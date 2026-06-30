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

import redshiftIcon from '../../../assets/img/service-icon-redshift.webp';
import { AgentsState, ServiceInfo } from '../AgentsPage.interface';

export const SERVICE_INFO: ServiceInfo = {
  name: 'banking-redshift',
  typeLabel: 'Database Service',
  iconSrc: redshiftIcon,
  breadcrumb: [
    { label: 'Database Services', isLink: true },
    { label: 'banking-redshift', isLink: true },
    { label: 'Agents', isLink: false },
  ],
};

export const seedAgents = (): AgentsState => ({
  metadata: [
    { id: 'm1', name: 'Metadata Agent', type: 'Metadata', unit: 'assets', verb: 'ingested', status: 'running', pct: 64, eta: 78, assets: 1240, target: 1940, errors: 0, warnings: 0 },
    { id: 'm2', name: 'Usage Agent', type: 'Usage', unit: 'queries', verb: 'scanned', status: 'running', pct: 22, eta: 200, assets: 3200, target: 14600, errors: 0, warnings: 0 },
    { id: 'm3', name: 'Profiler Agent', type: 'Profiler', unit: 'assets', verb: 'profiled', status: 'running', pct: 41, eta: 150, assets: 70, target: 170, errors: 0, warnings: 1 },
    { id: 'm4', name: 'Lineage Agent', type: 'Lineage', unit: 'queries', verb: 'processed', status: 'running', pct: 33, eta: 165, assets: 2700, target: 8200, errors: 2, warnings: 0 },
    { id: 'm5', name: 'Auto Classification Agent', type: 'Auto Classification', unit: 'assets', verb: 'classified', status: 'queued', pct: 0, eta: null, assets: 0, target: 320, errors: 0, warnings: 0, after: 'Profiler Agent' },
    { id: 'm6', name: 'dbt Agent', type: 'dbt', unit: 'models', verb: 'parsed', status: 'success', pct: 100, eta: 0, assets: 96, target: 96, errors: 0, warnings: 0, finishedAt: '1m ago' },
  ],
  ai: [
    { id: 'a1', name: 'Tier Agent', type: 'Tier', unit: 'assets', verb: 'tiered', status: 'running', pct: 12, eta: 240, assets: 30, target: 250, errors: 0, warnings: 0 },
    { id: 'a2', name: 'Documentation Agent', type: 'Documentation', unit: 'assets', verb: 'documented', status: 'queued', pct: 0, eta: null, assets: 0, target: 410, errors: 0, warnings: 0, after: 'Tier Agent' },
    { id: 'a3', name: 'Data Quality Agent', type: 'Data Quality', unit: 'assets', verb: 'checked', status: 'failed', pct: 100, eta: 0, assets: 12, target: 140, errors: 1, warnings: 0, failStep: 'GetTestSuites', finishedAt: '3m ago' },
  ],
});
