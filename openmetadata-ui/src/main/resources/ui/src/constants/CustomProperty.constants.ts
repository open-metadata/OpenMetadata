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

import {
  Clock,
  ClockStopwatch,
  DateTimeType,
  DateType,
  EntityReferenceListType,
  EntityReferenceType,
  EnumType,
  Hourglass01,
  IntegerType,
  Link03,
  Mail01,
  MarkdownType,
  NumberType,
  SqlQueryType,
  StringType,
  Table,
  TimestampType,
} from '@openmetadata/ui-core-components/icons';

export const PROPERTY_TYPES_WITH_FORMAT = ['date-cp', 'dateTime-cp', 'time-cp'];

// Enums can carry thousands of values; rendering one removable tag per value
// in the edit forms blocks the main thread for seconds.
export const ENUM_CONFIG_MAX_VISIBLE_VALUES = 20;

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
  {
    key: 'metric',
    value: 'metric',
    label: 'Metric',
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

export const SUPPORTED_DATE_TIME_FORMATS_ANTD_FORMAT_MAPPING = {
  'yyyy-MM-dd': 'YYYY-MM-DD',
  'dd MMM yyyy': 'DD MMM YYYY',
  'MM/dd/yyyy': 'MM/DD/YYYY',
  'dd/MM/yyyy': 'DD/MM/YYYY',
  'dd-MM-yyyy': 'DD-MM-YYYY',
  yyyyDDD: 'YYYYDDD',
  'd MMMM yyyy': 'D MMMM YYYY',
  'MMM dd HH:mm:ss yyyy': 'MMM DD HH:mm:ss YYYY',
  'yyyy-MM-dd HH:mm:ss': 'YYYY-MM-DD HH:mm:ss',
  'MM/dd/yyyy HH:mm:ss': 'MM/DD/YYYY HH:mm:ss',
  'dd/MM/yyyy HH:mm:ss': 'DD/MM/YYYY HH:mm:ss',
  'dd-MM-yyyy HH:mm:ss': 'DD-MM-YYYY HH:mm:ss',
  'yyyy-MM-dd HH:mm:ss.SSS': 'YYYY-MM-DD HH:mm:ss.SSS',
  'yyyy-MM-dd HH:mm:ss.SSSSSS': 'YYYY-MM-DD HH:mm:ss.SSSSSS',
  'dd MMMM yyyy HH:mm:ss': 'DD MMMM YYYY HH:mm:ss',
  'HH:mm:ss': 'HH:mm:ss',
};

export const SUPPORTED_DATE_TIME_FORMATS_LUXON_FORMAT_MAPPING = {
  yyyyDDD: 'yyyyo',
  'yyyy-MM-dd HH:mm:ss.SSSSSS': 'yyyy-MM-dd HH:mm:ss.u',
};

export const DEFAULT_TIME_FORMAT = 'HH:mm:ss';
export const DEFAULT_DATE_FORMAT = 'yyyy-MM-dd';
export const DEFAULT_DATE_TIME_FORMAT = 'yyyy-MM-dd HH:mm:ss';

export const SUPPORTED_FORMAT_MAP = {
  'date-cp': SUPPORTED_DATE_FORMATS,
  'dateTime-cp': SUPPORTED_DATE_TIME_FORMATS,
  'time-cp': SUPPORTED_TIME_FORMATS,
};

export const TABLE_TYPE_CUSTOM_PROPERTY = 'table-cp';

export const HYPERLINK_TYPE_CUSTOM_PROPERTY = 'hyperlink-cp';

export const CUSTOM_PROPERTIES_ICON_MAP: Partial<Record<string, typeof Table>> =
  {
    'date-cp': DateType,
    'dateTime-cp': DateTimeType,
    duration: Hourglass01,
    email: Mail01,
    entityReference: EntityReferenceType,
    entityReferenceList: EntityReferenceListType,
    enum: EnumType,
    'hyperlink-cp': Link03,
    integer: IntegerType,
    markdown: MarkdownType,
    number: NumberType,
    sqlQuery: SqlQueryType,
    string: StringType,
    'table-cp': Table,
    'time-cp': Clock,
    timeInterval: ClockStopwatch,
    timestamp: TimestampType,
  };
