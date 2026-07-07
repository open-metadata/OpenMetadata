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
import { Table } from '@untitledui/icons';
import { startCase } from 'lodash';
import { SERVICE_FILTER_PATTERN_FIELDS } from '../../../../constants/ServiceConnection.constants';
import { ServiceConnectionFilterPatternFields } from '../../../../enums/ServiceConnection.enum';
import { ConfigData } from '../../../../interface/service.interface';
import {
  getFilteredSchema,
  getSnowflakeAccountDisplayHost,
} from '../../../../utils/ServiceConnectionUtils';
import {
  FILTER_ICONS,
  REGEX_SPECIAL_CHARS,
} from './FiltersConfigForm.constants';
import {
  FilterCondition,
  FilterPatternConfig,
  FilterSchemaProperty,
  FilterSectionState,
} from './FiltersConfigForm.types';

export const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

export const unescapeRegexLiteral = (value: string) =>
  value.replace(/\\([.*+?^${}()|[\]\\])/g, '$1');

export const hasUnescapedRegexSyntax = (value: string) => {
  let isEscaped = false;

  for (const character of value) {
    if (isEscaped) {
      isEscaped = false;

      continue;
    }

    if (character === '\\') {
      isEscaped = true;

      continue;
    }

    if (REGEX_SPECIAL_CHARS.has(character)) {
      return true;
    }
  }

  return isEscaped;
};

type PatternMatcher = {
  op: FilterCondition['op'];
  prefix: string;
  suffix: string;
};

const PATTERN_MATCHERS: PatternMatcher[] = [
  { op: 'is', prefix: '^', suffix: '$' },
  { op: 'contains', prefix: '^.*', suffix: '.*$' },
  { op: 'startsWith', prefix: '^', suffix: '.*$' },
  { op: 'endsWith', prefix: '^.*', suffix: '$' },
  { op: 'startsWith', prefix: '^', suffix: '.*' },
  { op: 'startsWith', prefix: '^', suffix: '' },
  { op: 'endsWith', prefix: '.*', suffix: '$' },
  { op: 'endsWith', prefix: '', suffix: '$' },
  { op: 'contains', prefix: '.*', suffix: '.*' },
  { op: 'contains', prefix: '', suffix: '' },
];

const tryMatchPattern = (
  pattern: string,
  regex: string,
  matcher: PatternMatcher
): FilterCondition | null => {
  const { prefix, suffix, op } = matcher;
  const hasPrefix = !prefix || pattern.startsWith(prefix);
  const hasSuffix = !suffix || pattern.endsWith(suffix);

  if (!hasPrefix || !hasSuffix) {
    return null;
  }

  const start = prefix.length;
  const end = suffix.length ? pattern.length - suffix.length : pattern.length;
  const inner = pattern.slice(start, end);

  if (hasUnescapedRegexSyntax(inner)) {
    return null;
  }

  return { op, sourceRegex: regex, value: unescapeRegexLiteral(inner) };
};

export const parseRegexPattern = (regex: string): FilterCondition => {
  const pattern = regex.trim();

  if (!pattern) {
    return { op: 'regex', sourceRegex: regex, value: regex };
  }

  for (const matcher of PATTERN_MATCHERS) {
    const result = tryMatchPattern(pattern, regex, matcher);

    if (result) {
      return result;
    }
  }

  return { op: 'regex', sourceRegex: regex, value: regex };
};

export const conditionToRegex = (condition: FilterCondition) => {
  if (condition.sourceRegex) {
    return condition.sourceRegex;
  }

  switch (condition.op) {
    case 'is':
      return `^${escapeRegex(condition.value)}$`;
    case 'startsWith':
      return `^${escapeRegex(condition.value)}`;
    case 'endsWith':
      return `${escapeRegex(condition.value)}$`;
    case 'contains':
      return escapeRegex(condition.value);
    case 'regex':
    default:
      return condition.value;
  }
};

export const conditionKey = (condition: FilterCondition) =>
  `${condition.op}:${conditionToRegex(condition).toLowerCase()}`;

export const isFilterPatternConfig = (
  value: unknown
): value is FilterPatternConfig => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return Array.isArray(record.includes) || Array.isArray(record.excludes);
};

export const isFilterSchemaProperty = (
  fieldName: string,
  property: unknown
): property is FilterSchemaProperty => {
  if (!property || typeof property !== 'object' || Array.isArray(property)) {
    return false;
  }

  const record = property as FilterSchemaProperty;
  const nestedProperties = record.properties ?? {};
  const isKnownField = SERVICE_FILTER_PATTERN_FIELDS.includes(
    fieldName as ServiceConnectionFilterPatternFields
  );
  const isFilterJavaType = record.javaType?.includes('FilterPattern') ?? false;
  const isFilterTitle = record.title?.includes('Filter Pattern') ?? false;
  const hasFilterShape = Boolean(
    nestedProperties.includes || nestedProperties.excludes
  );

  return isKnownField || isFilterJavaType || (isFilterTitle && hasFilterShape);
};

const getConfigRecord = (config: ConfigData) =>
  config as unknown as Record<string, unknown>;

export const getFilterPatternConfig = (
  config: ConfigData,
  fieldName: string
): FilterPatternConfig | undefined => {
  const value = getConfigRecord(config)[fieldName];

  return isFilterPatternConfig(value) ? value : undefined;
};

