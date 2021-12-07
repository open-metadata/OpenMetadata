/*
 *  Copyright 2021 Collate
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

export const data = [
  {
    title: 'Usage Bot',
    message:
      'Sanket is running queries beyond the assigned benchmark. Please review the usage.',
    timestamp: '12:30 AM',
    quickReplies: [
      { text: 'Review Usage' },
      { text: 'Increse Bandwidth' },
      { text: 'Ignore' },
    ],
  },
  {
    title: 'Quality Bot',
    message:
      'fact_order table quality tests are failing since 6 hours. Please look at the tests.',
    timestamp: '12:30 AM',
    quickReplies: [{ text: 'Review Test' }, { text: 'assign' }],
  },
  {
    title: 'Suresh',
    message: 'Sanket can you please fix the failing test.',
    timestamp: '12:30 AM',
    subThreads: [
      {
        title: 'Sanket',
        message: 'Looking into it.',
        timestamp: '12:35 AM',
      },
      {
        title: 'Sanket',
        message: 'Suresh I’ve fixed the tests. Please review.',
        timestamp: '12:36 AM',
        quickReplies: [{ text: 'Review' }, { text: 'Ignore' }],
      },
    ],
  },
];

export const tasksData = [
  {
    description: 'Fact order freshness below SLA.',
    tag: 'p0',
  },
  {
    description: 'Updated description for dim_address.',
    tag: 'p1',
  },
  {
    description: 'Workflow generate fuel_metric is running slow.',
    tag: 'p0',
  },
  {
    description: 'Fact order freshness below SLA.',
    tag: 'p0',
  },
  {
    description: 'Updated description for dim_address.',
    tag: 'p1',
  },
  {
    description: 'Workflow generate fuel_metric is running slow.',
    tag: 'p2',
  },
];
