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
import { Button, Select } from '@openmetadata/ui-core-components';
import { IChangeEvent } from '@rjsf/core';
import {
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Code01,
  Database01,
  Eye,
  FileCode01,
  FolderCode,
  LayersThree01,
  Plus,
  Table,
  XClose,
} from '@untitledui/icons';
import { isEmpty, isUndefined, startCase } from 'lodash';
import {
  ComponentType,
  KeyboardEvent,
  SVGProps,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { SERVICE_FILTER_PATTERN_FIELDS } from '../../../../constants/ServiceConnection.constants';
import { ServiceConnectionFilterPatternFields } from '../../../../enums/ServiceConnection.enum';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { ConfigData } from '../../../../interface/service.interface';
import { formatFormDataForSubmit } from '../../../../utils/JSONSchemaFormUtils';
import {
  buildValidConfig,
  ConnectionSchemaResult,
  EMPTY_CONNECTION_SCHEMA,
  getFilteredSchema,
  getSnowflakeAccountDisplayHost,
  loadConnectionSchema,
} from '../../../../utils/ServiceConnectionUtils';
import InlineAlert from '../../../common/InlineAlert/InlineAlert';
import { FiltersConfigFormProps } from './FiltersConfigForm.interface';

type IconComponent = ComponentType<
  SVGProps<SVGSVGElement> & {
    size?: number;
  }
>;

type FilterOperator = 'contains' | 'endsWith' | 'is' | 'regex' | 'startsWith';

interface FilterCondition {
  op: FilterOperator;
  sourceRegex?: string;
  value: string;
}

interface FilterPatternConfig {
  excludes?: string[];
  includes?: string[];
}

interface FilterSchemaProperty {
  default?: FilterPatternConfig;
  description?: string;
  javaType?: string;
  properties?: Record<string, unknown>;
  title?: string;
  type?: string;
}

interface FilterSection {
  description?: string;
  fieldName: string;
  icon: IconComponent;
  label: string;
  singleLabel: string;
  systemExcludes: FilterCondition[];
}

interface FilterSectionState {
  excludes: FilterCondition[];
  includes: FilterCondition[];
  restrict: boolean;
}

type FiltersState = Record<string, FilterSectionState>;

const FILTER_LABEL_KEYS: Partial<
  Record<ServiceConnectionFilterPatternFields, string>
> = {
  [ServiceConnectionFilterPatternFields.API_COLLECTION_FILTER_PATTERN]:
    'label.api-collection-plural',
  [ServiceConnectionFilterPatternFields.CHART_FILTER_PATTERN]:
    'label.chart-plural',
  [ServiceConnectionFilterPatternFields.CLASSIFICATION_FILTER_PATTERN]:
    'label.classification-plural',
  [ServiceConnectionFilterPatternFields.CONTAINER_FILTER_PATTERN]:
    'label.container-plural',
  [ServiceConnectionFilterPatternFields.DASHBOARD_FILTER_PATTERN]:
    'label.dashboard-plural',
  [ServiceConnectionFilterPatternFields.DATA_MODEL_FILTER_PATTERN]:
    'label.data-model-plural',
  [ServiceConnectionFilterPatternFields.DATABASE_FILTER_PATTERN]:
    'label.database-plural',
  [ServiceConnectionFilterPatternFields.DIRECTORY_FILTER_PATTERN]:
    'label.directory-plural',
  [ServiceConnectionFilterPatternFields.FILE_FILTER_PATTERN]:
    'label.file-plural',
  [ServiceConnectionFilterPatternFields.ML_MODEL_FILTER_PATTERN]:
    'label.ml-model-plural',
  [ServiceConnectionFilterPatternFields.PIPELINE_FILTER_PATTERN]:
    'label.pipeline-plural',
  [ServiceConnectionFilterPatternFields.PROJECT_FILTER_PATTERN]:
    'label.project-plural',
  [ServiceConnectionFilterPatternFields.SCHEMA_FILTER_PATTERN]:
    'label.schema-plural',
  [ServiceConnectionFilterPatternFields.SEARCH_INDEX_FILTER_PATTERN]:
    'label.search-index-plural',
  [ServiceConnectionFilterPatternFields.SPREADSHEET_FILTER_PATTERN]:
    'label.spreadsheet-plural',
  [ServiceConnectionFilterPatternFields.STORED_PROCEDURE_FILTER_PATTERN]:
    'label.stored-procedure-plural',
  [ServiceConnectionFilterPatternFields.TABLE_FILTER_PATTERN]:
    'label.table-plural',
  [ServiceConnectionFilterPatternFields.TOPIC_FILTER_PATTERN]:
    'label.topic-plural',
  [ServiceConnectionFilterPatternFields.WORKSHEET_FILTER_PATTERN]:
    'label.worksheet-plural',
};

const FILTER_SINGLE_LABEL_KEYS: Partial<
  Record<ServiceConnectionFilterPatternFields, string>
> = {
  [ServiceConnectionFilterPatternFields.API_COLLECTION_FILTER_PATTERN]:
    'label.api-collection',
  [ServiceConnectionFilterPatternFields.CHART_FILTER_PATTERN]: 'label.chart',
  [ServiceConnectionFilterPatternFields.CLASSIFICATION_FILTER_PATTERN]:
    'label.classification',
  [ServiceConnectionFilterPatternFields.CONTAINER_FILTER_PATTERN]:
    'label.container',
  [ServiceConnectionFilterPatternFields.DASHBOARD_FILTER_PATTERN]:
    'label.dashboard',
  [ServiceConnectionFilterPatternFields.DATA_MODEL_FILTER_PATTERN]:
    'label.data-model',
  [ServiceConnectionFilterPatternFields.DATABASE_FILTER_PATTERN]:
    'label.database',
  [ServiceConnectionFilterPatternFields.DIRECTORY_FILTER_PATTERN]:
    'label.directory',
  [ServiceConnectionFilterPatternFields.FILE_FILTER_PATTERN]: 'label.file',
  [ServiceConnectionFilterPatternFields.ML_MODEL_FILTER_PATTERN]:
    'label.ml-model',
  [ServiceConnectionFilterPatternFields.PIPELINE_FILTER_PATTERN]:
    'label.pipeline',
  [ServiceConnectionFilterPatternFields.PROJECT_FILTER_PATTERN]:
    'label.project',
  [ServiceConnectionFilterPatternFields.SCHEMA_FILTER_PATTERN]: 'label.schema',
  [ServiceConnectionFilterPatternFields.SEARCH_INDEX_FILTER_PATTERN]:
    'label.search-index',
  [ServiceConnectionFilterPatternFields.SPREADSHEET_FILTER_PATTERN]:
    'label.spreadsheet',
  [ServiceConnectionFilterPatternFields.STORED_PROCEDURE_FILTER_PATTERN]:
    'label.stored-procedure',
  [ServiceConnectionFilterPatternFields.TABLE_FILTER_PATTERN]: 'label.table',
  [ServiceConnectionFilterPatternFields.TOPIC_FILTER_PATTERN]: 'label.topic',
  [ServiceConnectionFilterPatternFields.WORKSHEET_FILTER_PATTERN]:
    'label.worksheet',
};

const FILTER_ICONS: Partial<
  Record<ServiceConnectionFilterPatternFields, IconComponent>
> = {
  [ServiceConnectionFilterPatternFields.API_COLLECTION_FILTER_PATTERN]:
    FileCode01,
  [ServiceConnectionFilterPatternFields.DATABASE_FILTER_PATTERN]: Database01,
  [ServiceConnectionFilterPatternFields.DIRECTORY_FILTER_PATTERN]: FolderCode,
  [ServiceConnectionFilterPatternFields.FILE_FILTER_PATTERN]: FileCode01,
  [ServiceConnectionFilterPatternFields.SCHEMA_FILTER_PATTERN]: LayersThree01,
  [ServiceConnectionFilterPatternFields.STORED_PROCEDURE_FILTER_PATTERN]:
    Code01,
  [ServiceConnectionFilterPatternFields.TABLE_FILTER_PATTERN]: Table,
};

const OPERATOR_LABEL_KEYS: Record<FilterOperator, string> = {
  contains: 'label.contains-lowercase',
  endsWith: 'label.ends-with',
  is: 'label.is-exactly',
  regex: 'label.matches-regex',
  startsWith: 'label.starts-with',
};

const FORM_TEST_ID = 'filters-config-form';
const REGEX_SPECIAL_CHARS = new Set([
  '.',
  '*',
  '+',
  '?',
  '^',
  '$',
  '{',
  '}',
  '(',
  ')',
  '|',
  '[',
  ']',
]);

const cx = (...classes: Array<string | false | undefined>) =>
  classes.filter(Boolean).join(' ');

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const unescapeRegexLiteral = (value: string) =>
  value.replace(/\\([.*+?^${}()|[\]\\])/g, '$1');

const hasUnescapedRegexSyntax = (value: string) => {
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

const parseRegexPattern = (regex: string): FilterCondition => {
  const pattern = regex.trim();

  if (!pattern) {
    return {
      op: 'regex',
      sourceRegex: regex,
      value: regex,
    };
  }

  if (pattern.startsWith('^') && pattern.endsWith('$')) {
    const value = pattern.slice(1, -1);

    if (!hasUnescapedRegexSyntax(value)) {
      return {
        op: 'is',
        sourceRegex: regex,
        value: unescapeRegexLiteral(value),
      };
    }
  }

  if (pattern.startsWith('^.*') && pattern.endsWith('.*$')) {
    const value = pattern.slice(3, -3);

    if (!hasUnescapedRegexSyntax(value)) {
      return {
        op: 'contains',
        sourceRegex: regex,
        value: unescapeRegexLiteral(value),
      };
    }
  }

  if (pattern.startsWith('^') && pattern.endsWith('.*$')) {
    const value = pattern.slice(1, -3);

    if (!hasUnescapedRegexSyntax(value)) {
      return {
        op: 'startsWith',
        sourceRegex: regex,
        value: unescapeRegexLiteral(value),
      };
    }
  }

  if (pattern.startsWith('^.*') && pattern.endsWith('$')) {
    const value = pattern.slice(3, -1);

    if (!hasUnescapedRegexSyntax(value)) {
      return {
        op: 'endsWith',
        sourceRegex: regex,
        value: unescapeRegexLiteral(value),
      };
    }
  }

  if (pattern.startsWith('^') && pattern.endsWith('.*')) {
    const value = pattern.slice(1, -2);

    if (!hasUnescapedRegexSyntax(value)) {
      return {
        op: 'startsWith',
        sourceRegex: regex,
        value: unescapeRegexLiteral(value),
      };
    }
  }

  if (pattern.startsWith('^')) {
    const value = pattern.slice(1);

    if (!hasUnescapedRegexSyntax(value)) {
      return {
        op: 'startsWith',
        sourceRegex: regex,
        value: unescapeRegexLiteral(value),
      };
    }
  }

  if (pattern.startsWith('.*') && pattern.endsWith('$')) {
    const value = pattern.slice(2, -1);

    if (!hasUnescapedRegexSyntax(value)) {
      return {
        op: 'endsWith',
        sourceRegex: regex,
        value: unescapeRegexLiteral(value),
      };
    }
  }

  if (pattern.endsWith('$')) {
    const value = pattern.slice(0, -1);

    if (!hasUnescapedRegexSyntax(value)) {
      return {
        op: 'endsWith',
        sourceRegex: regex,
        value: unescapeRegexLiteral(value),
      };
    }
  }

  if (pattern.startsWith('.*') && pattern.endsWith('.*')) {
    const value = pattern.slice(2, -2);

    if (!hasUnescapedRegexSyntax(value)) {
      return {
        op: 'contains',
        sourceRegex: regex,
        value: unescapeRegexLiteral(value),
      };
    }
  }

  if (!hasUnescapedRegexSyntax(pattern)) {
    return {
      op: 'contains',
      sourceRegex: regex,
      value: unescapeRegexLiteral(pattern),
    };
  }

  return {
    op: 'regex',
    sourceRegex: regex,
    value: regex,
  };
};

const conditionToRegex = (condition: FilterCondition) => {
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

const conditionKey = (condition: FilterCondition) =>
  `${condition.op}:${conditionToRegex(condition).toLowerCase()}`;

const isFilterPatternConfig = (
  value: unknown
): value is FilterPatternConfig => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return Array.isArray(record.includes) || Array.isArray(record.excludes);
};

const isFilterSchemaProperty = (
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

const getFilterPatternConfig = (
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

const getConnectionDisplayHost = (config: ConfigData, serviceType: string) => {
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

const cleanSchemaTitle = (title: string, fieldName: string) => {
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

const pluralizeFallback = (label: string) => {
  if (label.endsWith('s')) {
    return label;
  }

  if (label.endsWith('y')) {
    return `${label.slice(0, -1)}ies`;
  }

  return `${label}s`;
};

const singularizeFallback = (label: string) => {
  if (label.endsWith('ies')) {
    return `${label.slice(0, -3)}y`;
  }

  if (label.endsWith('s')) {
    return label.slice(0, -1);
  }

  return label;
};

const getSectionIcon = (fieldName: string) =>
  FILTER_ICONS[fieldName as ServiceConnectionFilterPatternFields] ?? Table;

const getOrderedFilterEntries = (properties: Record<string, unknown>) => {
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

const addSnowflakeSystemExcludes = (
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

const buildPatternFromState = (filter: FilterSectionState) => ({
  excludes: filter.excludes.map(conditionToRegex),
  includes: filter.restrict ? filter.includes.map(conditionToRegex) : [],
});

const removeConditionAtIndex = (
  conditions: FilterCondition[],
  indexToRemove: number
) => conditions.filter((_, index) => index !== indexToRemove);

const getRuleLabelKey = (count: number) =>
  count === 1 ? 'label.rule-lowercase' : 'label.rule-lowercase-plural';

const getSummaryPill = (filter: FilterSectionState) => {
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
      values: {
        count: filter.excludes.length,
      },
    };
  }

  return {
    textKey:
      filter.includes.length === 1
        ? 'message.filter-scope-include-rule-count'
        : 'message.filter-scope-include-rules-count',
    tone: 'info' as const,
    values: {
      count: filter.includes.length,
    },
  };
};

const getScopeSummaryKey = (filter: FilterSectionState) => {
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

function PreviewRuleChip({
  condition,
  operatorLabel,
  tone,
}: Readonly<{
  condition: FilterCondition;
  operatorLabel: string;
  tone: 'exclude' | 'include';
}>) {
  return (
    <span
      className={cx(
        'tw:inline-flex tw:max-w-full tw:items-center tw:gap-1 tw:rounded-full tw:px-2 tw:py-[3px] tw:text-[11.5px] tw:font-semibold tw:leading-[18px]',
        tone === 'include'
          ? 'tw:border tw:border-utility-brand-200 tw:bg-utility-brand-50 tw:text-utility-brand-700'
          : 'tw:border tw:border-utility-error-200 tw:bg-utility-error-50 tw:text-utility-error-700'
      )}>
      <span className="tw:font-medium tw:text-quaternary">{operatorLabel}</span>
      <span>{condition.value}</span>
    </span>
  );
}

function ConditionChip({
  condition,
  operatorLabel,
  removeLabel,
  tone,
  onRemove,
}: Readonly<{
  condition: FilterCondition;
  operatorLabel: string;
  removeLabel: string;
  tone: 'exclude' | 'include';
  onRemove: () => void;
}>) {
  return (
    <span
      className={cx(
        'tw:inline-flex tw:max-w-full tw:items-center tw:gap-1 tw:rounded-full tw:px-2 tw:py-1 tw:text-xs tw:font-semibold tw:leading-[18px]',
        tone === 'include'
          ? 'tw:border tw:border-utility-brand-200 tw:bg-utility-brand-50 tw:text-utility-brand-700'
          : 'tw:border tw:border-utility-error-200 tw:bg-utility-error-50 tw:text-utility-error-700'
      )}
      data-testid={`${tone}-chip-${conditionKey(condition)}`}>
      <span className="tw:text-quaternary tw:font-medium" data-testid="label">
        {operatorLabel}
      </span>
      <span data-testid="value">{condition.value}</span>
      <button
        aria-label={removeLabel}
        className="tw:inline-grid tw:size-4 tw:cursor-pointer tw:place-items-center tw:border-0 tw:bg-transparent tw:p-0 tw:text-current"
        data-testid="remove-button"
        type="button"
        onClick={onRemove}>
        <XClose size={12} />
      </button>
    </span>
  );
}

function OperatorSelect({
  value,
  onChange,
}: Readonly<{
  value: FilterOperator;
  onChange: (value: FilterOperator) => void;
}>) {
  const { t } = useTranslation();

  return (
    <span className="tw:relative tw:flex-[0_0_148px]">
      <Select
        data-testid="relation-selector"
        size="sm"
        value={value}
        onChange={(key) => onChange(key as FilterOperator)}>
        {Object.entries(OPERATOR_LABEL_KEYS).map(([operator, labelKey]) => (
          <Select.Item id={operator} key={operator} label={t(labelKey)} />
        ))}
      </Select>
    </span>
  );
}

function ConditionComposer({
  defaultOperator,
  fieldName,
  onAdd,
  onFocus,
  placeholder,
  tone = 'include',
}: Readonly<{
  defaultOperator: FilterOperator;
  fieldName: string;
  onAdd: (condition: FilterCondition) => void;
  onFocus: (fieldName: string) => void;
  placeholder: string;
  tone?: 'exclude' | 'include';
}>) {
  const { t } = useTranslation();
  const [operator, setOperator] = useState<FilterOperator>(defaultOperator);
  const [value, setValue] = useState('');
  const trimmedValue = value.trim();
  const isRegex = operator === 'regex';

  const commit = useCallback(() => {
    if (!trimmedValue) {
      return;
    }

    onAdd({
      op: operator,
      value: trimmedValue,
    });
    setValue('');
  }, [onAdd, operator, trimmedValue]);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    }
  };

  return (
    <div className="tw:flex tw:items-center tw:gap-2">
      <OperatorSelect value={operator} onChange={setOperator} />
      <input
        className={cx(
          'tw:h-[38px] tw:min-w-0 tw:flex-1 tw:rounded-lg tw:border tw:border-primary tw:bg-primary',
          'tw:px-3 tw:text-sm tw:text-primary tw:shadow-xs tw:outline-0',
          'placeholder:tw:text-disabled focus:tw:border-utility-brand-500',
          isRegex && 'tw:font-mono'
        )}
        data-testid={`${tone}-filter-input`}
        placeholder={isRegex ? '^prefix.*$' : placeholder}
        value={value}
        onBlur={() => onFocus('')}
        onChange={(event) => setValue(event.target.value)}
        onFocus={() => onFocus(fieldName)}
        onKeyDown={handleKeyDown}
      />
      <button
        className={cx(
          'tw:inline-flex tw:h-[38px] tw:shrink-0 tw:items-center tw:justify-center',
          'tw:gap-1.5 tw:rounded-lg tw:border tw:border-transparent tw:px-3.5',
          'tw:font-semibold tw:text-white tw:shadow-xs tw:cursor-pointer',
          'disabled:tw:cursor-default disabled:tw:border-secondary',
          'disabled:tw:bg-secondary disabled:tw:text-disabled disabled:tw:shadow-none',
          tone === 'exclude'
            ? 'tw:bg-utility-error-600'
            : 'tw:bg-utility-brand-600'
        )}
        data-testid={`${tone}-add-button`}
        disabled={!trimmedValue}
        type="button"
        onClick={commit}>
        <Plus size={14} />
        {t('label.add')}
      </button>
    </div>
  );
}

function RulePreview({
  filter,
  section,
}: Readonly<{
  filter: FilterSectionState;
  section: FilterSection;
}>) {
  const { t } = useTranslation();
  const includeCount = filter.restrict ? filter.includes.length : 0;
  const excludeCount = filter.excludes.length;

  return (
    <div className="tw:rounded-xl tw:border tw:border-secondary tw:bg-secondary tw:p-3.5">
      <div className="tw:mb-2.5 tw:flex tw:items-center tw:gap-2">
        <Eye className="tw:text-utility-brand-600" size={15} />
        <span className="tw:text-xs] tw:font-semibold tw:leading-[18px] tw:text-primary">
          {t('label.preview')}
        </span>
      </div>
      <p className="tw:m-0 tw:font-normal tw:leading-5 tw:text-tertiary">
        {t(getScopeSummaryKey(filter), {
          entity: section.label.toLowerCase(),
          excludeCount,
          excludeRule: t(getRuleLabelKey(excludeCount)),
          includeCount,
          includeRule: t(getRuleLabelKey(includeCount)),
        })}
      </p>
      {includeCount > 0 && (
        <div className="tw:mt-3 tw:grid tw:gap-1.5">
          <span className="tw:text-xs tw:font-semibold tw:leading-[18px] tw:text-secondary">
            {t('label.include-entity', {
              entity: t(getRuleLabelKey(includeCount)),
            })}
          </span>
          <div className="tw:flex tw:flex-wrap tw:gap-1.5">
            {filter.includes.map((condition, index) => (
              <PreviewRuleChip
                condition={condition}
                key={`${conditionKey(condition)}-${index}`}
                operatorLabel={t(OPERATOR_LABEL_KEYS[condition.op])}
                tone="include"
              />
            ))}
          </div>
        </div>
      )}
      {excludeCount > 0 && (
        <div className="tw:mt-3 tw:grid tw:gap-1.5">
          <span className="tw:text-xs tw:font-semibold tw:leading-[18px] tw:text-secondary">
            {t('label.exclude-entity', {
              entity: t(getRuleLabelKey(excludeCount)),
            })}
          </span>
          <div className="tw:flex tw:flex-wrap tw:gap-1.5">
            {filter.excludes.map((condition, index) => (
              <PreviewRuleChip
                condition={condition}
                key={`${conditionKey(condition)}-${index}`}
                operatorLabel={t(OPERATOR_LABEL_KEYS[condition.op])}
                tone="exclude"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RegexDisclosure({
  filter,
}: Readonly<{
  filter: FilterSectionState;
}>) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const includes = filter.restrict ? filter.includes.map(conditionToRegex) : [];
  const excludes = filter.excludes.map(conditionToRegex);

  if (includes.length === 0 && excludes.length === 0) {
    return null;
  }

  return (
    <div className="tw:-mt-1.5">
      <button
        className="tw:inline-flex tw:items-center tw:gap-1.5 tw:border-0 tw:bg-transparent tw:p-0 tw:text-xs tw:font-medium tw:leading-[18px] tw:text-utility-brand-700 tw:cursor-pointer"
        type="button"
        onClick={() => setIsOpen((currentValue) => !currentValue)}>
        <ChevronRight
          className={cx(
            'tw:transition-transform tw:duration-150',
            isOpen && 'tw:rotate-90'
          )}
          size={13}
        />
        {isOpen
          ? t('label.hide-equivalent-regex')
          : t('label.show-equivalent-regex')}
      </button>
      {isOpen && (
        <div className="tw:mt-2 tw:grid tw:gap-1.5 tw:rounded-[10px] tw:bg-gray-900 tw:p-3">
          {includes.map((regex) => (
            <code
              className="tw:font-mono tw:text-xs tw:font-medium tw:leading-[18px] tw:text-blue-300"
              key={`include-${regex}`}>
              {t('message.includes-regex-line', { regex })}
            </code>
          ))}
          {excludes.map((regex) => (
            <code
              className="tw:font-mono tw:text-xs tw:font-medium tw:leading-[18px] tw:text-red-300"
              key={`exclude-${regex}`}>
              {t('message.excludes-regex-line', { regex })}
            </code>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterSectionCard({
  filter,
  isOpen,
  onChange,
  onFocus,
  onToggle,
  section,
}: Readonly<{
  filter: FilterSectionState;
  isOpen: boolean;
  onChange: (filter: FilterSectionState) => void;
  onFocus: (fieldName: string) => void;
  onToggle: () => void;
  section: FilterSection;
}>) {
  const { t } = useTranslation();
  const Icon = section.icon;
  const summary = getSummaryPill(filter);
  const systemExcludeKeys = new Set(section.systemExcludes.map(conditionKey));
  const hasSystemExcludes = section.systemExcludes.length > 0;
  const hasSystemExcludesEnabled =
    hasSystemExcludes &&
    section.systemExcludes.every((systemExclude) =>
      filter.excludes.some(
        (condition) => conditionKey(condition) === conditionKey(systemExclude)
      )
    );

  const addCondition = (
    bucketName: 'excludes' | 'includes',
    condition: FilterCondition
  ) => {
    onChange({
      ...filter,
      [bucketName]: [...filter[bucketName], condition],
      restrict: bucketName === 'includes' ? true : filter.restrict,
    });
  };

  const toggleSystemExcludes = () => {
    if (!hasSystemExcludes) {
      return;
    }

    if (hasSystemExcludesEnabled) {
      onChange({
        ...filter,
        excludes: filter.excludes.filter(
          (condition) => !systemExcludeKeys.has(conditionKey(condition))
        ),
      });

      return;
    }

    const currentKeys = new Set(filter.excludes.map(conditionKey));

    onChange({
      ...filter,
      excludes: [
        ...filter.excludes,
        ...section.systemExcludes.filter(
          (condition) => !currentKeys.has(conditionKey(condition))
        ),
      ],
    });
  };

  return (
    <section
      className="tw:overflow-hidden tw:rounded-2xl tw:border tw:border-primary tw:bg-primary tw:shadow-xs"
      data-testid={`filter-section-${section.fieldName}`}>
      <button
        className={cx(
          'tw:flex tw:w-full tw:items-center tw:gap-3 tw:border-0 tw:bg-primary tw:px-[18px] tw:py-4 tw:text-left tw:cursor-pointer',
          isOpen && 'tw:bg-secondary'
        )}
        type="button"
        onClick={() => {
          onFocus(section.fieldName);
          onToggle();
        }}>
        <span className="tw:grid tw:size-[34px] tw:shrink-0 tw:place-items-center tw:rounded-[9px] tw:bg-utility-brand-50 tw:text-utility-brand-600">
          <Icon size={18} />
        </span>
        <span className="tw:text-[15px] tw:font-semibold tw:leading-[22px] tw:text-primary">
          {section.label}
        </span>
        <span
          className={cx(
            'tw:inline-flex tw:items-center tw:gap-[5px] tw:rounded-full tw:border tw:px-2.5 tw:py-0.5 tw:text-[11.5px] tw:font-semibold tw:leading-[18px]',
            summary.tone === 'success'
              ? 'tw:border-utility-success-200 tw:bg-utility-success-50 tw:text-utility-success-700'
              : 'tw:border-utility-brand-200 tw:bg-utility-brand-50 tw:text-utility-brand-700'
          )}>
          <span className="tw:size-1.5 tw:rounded-full tw:bg-current" />
          {t(summary.textKey, summary.values)}
        </span>
        <ChevronDown
          className={cx(
            'tw:ml-auto tw:shrink-0 tw:text-quaternary tw:transition-transform tw:duration-150',
            isOpen && 'tw:rotate-180'
          )}
          size={18}
        />
      </button>

      {isOpen && (
        <div className="tw:grid tw:gap-[18px] tw:border-t tw:border-secondary tw:p-[18px]">
          <div>
            <div className="tw:mb-2 tw:text-xs tw:font-semibold tw:leading-[18px] tw:text-secondary">
              {t('label.what-to-scan')}
            </div>
            <div className="tw:inline-grid tw:grid-cols-2 tw:gap-1 tw:rounded-[10px] tw:border tw:border-primary tw:bg-secondary tw:p-1">
              <button
                className={cx(
                  'tw:rounded-[7px] tw:border tw:border-transparent tw:bg-transparent tw:px-4 tw:py-2 tw:font-medium tw:leading-[18px] tw:text-tertiary tw:cursor-pointer',
                  !filter.restrict &&
                    'tw:border-primary tw:bg-primary tw:shadow-xs tw:text-primary tw:font-semibold'
                )}
                data-testid={`${section.fieldName}-scan-all-button`}
                type="button"
                onClick={() =>
                  onChange({
                    ...filter,
                    includes: [],
                    restrict: false,
                  })
                }>
                {t('label.scan-all-entity', {
                  entity: section.label.toLowerCase(),
                })}
              </button>
              <button
                className={cx(
                  'tw:rounded-[7px] tw:border tw:border-transparent tw:bg-transparent tw:px-4 tw:py-2 tw:font-medium tw:leading-[18px] tw:text-tertiary tw:cursor-pointer',
                  filter.restrict &&
                    'tw:border-primary tw:bg-primary tw:shadow-xs tw:text-primary tw:font-semibold'
                )}
                data-testid={`${section.fieldName}-only-specific-button`}
                type="button"
                onClick={() =>
                  onChange({
                    ...filter,
                    restrict: true,
                  })
                }>
                {t('label.only-specific-entity', {
                  entity: section.label.toLowerCase(),
                })}
              </button>
            </div>
          </div>

          {filter.restrict && (
            <div>
              <div className="tw:mb-2 tw:text-xs tw:font-semibold tw:leading-[18px] tw:text-utility-brand-700">
                {t('message.include-only-entities-where-name', {
                  entity: section.label.toLowerCase(),
                })}
              </div>
              {filter.includes.length > 0 && (
                <div className="tw:mb-2.5 tw:flex tw:flex-wrap tw:gap-1.5">
                  {filter.includes.map((condition, index) => (
                    <ConditionChip
                      condition={condition}
                      key={`${conditionKey(condition)}-${index}`}
                      operatorLabel={t(OPERATOR_LABEL_KEYS[condition.op])}
                      removeLabel={t('label.remove')}
                      tone="include"
                      onRemove={() =>
                        onChange({
                          ...filter,
                          includes: removeConditionAtIndex(
                            filter.includes,
                            index
                          ),
                        })
                      }
                    />
                  ))}
                </div>
              )}
              <ConditionComposer
                defaultOperator="contains"
                fieldName={section.fieldName}
                placeholder={t('message.example-value', {
                  value: t('message.entity-name-example', {
                    entity: section.singleLabel.toLowerCase(),
                  }),
                })}
                onAdd={(condition) => addCondition('includes', condition)}
                onFocus={onFocus}
              />
            </div>
          )}

          <div className="tw:border-t tw:border-dashed tw:border-primary tw:pt-1">
            <div className="tw:my-3.5 tw:mb-2 tw:flex tw:items-center tw:gap-2.5">
              <span className="tw:text-xs tw:font-semibold tw:leading-[18px] tw:text-utility-error-700">
                {t('label.always-exclude')}
              </span>
              {hasSystemExcludes && (
                <button
                  className={cx(
                    'tw:ml-auto tw:inline-flex tw:items-center tw:gap-1.5 tw:rounded-[7px]',
                    'tw:border tw:border-primary tw:bg-primary tw:px-2.5 tw:py-[5px]',
                    'tw:text-xs tw:font-medium tw:leading-[18px] tw:text-secondary tw:cursor-pointer',
                    hasSystemExcludesEnabled &&
                      'tw:border-utility-brand-200 tw:bg-utility-brand-50 tw:text-utility-brand-700'
                  )}
                  data-testid={`${section.fieldName}-exclude-system-filters`}
                  type="button"
                  onClick={toggleSystemExcludes}>
                  {hasSystemExcludesEnabled ? (
                    <CheckCircle size={13} />
                  ) : (
                    <Plus size={13} />
                  )}
                  {t('label.exclude-system-entity', {
                    entity: section.label.toLowerCase(),
                  })}
                </button>
              )}
            </div>

            {filter.excludes.length > 0 && (
              <div className="tw:mb-2.5 tw:flex tw:flex-wrap tw:gap-1.5">
                {filter.excludes.map((condition, index) => (
                  <ConditionChip
                    condition={condition}
                    key={`${conditionKey(condition)}-${index}`}
                    operatorLabel={t(OPERATOR_LABEL_KEYS[condition.op])}
                    removeLabel={t('label.remove')}
                    tone="exclude"
                    onRemove={() =>
                      onChange({
                        ...filter,
                        excludes: removeConditionAtIndex(
                          filter.excludes,
                          index
                        ),
                      })
                    }
                  />
                ))}
              </div>
            )}

            <ConditionComposer
              defaultOperator="startsWith"
              fieldName={section.fieldName}
              placeholder={t('message.example-value', { value: 'TMP_' })}
              tone="exclude"
              onAdd={(condition) => addCondition('excludes', condition)}
              onFocus={onFocus}
            />
          </div>

          <RulePreview filter={filter} section={section} />
          <RegexDisclosure filter={filter} />
        </div>
      )}
    </section>
  );
}

function FiltersConfigForm({
  data,
  okText,
  cancelText,
  serviceType,
  serviceCategory,
  status,
  onCancel,
  onSave,
  onFocus,
}: Readonly<FiltersConfigFormProps>) {
  const { t } = useTranslation();
  const { inlineAlertDetails } = useApplicationStore();
  const [connSch, setConnSch] = useState<ConnectionSchemaResult['connSch']>(
    EMPTY_CONNECTION_SCHEMA
  );
  const validConfig = useMemo(() => buildValidConfig(data), [data]);
  const [filters, setFilters] = useState<FiltersState>({});
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const submitText = okText ?? t('label.save');
  const backText = cancelText ?? t('label.cancel');
  const isSaving = status === 'waiting';

  useEffect(() => {
    let cancelled = false;
    loadConnectionSchema(serviceCategory, serviceType)
      .then((schema) => {
        if (!cancelled) {
          setConnSch(schema);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setConnSch(EMPTY_CONNECTION_SCHEMA);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [serviceCategory, serviceType]);

  const filterSections = useMemo<FilterSection[]>(() => {
    const properties = (connSch.schema.properties ?? {}) as Record<
      string,
      unknown
    >;

    return (getOrderedFilterEntries(properties) as [string, unknown][]).map(
      ([fieldName, property]) => {
        const schemaProperty = property as FilterSchemaProperty;
        const field = fieldName as ServiceConnectionFilterPatternFields;
        const cleanedTitle = cleanSchemaTitle(
          schemaProperty.title ?? '',
          fieldName
        );
        const labelKey = FILTER_LABEL_KEYS[field];
        const singleLabelKey = FILTER_SINGLE_LABEL_KEYS[field];
        const label = labelKey
          ? t(labelKey)
          : pluralizeFallback(cleanedTitle || startCase(fieldName));
        const singleLabel = singleLabelKey
          ? t(singleLabelKey)
          : singularizeFallback(label);
        const defaultExcludes = addSnowflakeSystemExcludes(
          serviceType,
          fieldName,
          schemaProperty.default?.excludes ?? []
        );

        return {
          description: schemaProperty.description,
          fieldName,
          icon: getSectionIcon(fieldName),
          label,
          singleLabel,
          systemExcludes: defaultExcludes.map(parseRegexPattern),
        };
      }
    );
  }, [connSch.schema.properties, serviceType, t]);

  useEffect(() => {
    const initialFilters = filterSections.reduce<FiltersState>(
      (accumulator, section) => {
        const property = (
          (connSch.schema.properties ?? {}) as Record<
            string,
            FilterSchemaProperty
          >
        )[section.fieldName];
        const defaultConfig: FilterPatternConfig = {
          excludes: addSnowflakeSystemExcludes(
            serviceType,
            section.fieldName,
            property?.default?.excludes ?? []
          ),
          includes: property?.default?.includes ?? [],
        };
        const existingConfig = getFilterPatternConfig(
          validConfig,
          section.fieldName
        );
        const config = existingConfig ?? defaultConfig;
        const includes = (config.includes ?? []).map(parseRegexPattern);
        const excludes = (config.excludes ?? []).map(parseRegexPattern);

        accumulator[section.fieldName] = {
          excludes,
          includes,
          restrict: includes.length > 0,
        };

        return accumulator;
      },
      {}
    );
    const initialOpenSections = filterSections.reduce<Record<string, boolean>>(
      (accumulator, section, index) => {
        accumulator[section.fieldName] = index < 2;

        return accumulator;
      },
      {}
    );

    setFilters(initialFilters);
    setOpenSections(initialOpenSections);
  }, [connSch.schema.properties, filterSections, serviceType, validConfig]);

  const updateFilter = useCallback(
    (fieldName: string, filter: FilterSectionState) => {
      setFilters((currentFilters) => ({
        ...currentFilters,
        [fieldName]: filter,
      }));
    },
    []
  );

  const handleSubmit = async () => {
    const filterFormData = filterSections.reduce<
      Record<string, FilterPatternConfig>
    >((accumulator, section) => {
      const filter = filters[section.fieldName];

      if (!filter) {
        return accumulator;
      }

      accumulator[section.fieldName] = buildPatternFromState(filter);

      return accumulator;
    }, {});
    const formattedFormData = formatFormDataForSubmit(
      filterFormData
    ) as ConfigData;

    await onSave({
      formData: formattedFormData,
    } as IChangeEvent<ConfigData>);
  };

  const connectionHost = getConnectionDisplayHost(validConfig, serviceType);

  return (
    <div
      className="tw:grid tw:gap-4 tw:font-[Inter,sans-serif]"
      data-testid={FORM_TEST_ID}>
      <div>
        <h2 className="tw:m-0 tw:text-lg tw:font-semibold tw:leading-7 tw:text-primary">
          {t('label.what-should-we-ingest')}
        </h2>
        <p className="tw:mt-1 tw:text-sm tw:font-normal tw:leading-5 tw:text-tertiary">
          {t('message.what-to-ingest-description')}
        </p>
      </div>

      <div className="tw:flex tw:items-start tw:gap-3 tw:rounded-xl tw:border tw:border-utility-success-200 tw:bg-utility-success-50 tw:px-4 tw:py-3.5">
        <span className="tw:grid tw:size-[30px] tw:shrink-0 tw:place-items-center tw:rounded-full tw:bg-white tw:text-utility-success-600">
          <CheckCircle size={17} />
        </span>
        <div>
          <div className="tw:font-semibold tw:leading-5 tw:text-primary">
            {t('message.connected-to-host', {
              host: connectionHost,
            })}
          </div>
          <div className="tw:mt-px tw:text-xs tw:font-normal tw:leading-[18px] tw:text-tertiary">
            {t('message.connection-verified-ingestion-scope')}
          </div>
        </div>
      </div>

      <div className="tw:grid tw:gap-3">
        {filterSections.map((section) => {
          const filter = filters[section.fieldName];

          return filter ? (
            <FilterSectionCard
              filter={filter}
              isOpen={Boolean(openSections[section.fieldName])}
              key={section.fieldName}
              section={section}
              onChange={(updatedFilter) =>
                updateFilter(section.fieldName, updatedFilter)
              }
              onFocus={onFocus}
              onToggle={() =>
                setOpenSections((currentOpenSections) => ({
                  ...currentOpenSections,
                  [section.fieldName]: !currentOpenSections[section.fieldName],
                }))
              }
            />
          ) : null;
        })}
      </div>

      {isEmpty(filterSections) && (
        <div
          className="tw:rounded-xl tw:border tw:border-secondary tw:bg-secondary tw:p-6 tw:text-center tw:font-medium tw:leading-5 tw:text-tertiary"
          data-testid="no-config-available">
          {t('message.no-filter-patterns-available')}
        </div>
      )}

      {!isUndefined(inlineAlertDetails) && (
        <InlineAlert alertClassName="m-t-xs" {...inlineAlertDetails} />
      )}

      <div className="tw:sticky tw:bottom-0 tw:z-10 tw:mt-2 tw:flex tw:items-center tw:justify-end tw:gap-5 tw:border-t tw:border-secondary tw:bg-primary tw:pt-4 tw:pb-1">
        {onCancel && (
          <Button
            color="secondary"
            isDisabled={isSaving}
            size="sm"
            type="button"
            onClick={onCancel}>
            {backText}
          </Button>
        )}
        <Button
          color="primary"
          isDisabled={isSaving}
          size="sm"
          type="button"
          onClick={handleSubmit}>
          {submitText}
        </Button>
      </div>
    </div>
  );
}

export default FiltersConfigForm;
