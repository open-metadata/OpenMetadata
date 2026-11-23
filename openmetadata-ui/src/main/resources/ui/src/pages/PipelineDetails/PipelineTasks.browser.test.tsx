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
import { http, HttpResponse } from 'msw';
import { many, named } from '../../test/browser/fixtures/entities';
import { worker } from '../../test/browser/msw';
import { describeClientPagedTable } from '../../test/browser/paginationContract';

const PIPELINE_FQN = 'pw_airflow.pw_pipeline';
const tasks = many(20, (i) => ({
  name: `pw_task_${String(i).padStart(2, '0')}`,
  displayName: `PW Task ${String(i).padStart(2, '0')}`,
  fullyQualifiedName: `${PIPELINE_FQN}.pw_task_${i}`,
}));
const pipeline = {
  ...named('pipeline', 1),
  name: 'pw_pipeline',
  fullyQualifiedName: PIPELINE_FQN,
  service: {
    id: '00000000-0000-4000-8000-0000000000d1',
    type: 'pipelineService',
    name: 'pw_airflow',
    fullyQualifiedName: 'pw_airflow',
  },
  serviceType: 'Airflow',
  tasks,
  owners: [],
  tags: [],
  domains: [],
  dataProducts: [],
  followers: [],
  version: 0.1,
};

// Replaces Pagination.spec.ts › "Pipeline Tasks normal pagination" and
// "should display at most pageSize rows on each page and total matches".
describeClientPagedTable({
  name: 'Pipeline › Tasks',
  url: `/pipeline/${PIPELINE_FQN}?pageSize=15`,
  tableTestId: 'task-table',
  totalRows: 20,
  rowLabel: (i) => tasks[i].displayName,
  setup: () =>
    worker.use(
      http.get('/api/v1/pipelines/name/:fqn', () => HttpResponse.json(pipeline))
    ),
});
