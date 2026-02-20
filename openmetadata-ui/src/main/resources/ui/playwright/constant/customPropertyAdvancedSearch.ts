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

export const CP_BASE_VALUES = {
  string: 'gsdgfsdg',
  email: 'admin@open-metadata.org',
  markdown: '<p>HEre</p><p>new desc</p>',
  sqlQuery: 'Select * from TABLE',
  duration: 'P1Y3M4D1H3M4S',
  hyperlinkCp: {
    url: 'https://open-metadata.org',
    displayText: 'Test Link',
  },
  integer: 65,
  number: 55.7,
  timestamp: 1358694736345,
  dateCp: '19-12-2025',
  dateTimeCp: '12-12-2025 21:56:40',
  timeCp: '05:04:04',
  enum: ['Option 1'],
  timeInterval: {
    start: 5555555555555,
    end: 3435345345359,
  },
  tableCp: {
    rows: [
      {
        'Sr No': '1',
        Name: 'User1',
        Role: 'Admin',
      },
      {
        'Sr No': '2',
        Name: 'User2',
        Role: 'Data Steward',
      },
    ],
    columns: ['Sr No', 'Name', 'Role'],
  },
};

export const CP_PARTIAL_SEARCH_VALUES = {
  string: 'gsd',
  email: 'open-metadata',
  markdown: 'HEre',
  sqlQuery: 'Select',
  duration: 'P1Y',
  dateTimeCp: '025 21:5',
  timeCp: '5:04:0',
};

export const CP_RANGE_VALUES = {
  integer: { start: 60, end: 70 },
  number: { start: 50, end: 60 },
  dateCp: { start: '01-12-2025', end: '31-12-2025' },
  dateTimeCp: { start: '01-12-2025 00:00:00', end: '31-12-2025 23:59:59' },
  timeCp: { start: '00:00:00', end: '23:59:59' },
};

export const MULTISELECT_OPERATORS = [
  'multiselect_equals',
  'multiselect_not_equals',
  'multiselect_contains',
  'multiselect_not_contains',
];
