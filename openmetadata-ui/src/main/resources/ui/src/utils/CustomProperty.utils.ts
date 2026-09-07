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
import { DateTime } from 'luxon';
import { ENTITY_PATH } from '../constants/constants';
import {
  DEFAULT_DATE_FORMAT,
  DEFAULT_DATE_TIME_FORMAT,
  DEFAULT_TIME_FORMAT,
  HYPERLINK_TYPE_CUSTOM_PROPERTY,
  SUPPORTED_DATE_TIME_FORMATS_ANTD_FORMAT_MAPPING,
  SUPPORTED_DATE_TIME_FORMATS_LUXON_FORMAT_MAPPING,
  TABLE_TYPE_CUSTOM_PROPERTY,
} from '../constants/CustomProperty.constants';
import { PAGE_HEADERS } from '../constants/PageHeaders.constant';
import { SearchIndex } from '../enums/search.enum';
import { CustomProperty, CustomPropertyConfig } from '../generated/entity/type';

type SerializedEntityReference = Record<string, unknown> & { type: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isEmptyExtensionValue = (value: unknown): boolean => {
  const isBlank = value === undefined || value === null || value === '';
  const isEmptyCollection =
    (Array.isArray(value) && value.length === 0) ||
    (isRecord(value) && Object.keys(value).length === 0);

  return isBlank || isEmptyCollection;
};

const unwrapPickerValue = (value: unknown): unknown =>
  isRecord(value) && 'value' in value ? value.value : value;

const isEntityReference = (
  value: unknown
): value is SerializedEntityReference =>
  isRecord(value) &&
  typeof value.type === 'string' &&
  (typeof value.id === 'string' ||
    typeof value.fullyQualifiedName === 'string');

const unwrapEntityReference = (
  value: unknown
): SerializedEntityReference | undefined => {
  if (isEntityReference(value)) {
    return value;
  }
  if (!isRecord(value)) {
    return undefined;
  }
  if (isEntityReference(value.reference)) {
    return value.reference;
  }

  return isEntityReference(value.value) ? value.value : undefined;
};

const toFiniteNumber = (raw: unknown): number | undefined => {
  const numericValue = Number(raw);

  return Number.isFinite(numericValue) ? numericValue : undefined;
};

const serializeTimeInterval = (
  raw: unknown
): Record<string, number> | undefined => {
  if (!isRecord(raw)) {
    return undefined;
  }

  const interval = Object.fromEntries(
    ['start', 'end']
      .filter((key) => !isEmptyExtensionValue(raw[key]))
      .map((key) => [key, toFiniteNumber(raw[key])])
      .filter(([, value]) => value !== undefined)
  );

  return isEmptyExtensionValue(interval) ? undefined : interval;
};

export const hasPopulatedTableRows = (value: unknown) =>
  isRecord(value) &&
  Array.isArray(value.rows) &&
  value.rows.some((row) => isRecord(row) && Object.values(row).some(Boolean));

const serializeTableValue = (raw: unknown): unknown =>
  hasPopulatedTableRows(raw) ? raw : undefined;

const serializeHyperlink = (
  raw: unknown
): Record<string, string> | undefined => {
  if (!isRecord(raw) || typeof raw.url !== 'string' || !raw.url) {
    return undefined;
  }

  return {
    url: raw.url,
    ...(typeof raw.displayText === 'string' && raw.displayText
      ? { displayText: raw.displayText }
      : {}),
  };
};

export const getCustomPropertyReferenceSearchIndex = (
  customProperty: CustomProperty
): SearchIndex => {
  const config = customProperty.customPropertyConfig?.config;

  if (Array.isArray(config) && config.length) {
    return config.join(',') as SearchIndex;
  }

  if (typeof config === 'string' && config.trim()) {
    return config as SearchIndex;
  }

  return SearchIndex.ALL;
};

export const getHyperlinkUrlValidationErrorKey = (
  value?: string
): 'message.invalid-url' | 'message.url-must-use-http-or-https' | undefined => {
  if (!value) {
    return undefined;
  }

  try {
    const parsedUrl = new URL(value);

    return ['http:', 'https:'].includes(parsedUrl.protocol)
      ? undefined
      : 'message.url-must-use-http-or-https';
  } catch {
    return 'message.invalid-url';
  }
};

const CUSTOM_PROPERTY_TYPE_NAME_SUFFIX = '-cp';

export const getCustomPropertyTypeDisplayName = (propertyTypeName?: string) => {
  if (!propertyTypeName) {
    return '';
  }

  const baseName = propertyTypeName.endsWith(CUSTOM_PROPERTY_TYPE_NAME_SUFFIX)
    ? propertyTypeName.slice(0, -CUSTOM_PROPERTY_TYPE_NAME_SUFFIX.length)
    : propertyTypeName;

  return baseName.toUpperCase();
};

const serializeEnumValue = (raw: unknown): unknown => {
  const values = Array.isArray(raw) ? raw : [raw];

  return values
    .map(unwrapPickerValue)
    .filter((value) => !isEmptyExtensionValue(value));
};

const serializeEntityReferenceList = (
  raw: unknown
): SerializedEntityReference[] =>
  (Array.isArray(raw) ? raw : [raw])
    .map(unwrapEntityReference)
    .filter(
      (reference): reference is SerializedEntityReference =>
        reference !== undefined
    );

// Dispatch table replacing a per-type switch: each entry is a pure
// `raw -> serialized` transform, keyed by `CustomProperty.propertyType.name`.
// Unknown/unmapped types fall through to the raw value, matching the
// previous switch's `default` branch.
const EXTENSION_VALUE_SERIALIZERS: Record<string, (raw: unknown) => unknown> = {
  integer: toFiniteNumber,
  number: toFiniteNumber,
  timestamp: toFiniteNumber,
  timeInterval: serializeTimeInterval,
  [TABLE_TYPE_CUSTOM_PROPERTY]: serializeTableValue,
  enum: serializeEnumValue,
  entityReference: unwrapEntityReference,
  entityReferenceList: serializeEntityReferenceList,
  [HYPERLINK_TYPE_CUSTOM_PROPERTY]: serializeHyperlink,
};

export const serializeExtensionValue = (
  definition: CustomProperty,
  raw: unknown
): unknown => {
  if (isEmptyExtensionValue(raw)) {
    return undefined;
  }

  const propertyType = definition.propertyType.name;
  const serializer = propertyType
    ? EXTENSION_VALUE_SERIALIZERS[propertyType]
    : undefined;
  const serializedValue = serializer ? serializer(raw) : raw;

  return isEmptyExtensionValue(serializedValue) ? undefined : serializedValue;
};

export const filterPopulatedTableRows = <T extends Record<string, unknown>>(
  rows: T[]
) => rows.filter((row) => Object.values(row).some(Boolean));

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

export const formatCustomPropertyDateTime = (
  value: DateTime,
  type: string,
  backendFormat: CustomPropertyConfig['config']
) => {
  const formattedValue = value
    .setLocale('en')
    .toFormat(getCustomPropertyLuxonFormat(type, backendFormat));

  return backendFormat === 'yyyy-MM-dd HH:mm:ss.SSSSSS'
    ? `${formattedValue}000`
    : formattedValue;
};

export const parseCustomPropertyDateTime = (
  value: string,
  type: string,
  backendFormat: CustomPropertyConfig['config']
) =>
  DateTime.fromFormat(
    value,
    getCustomPropertyLuxonFormat(type, backendFormat),
    { locale: 'en' }
  );

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

// Lookup table replacing a per-entity-type switch; unmapped entity types fall
// through to the tables header, matching the previous switch's `default`. Built
// lazily on first use because ENTITY_PATH is populated through a circular import
// and is not yet defined when this module is first evaluated.
let customPropertyPageHeaderByEntityPath:
  | Record<string, PageHeader>
  | undefined;

const getCustomPropertyPageHeaderByEntityPath = (): Record<
  string,
  PageHeader
> => {
  if (!customPropertyPageHeaderByEntityPath) {
    customPropertyPageHeaderByEntityPath = {
      [ENTITY_PATH.tables]: PAGE_HEADERS.TABLES_CUSTOM_ATTRIBUTES,
      [ENTITY_PATH.topics]: PAGE_HEADERS.TOPICS_CUSTOM_ATTRIBUTES,
      [ENTITY_PATH.dashboards]: PAGE_HEADERS.DASHBOARD_CUSTOM_ATTRIBUTES,
      [ENTITY_PATH.dashboardDataModels]:
        PAGE_HEADERS.DASHBOARD_DATA_MODEL_CUSTOM_ATTRIBUTES,
      [ENTITY_PATH.dataProducts]: PAGE_HEADERS.DATA_PRODUCT_CUSTOM_ATTRIBUTES,
      [ENTITY_PATH.metrics]: PAGE_HEADERS.METRIC_CUSTOM_ATTRIBUTES,
      [ENTITY_PATH.pipelines]: PAGE_HEADERS.PIPELINES_CUSTOM_ATTRIBUTES,
      [ENTITY_PATH.mlmodels]: PAGE_HEADERS.ML_MODELS_CUSTOM_ATTRIBUTES,
      [ENTITY_PATH.containers]: PAGE_HEADERS.CONTAINER_CUSTOM_ATTRIBUTES,
      [ENTITY_PATH.searchIndexes]: PAGE_HEADERS.SEARCH_INDEX_CUSTOM_ATTRIBUTES,
      [ENTITY_PATH.storedProcedures]:
        PAGE_HEADERS.STORED_PROCEDURE_CUSTOM_ATTRIBUTES,
      [ENTITY_PATH.domains]: PAGE_HEADERS.DOMAIN_CUSTOM_ATTRIBUTES,
      [ENTITY_PATH.glossaryTerm]: PAGE_HEADERS.GLOSSARY_TERM_CUSTOM_ATTRIBUTES,
      [ENTITY_PATH.databases]: PAGE_HEADERS.DATABASE_CUSTOM_ATTRIBUTES,
      [ENTITY_PATH.databaseSchemas]:
        PAGE_HEADERS.DATABASE_SCHEMA_CUSTOM_ATTRIBUTES,
      [ENTITY_PATH.apiEndpoints]: PAGE_HEADERS.API_ENDPOINT_CUSTOM_ATTRIBUTES,
      [ENTITY_PATH.apiCollections]:
        PAGE_HEADERS.API_COLLECTION_CUSTOM_ATTRIBUTES,
      [ENTITY_PATH.charts]: PAGE_HEADERS.CHARTS_CUSTOM_ATTRIBUTES,
      [ENTITY_PATH.directories]: PAGE_HEADERS.DIRECTORY_CUSTOM_ATTRIBUTES,
      [ENTITY_PATH.files]: PAGE_HEADERS.FILE_CUSTOM_ATTRIBUTES,
      [ENTITY_PATH.spreadsheets]: PAGE_HEADERS.SPREADSHEET_CUSTOM_ATTRIBUTES,
      [ENTITY_PATH.worksheets]: PAGE_HEADERS.WORKSHEET_CUSTOM_ATTRIBUTES,
      [ENTITY_PATH.column]: PAGE_HEADERS.COLUMN_CUSTOM_ATTRIBUTES,
    };
  }

  return customPropertyPageHeaderByEntityPath;
};

export const getCustomPropertyPageHeaderFromEntity = (
  entityType: string
): PageHeader =>
  getCustomPropertyPageHeaderByEntityPath()[entityType] ??
  PAGE_HEADERS.TABLES_CUSTOM_ATTRIBUTES;

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
