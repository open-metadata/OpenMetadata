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

export const RADIAN = Math.PI / 180;

const getRandomNumber = () => Math.floor(1000 + Math.random() * 9000);
const getRandomPercentage = () => Math.floor(Math.random() * 100) + 1;
const getRandomDate = () => {
  const start = new Date(2022, 0, 1);
  const end = new Date();

  const date = new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime())
  );

  return `${date.getMonth()}/${date.getDate()}`;
};

export const PIE_DATA = [
  { name: 'Tables', value: 40 },
  { name: 'Topics', value: 30 },
  { name: 'Dashboards', value: 30 },
  { name: 'Pipelines', value: 20 },
];

export const COLORS = ['#8884d8', '#82ca9d', '#9cc5e9', '#e99c9c'];

export const DAY_FILTER = [
  {
    key: '7',
    label: 'Last 7 Days',
  },
  {
    key: '24',
    label: 'Last 24 Days',
  },
  {
    key: '30',
    label: 'Last 30 Days',
  },
];

export const TEAM_FILTER = [
  {
    key: 'team1',
    label: 'Cloud Infra',
  },
  {
    key: 'team2',
    label: 'Payment',
  },
  {
    key: 'team3',
    label: 'OM Team',
  },
];

export const ORG_FILTER = [
  {
    key: 'org1',
    label: 'Organization1',
  },
  {
    key: 'org2',
    label: 'Organization2',
  },
  {
    key: 'org3',
    label: 'Organization3',
  },
];

export const SUMMARY_DATA = [
  {
    key: 'Total Entities',
    value: 897,
  },
  {
    key: 'Total Users',
    value: 26,
  },
  {
    key: 'Total Sessions',
    value: 151,
  },
  {
    key: 'Total Activity',
    value: 151,
  },
  {
    key: 'Total Activity Users',
    value: 20,
  },
  {
    key: 'Total Tables',
    value: 200,
  },
  {
    key: 'Total Topics',
    value: 150,
  },
  {
    key: 'Total Pipelines',
    value: 15,
  },
  {
    key: 'Total Dashboards',
    value: 120,
  },
  {
    key: 'Total Ml Models',
    value: 12,
  },
  {
    key: 'Total Test Cases',
    value: 123,
  },
];

export const ENTITIES_DATA = [
  {
    date: getRandomDate(),
    tables: getRandomNumber(),
    topics: getRandomNumber(),
    pipelines: getRandomNumber(),
    dashboards: getRandomNumber(),
  },
  {
    date: getRandomDate(),
    tables: getRandomNumber(),
    topics: getRandomNumber(),
    pipelines: getRandomNumber(),
    dashboards: getRandomNumber(),
  },
  {
    date: getRandomDate(),
    tables: getRandomNumber(),
    topics: getRandomNumber(),
    pipelines: getRandomNumber(),
    dashboards: getRandomNumber(),
  },
  {
    date: getRandomDate(),
    tables: getRandomNumber(),
    topics: getRandomNumber(),
    pipelines: getRandomNumber(),
    dashboards: getRandomNumber(),
  },
  {
    date: getRandomDate(),
    tables: getRandomNumber(),
    topics: getRandomNumber(),
    pipelines: getRandomNumber(),
    dashboards: getRandomNumber(),
  },
  {
    date: getRandomDate(),
    tables: getRandomNumber(),
    topics: getRandomNumber(),
    pipelines: getRandomNumber(),
    dashboards: getRandomNumber(),
  },
  {
    date: getRandomDate(),
    tables: getRandomNumber(),
    topics: getRandomNumber(),
    pipelines: getRandomNumber(),
    dashboards: getRandomNumber(),
  },
];
export const ENTITIES_DATA_DESCRIPTION_PERCENTAGE = [
  {
    date: getRandomDate(),
    tables: getRandomPercentage(),
    topics: getRandomPercentage(),
    pipelines: getRandomPercentage(),
    dashboards: getRandomPercentage(),
  },
  {
    date: getRandomDate(),
    tables: getRandomPercentage(),
    topics: getRandomPercentage(),
    pipelines: getRandomPercentage(),
    dashboards: getRandomPercentage(),
  },
  {
    date: getRandomDate(),
    tables: getRandomPercentage(),
    topics: getRandomPercentage(),
    pipelines: getRandomPercentage(),
    dashboards: getRandomPercentage(),
  },
  {
    date: getRandomDate(),
    tables: getRandomPercentage(),
    topics: getRandomPercentage(),
    pipelines: getRandomPercentage(),
    dashboards: getRandomPercentage(),
  },
  {
    date: getRandomDate(),
    tables: getRandomPercentage(),
    topics: getRandomPercentage(),
    pipelines: getRandomPercentage(),
    dashboards: getRandomPercentage(),
  },
  {
    date: getRandomDate(),
    tables: getRandomPercentage(),
    topics: getRandomPercentage(),
    pipelines: getRandomPercentage(),
    dashboards: getRandomPercentage(),
  },
  {
    date: getRandomDate(),
    tables: getRandomPercentage(),
    topics: getRandomPercentage(),
    pipelines: getRandomPercentage(),
    dashboards: getRandomPercentage(),
  },
];
