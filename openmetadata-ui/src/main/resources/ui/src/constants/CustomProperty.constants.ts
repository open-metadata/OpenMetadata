/*
 *  Copyright 2024 Collate.
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
export const PROPERTY_TYPES_WITH_FORMAT = ['date-cp', 'dateTime-cp', 'time-cp'];

export const PROPERTY_TYPES_WITH_ENTITY_REFERENCE = [
  'entityReference',
  'entityReferenceList',
];

export const ENTITY_REFERENCE_OPTIONS = [
  {
    key: 'table',
    value: 'table',
    label: 'Table',
  },
  {
    key: 'storedProcedure',
    value: 'storedProcedure',
    label: 'Stored Procedure',
  },
  {
    key: 'databaseSchema',
    value: 'databaseSchema',
    label: 'Database Schema',
  },
  {
    key: 'database',
    value: 'database',
    label: 'Database',
  },
  {
    key: 'dashboard',
    value: 'dashboard',
    label: 'Dashboard',
  },
  {
    key: 'dashboardDataModel',
    value: 'dashboardDataModel',
    label: 'Dashboard DataModel',
  },
  {
    key: 'pipeline',
    value: 'pipeline',
    label: 'Pipeline',
  },
  {
    key: 'topic',
    value: 'topic',
    label: 'Topic',
  },
  {
    key: 'container',
    value: 'container',
    label: 'Container',
  },
  {
    key: 'searchIndex',
    value: 'searchIndex',
    label: 'Search Index',
  },
  {
    key: 'mlmodel',
    value: 'mlmodel',
    label: 'MLmodel',
  },
  {
    key: 'glossaryTerm',
    value: 'glossaryTerm',
    label: 'Glossary Term',
  },
  {
    key: 'tag',
    value: 'tag',
    label: 'Tag',
  },
  {
    key: 'user',
    value: 'user',
    label: 'User',
  },
  {
    key: 'team',
    value: 'team',
    label: 'Team',
  },
];

// supported date formats on backend
export const SUPPORTED_DATE_FORMATS = [
  'yyyy-MM-dd',
  'dd MMM yyyy',
  'MM/dd/yyyy',
  'dd/MM/yyyy',
  'dd-MM-yyyy',
  'yyyyDDD',
  'd MMMM yyyy',
];

// supported date time formats on backend
export const SUPPORTED_DATE_TIME_FORMATS = [
  'MMM dd HH:mm:ss yyyy',
  'yyyy-MM-dd HH:mm:ss',
  'MM/dd/yyyy HH:mm:ss',
  'dd/MM/yyyy HH:mm:ss',
  'dd-MM-yyyy HH:mm:ss',
  'yyyy-MM-dd HH:mm:ss.SSS',
  'yyyy-MM-dd HH:mm:ss.SSSSSS',
  'dd MMMM yyyy HH:mm:ss',
];

// supported time formats on backend
export const SUPPORTED_TIME_FORMATS = ['HH:mm:ss'];

export const SUPPORTED_FORMAT_MAP = {
  'date-cp': SUPPORTED_DATE_FORMATS,
  'dateTime-cp': SUPPORTED_DATE_TIME_FORMATS,
  'time-cp': SUPPORTED_TIME_FORMATS,
};