const getValueFromConfig = (config: ConfigData, keys: string[]) => {
  const configRecord = getConfigRecord(config);
  const matchedKey = keys.find((key) => typeof configRecord[key] === 'string');

  return matchedKey ? (configRecord[matchedKey] as string) : '';
};

export const getConnectionDisplayHost = (
  config: ConfigData,
  serviceType: string
) => {
  const configRecord = getConfigRecord(config);
  const account =
    typeof configRecord.account === 'string' ? configRecord.account.trim() : '';
  const host = getValueFromConfig(config, [
    'hostPort',
    'host',
    'server',
    'sourceUrl',
    'url',
    'hostName',
    'endpointURL',
  ]).trim();

  if (serviceType.toLowerCase() === 'snowflake' && account) {
    return getSnowflakeAccountDisplayHost(account);
  }

  return host || account || serviceType;
};

export const cleanSchemaTitle = (title: string, fieldName: string) => {
  const titleWithoutFilterPattern = title
    .replace(/^Default\s+/i, '')
    .replace(/\s+Filter Pattern$/i, '')
    .replace(/\s+filter pattern$/i, '')
    .trim();

  if (titleWithoutFilterPattern) {
    return titleWithoutFilterPattern;
  }

  return startCase(fieldName.replace(/FilterPattern$/i, ''));
};

export const pluralizeFallback = (label: string) => {
  if (label.endsWith('s')) {
    return label;
  }

  if (label.endsWith('y')) {
    return `${label.slice(0, -1)}ies`;
  }

  return `${label}s`;
};

export const singularizeFallback = (label: string) => {
  if (label.endsWith('ies')) {
    return `${label.slice(0, -3)}y`;
  }

  if (label.endsWith('s')) {
    return label.slice(0, -1);
  }

  return label;
};

export const getSectionIcon = (fieldName: string) =>
  FILTER_ICONS[fieldName as ServiceConnectionFilterPatternFields] ?? Table;

export const getOrderedFilterEntries = (
  properties: Record<string, unknown>
) => {
  const knownFilterFields = getFilteredSchema(properties, false);
  const fieldNames = Object.keys(properties).filter((fieldName) =>
    isFilterSchemaProperty(fieldName, properties[fieldName])
  );

  return fieldNames
    .toSorted((first, second) => {
      const firstKnownIndex = SERVICE_FILTER_PATTERN_FIELDS.indexOf(
        first as ServiceConnectionFilterPatternFields
      );
      const secondKnownIndex = SERVICE_FILTER_PATTERN_FIELDS.indexOf(
        second as ServiceConnectionFilterPatternFields
      );
      const normalizedFirstIndex =
        firstKnownIndex === -1
          ? SERVICE_FILTER_PATTERN_FIELDS.length + fieldNames.indexOf(first)
          : firstKnownIndex;
      const normalizedSecondIndex =
        secondKnownIndex === -1
          ? SERVICE_FILTER_PATTERN_FIELDS.length + fieldNames.indexOf(second)
          : secondKnownIndex;

      return normalizedFirstIndex - normalizedSecondIndex;
    })
    .map((fieldName) => [
      fieldName,
      knownFilterFields[fieldName] ?? properties[fieldName],
    ]);
};

export const addSnowflakeSystemExcludes = (
  serviceType: string,
  fieldName: string,
  excludes: string[]
) => {
  if (
    serviceType.toLowerCase() !== 'snowflake' ||
    fieldName !== ServiceConnectionFilterPatternFields.DATABASE_FILTER_PATTERN
  ) {
    return excludes;
  }

  const snowflakeSampleData = '^snowflake_sample_data$';

  return excludes.some(
    (exclude) => exclude.toLowerCase() === snowflakeSampleData
  )
    ? excludes
    : [...excludes, snowflakeSampleData];
};

export const buildPatternFromState = (filter: FilterSectionState) => ({
  excludes: filter.excludes.map(conditionToRegex),
  includes: filter.restrict ? filter.includes.map(conditionToRegex) : [],
});

export const removeConditionAtIndex = (
  conditions: FilterCondition[],
  indexToRemove: number
) => conditions.filter((_, index) => index !== indexToRemove);

export const getRuleLabelKey = (count: number) =>
  count === 1 ? 'label.rule-lowercase' : 'label.rule-lowercase-plural';

export const getSummaryPill = (filter: FilterSectionState) => {
  if (!filter.restrict && filter.excludes.length === 0) {
    return {
      textKey: 'message.filter-scope-scanning-all',
      tone: 'success' as const,
      values: {},
    };
  }

  if (!filter.restrict) {
    return {
      textKey:
        filter.excludes.length === 1
          ? 'message.filter-scope-exclude-rule-count'
          : 'message.filter-scope-exclude-rules-count',
      tone: 'info' as const,
      values: { count: filter.excludes.length },
    };
  }

  return {
    textKey:
      filter.includes.length === 1
        ? 'message.filter-scope-include-rule-count'
        : 'message.filter-scope-include-rules-count',
    tone: 'info' as const,
    values: { count: filter.includes.length },
  };
};

export const getScopeSummaryKey = (filter: FilterSectionState) => {
  if (filter.restrict && filter.excludes.length > 0) {
    return 'message.filter-scope-include-exclude-summary';
  }

  if (filter.restrict) {
    return 'message.filter-scope-include-summary';
  }

  if (filter.excludes.length > 0) {
    return 'message.filter-scope-exclude-summary';
  }

  return 'message.filter-scope-all-summary';
};
