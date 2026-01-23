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
import { ENTITY_PATH } from '../constants/constants';
import {
  DEFAULT_DATE_FORMAT,
  DEFAULT_DATE_TIME_FORMAT,
  DEFAULT_TIME_FORMAT,
  SUPPORTED_DATE_TIME_FORMATS_ANTD_FORMAT_MAPPING,
  SUPPORTED_DATE_TIME_FORMATS_LUXON_FORMAT_MAPPING,
} from '../constants/CustomProperty.constants';
import { PAGE_HEADERS } from '../constants/PageHeaders.constant';
import { CustomPropertyConfig } from '../generated/entity/type';

export const getCustomPropertyEntityPathname = (entityType: string) => {
  const entityPathEntries = Object.entries(ENTITY_PATH);
  const entityPath = entityPathEntries.find(([, path]) => path === entityType);

  return entityPath ? entityPath[0] : '';
};

export const getCustomPropertyDateTimeDefaultFormat = (type: string) => {
  switch (type) {
    case 'date-cp':
      return DEFAULT_DATE_FORMAT;
    case 'dateTime-cp':
      return DEFAULT_DATE_TIME_FORMAT;
    case 'time-cp':
      return DEFAULT_TIME_FORMAT;
    default:
      return '';
  }
};

export const getCustomPropertyLuxonFormat = (
  type: string,
  backendFormat: CustomPropertyConfig['config']
) => {
  const format =
    SUPPORTED_DATE_TIME_FORMATS_LUXON_FORMAT_MAPPING[
      backendFormat as string as keyof typeof SUPPORTED_DATE_TIME_FORMATS_LUXON_FORMAT_MAPPING
    ] ??
    backendFormat ??
    getCustomPropertyDateTimeDefaultFormat(type);

  return format;
};

export const getCustomPropertyMomentFormat = (
  type: string,
  backendFormat: CustomPropertyConfig['config']
) => {
  const defaultFormat = getCustomPropertyDateTimeDefaultFormat(type);

  const format =
    SUPPORTED_DATE_TIME_FORMATS_ANTD_FORMAT_MAPPING[
      ((backendFormat as string) ??
        defaultFormat) as keyof typeof SUPPORTED_DATE_TIME_FORMATS_ANTD_FORMAT_MAPPING
    ] ??
    SUPPORTED_DATE_TIME_FORMATS_ANTD_FORMAT_MAPPING[
      defaultFormat as keyof typeof SUPPORTED_DATE_TIME_FORMATS_ANTD_FORMAT_MAPPING
    ];

  return format;
};

interface PageHeader {
  header: string;
  subHeader: string;
  subHeaderParams?: Record<string, string>;
}

export const getCustomPropertyPageHeaderFromEntity = (
  entityType: string
): PageHeader => {
  switch (entityType) {
    case ENTITY_PATH.tables:
      return PAGE_HEADERS.TABLES_CUSTOM_ATTRIBUTES;

    case ENTITY_PATH.topics:
      return PAGE_HEADERS.TOPICS_CUSTOM_ATTRIBUTES;

    case ENTITY_PATH.dashboards:
      return PAGE_HEADERS.DASHBOARD_CUSTOM_ATTRIBUTES;

    case ENTITY_PATH.dashboardDataModels:
      return PAGE_HEADERS.DASHBOARD_DATA_MODEL_CUSTOM_ATTRIBUTES;

    case ENTITY_PATH.dataProducts:
      return PAGE_HEADERS.DATA_PRODUCT_CUSTOM_ATTRIBUTES;

    case ENTITY_PATH.metrics:
      return PAGE_HEADERS.METRIC_CUSTOM_ATTRIBUTES;

    case ENTITY_PATH.pipelines:
      return PAGE_HEADERS.PIPELINES_CUSTOM_ATTRIBUTES;

    case ENTITY_PATH.mlmodels:
      return PAGE_HEADERS.ML_MODELS_CUSTOM_ATTRIBUTES;

    case ENTITY_PATH.containers:
      return PAGE_HEADERS.CONTAINER_CUSTOM_ATTRIBUTES;

    case ENTITY_PATH.searchIndexes:
      return PAGE_HEADERS.SEARCH_INDEX_CUSTOM_ATTRIBUTES;

    case ENTITY_PATH.storedProcedures:
      return PAGE_HEADERS.STORED_PROCEDURE_CUSTOM_ATTRIBUTES;

    case ENTITY_PATH.domains:
      return PAGE_HEADERS.DOMAIN_CUSTOM_ATTRIBUTES;

    case ENTITY_PATH.glossaryTerm:
      return PAGE_HEADERS.GLOSSARY_TERM_CUSTOM_ATTRIBUTES;

    case ENTITY_PATH.databases:
      return PAGE_HEADERS.DATABASE_CUSTOM_ATTRIBUTES;

    case ENTITY_PATH.databaseSchemas:
      return PAGE_HEADERS.DATABASE_SCHEMA_CUSTOM_ATTRIBUTES;

    case ENTITY_PATH.apiEndpoints:
      return PAGE_HEADERS.API_ENDPOINT_CUSTOM_ATTRIBUTES;

    case ENTITY_PATH.apiCollections:
      return PAGE_HEADERS.API_COLLECTION_CUSTOM_ATTRIBUTES;

    case ENTITY_PATH.charts:
      return PAGE_HEADERS.CHARTS_CUSTOM_ATTRIBUTES;

    case ENTITY_PATH.directories:
      return PAGE_HEADERS.DIRECTORY_CUSTOM_ATTRIBUTES;

    case ENTITY_PATH.files:
      return PAGE_HEADERS.FILE_CUSTOM_ATTRIBUTES;

    case ENTITY_PATH.spreadsheets:
      return PAGE_HEADERS.SPREADSHEET_CUSTOM_ATTRIBUTES;

    case ENTITY_PATH.worksheets:
      return PAGE_HEADERS.WORKSHEET_CUSTOM_ATTRIBUTES;

    case ENTITY_PATH.column:
      return PAGE_HEADERS.COLUMN_CUSTOM_ATTRIBUTES;

    default:
      return PAGE_HEADERS.TABLES_CUSTOM_ATTRIBUTES;
  }
};

export const formatTableCellValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '-';
  }

  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    const objVal = value as Record<string, unknown>;
    if (objVal.name || objVal.displayName) {
      return String(objVal.name || objVal.displayName);
    }
    if (objVal.value !== undefined) {
      return String(objVal.value);
    }

    return JSON.stringify(value);
  }

  return String(value);
};
