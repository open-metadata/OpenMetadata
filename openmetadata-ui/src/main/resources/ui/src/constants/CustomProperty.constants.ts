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

import { ReactComponent as DateTimeIcon } from '../assets/svg/customproperties/date-time.svg';
import { ReactComponent as DateIcon } from '../assets/svg/customproperties/date.svg';
import { ReactComponent as DurationIcon } from '../assets/svg/customproperties/duration.svg';
import { ReactComponent as EmailIcon } from '../assets/svg/customproperties/email.svg';
import { ReactComponent as EntityReferenceListIcon } from '../assets/svg/customproperties/entity-list.svg';
import { ReactComponent as EntityReferenceIcon } from '../assets/svg/customproperties/entity.svg';
import { ReactComponent as EnumIcon } from '../assets/svg/customproperties/enum.svg';
import { ReactComponent as IntegerIcon } from '../assets/svg/customproperties/integer.svg';
import { ReactComponent as MarkDownIcon } from '../assets/svg/customproperties/markdown.svg';
import { ReactComponent as NumberIcon } from '../assets/svg/customproperties/number.svg';
import { ReactComponent as SQLQueryIcon } from '../assets/svg/customproperties/sql-query.svg';
import { ReactComponent as StringIcon } from '../assets/svg/customproperties/string.svg';
import { ReactComponent as TableIcon } from '../assets/svg/customproperties/table.svg';
import { ReactComponent as TimeIntervalIcon } from '../assets/svg/customproperties/time-interval.svg';
import { ReactComponent as TimeIcon } from '../assets/svg/customproperties/time.svg';
import { ReactComponent as TimestampIcon } from '../assets/svg/customproperties/timestamp.svg';

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
  {
    key: 'matric',
    value: 'matric',
    label: 'Matric',
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

export const DEFAULT_TIME_FORMAT = 'HH:mm:ss';
export const DEFAULT_DATE_FORMAT = 'yyyy-MM-dd';
export const DEFAULT_DATE_TIME_FORMAT = 'yyyy-MM-dd HH:mm:ss';

export const SUPPORTED_FORMAT_MAP = {
  'date-cp': SUPPORTED_DATE_FORMATS,
  'dateTime-cp': SUPPORTED_DATE_TIME_FORMATS,
  'time-cp': SUPPORTED_TIME_FORMATS,
};

export const TABLE_TYPE_CUSTOM_PROPERTY = 'table-cp';

export const CUSTOM_PROPERTIES_ICON_MAP = {
  'date-cp': DateIcon,
  'dateTime-cp': DateTimeIcon,
  duration: DurationIcon,
  email: EmailIcon,
  entityReference: EntityReferenceIcon,
  entityReferenceList: EntityReferenceListIcon,
  enum: EnumIcon,
  integer: IntegerIcon,
  markdown: MarkDownIcon,
  number: NumberIcon,
  sqlQuery: SQLQueryIcon,
  string: StringIcon,
  'table-cp': TableIcon,
  'time-cp': TimeIcon,
  timeInterval: TimeIntervalIcon,
  timestamp: TimestampIcon,
};
