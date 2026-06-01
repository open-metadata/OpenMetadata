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
  loadConnectionSchema,
} from '../../../../utils/ServiceConnectionUtils';
import InlineAlert from '../../../common/InlineAlert/InlineAlert';
import './filters-config-form.less';
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
    return account.includes('snowflakecomputing.com')
      ? account
      : `${account}.snowflakecomputing.com`;
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
    .sort((first, second) => {
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
      (knownFilterFields[fieldName] ?? properties[fieldName]) as unknown,
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
      className={`filters-config-form__preview-rule filters-config-form__preview-rule--${tone}`}>
      <span className="filters-config-form__preview-rule-operator">
        {operatorLabel}
      </span>
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
      className={`filters-config-form__chip filters-config-form__chip--${tone}`}>
      <span className="filters-config-form__chip-operator">
        {operatorLabel}
      </span>
      <span>{condition.value}</span>
      <button
        aria-label={removeLabel}
        className="filters-config-form__chip-remove"
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
    <span className="filters-config-form__operator-select-wrap">
      <select
        className="filters-config-form__operator-select"
        value={value}
        onChange={(event) => onChange(event.target.value as FilterOperator)}>
        {Object.entries(OPERATOR_LABEL_KEYS).map(([operator, labelKey]) => (
          <option key={operator} value={operator}>
            {t(labelKey)}
          </option>
        ))}
      </select>
      <ChevronDown className="filters-config-form__operator-select-icon" />
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
    <div className="filters-config-form__composer">
      <OperatorSelect value={operator} onChange={setOperator} />
      <input
        className={cx(
          'filters-config-form__composer-input',
          isRegex && 'filters-config-form__composer-input--mono'
        )}
        placeholder={isRegex ? '^prefix.*$' : placeholder}
        value={value}
        onBlur={() => onFocus('')}
        onChange={(event) => setValue(event.target.value)}
        onFocus={() => onFocus(fieldName)}
        onKeyDown={handleKeyDown}
      />
      <button
        className={`filters-config-form__composer-add filters-config-form__composer-add--${tone}`}
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
    <div className="filters-config-form__preview">
      <div className="filters-config-form__preview-header">
        <Eye className="filters-config-form__preview-icon" size={15} />
        <span className="filters-config-form__preview-title">
          {t('label.preview')}
        </span>
      </div>
      <p className="filters-config-form__preview-text">
        {t(getScopeSummaryKey(filter), {
          entity: section.label.toLowerCase(),
          excludeCount,
          excludeRule: t(getRuleLabelKey(excludeCount)),
          includeCount,
          includeRule: t(getRuleLabelKey(includeCount)),
        })}
      </p>
      {includeCount > 0 && (
        <div className="filters-config-form__preview-rule-group">
          <span className="filters-config-form__preview-rule-label">
            {t('label.include-entity', {
              entity: t(getRuleLabelKey(includeCount)),
            })}
          </span>
          <div className="filters-config-form__preview-rule-row">
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
        <div className="filters-config-form__preview-rule-group">
          <span className="filters-config-form__preview-rule-label">
            {t('label.exclude-entity', {
              entity: t(getRuleLabelKey(excludeCount)),
            })}
          </span>
          <div className="filters-config-form__preview-rule-row">
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
    <div className="filters-config-form__regex">
      <button
        className="filters-config-form__regex-toggle"
        type="button"
        onClick={() => setIsOpen((currentValue) => !currentValue)}>
        <ChevronRight
          className={cx(
            'filters-config-form__regex-toggle-icon',
            isOpen && 'filters-config-form__regex-toggle-icon--open'
          )}
          size={13}
        />
        {isOpen
          ? t('label.hide-equivalent-regex')
          : t('label.show-equivalent-regex')}
      </button>
      {isOpen && (
        <div className="filters-config-form__regex-block">
          {includes.map((regex) => (
            <code
              className="filters-config-form__regex-line filters-config-form__regex-line--include"
              key={`include-${regex}`}>
              {t('message.includes-regex-line', { regex })}
            </code>
          ))}
          {excludes.map((regex) => (
            <code
              className="filters-config-form__regex-line filters-config-form__regex-line--exclude"
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
      className="filters-config-form__section"
      data-testid={`filter-section-${section.fieldName}`}>
      <button
        className={cx(
          'filters-config-form__section-header',
          isOpen && 'filters-config-form__section-header--open'
        )}
        type="button"
        onClick={() => {
          onFocus(section.fieldName);
          onToggle();
        }}>
        <span className="filters-config-form__section-icon">
          <Icon size={18} />
        </span>
        <span className="filters-config-form__section-title">
          {section.label}
        </span>
        <span
          className={`filters-config-form__summary-pill filters-config-form__summary-pill--${summary.tone}`}>
          <span className="filters-config-form__summary-dot" />
          {t(summary.textKey, summary.values)}
        </span>
        <ChevronDown
          className={cx(
            'filters-config-form__section-chevron',
            isOpen && 'filters-config-form__section-chevron--open'
          )}
          size={18}
        />
      </button>

      {isOpen && (
        <div className="filters-config-form__section-body">
          <div>
            <div className="filters-config-form__field-label">
              {t('label.what-to-scan')}
            </div>
            <div className="filters-config-form__segmented-control">
              <button
                className={cx(
                  'filters-config-form__segment',
                  !filter.restrict && 'filters-config-form__segment--active'
                )}
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
                  'filters-config-form__segment',
                  filter.restrict && 'filters-config-form__segment--active'
                )}
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
              <div className="filters-config-form__include-title">
                {t('message.include-only-entities-where-name', {
                  entity: section.label.toLowerCase(),
                })}
              </div>
              {filter.includes.length > 0 && (
                <div className="filters-config-form__chip-row">
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

          <div className="filters-config-form__exclude-area">
            <div className="filters-config-form__exclude-header">
              <span className="filters-config-form__exclude-title">
                {t('label.always-exclude')}
              </span>
              {hasSystemExcludes && (
                <button
                  className={cx(
                    'filters-config-form__system-button',
                    hasSystemExcludesEnabled &&
                      'filters-config-form__system-button--active'
                  )}
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
              <div className="filters-config-form__chip-row">
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

    return getOrderedFilterEntries(properties).map(([fieldName, property]) => {
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
    });
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
    <div className="filters-config-form" data-testid={FORM_TEST_ID}>
      <div>
        <h2 className="filters-config-form__title">
          {t('label.what-should-we-ingest')}
        </h2>
        <p className="filters-config-form__description">
          {t('message.what-to-ingest-description')}
        </p>
      </div>

      <div className="filters-config-form__success-banner">
        <span className="filters-config-form__success-icon">
          <CheckCircle size={17} />
        </span>
        <div>
          <div className="filters-config-form__success-title">
            {t('message.connected-to-host', {
              host: connectionHost,
            })}
          </div>
          <div className="filters-config-form__success-description">
            {t('message.connection-verified-ingestion-scope')}
          </div>
        </div>
      </div>

      <div className="filters-config-form__sections">
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
          className="filters-config-form__empty"
          data-testid="no-config-available">
          {t('message.no-filter-patterns-available')}
        </div>
      )}

      {!isUndefined(inlineAlertDetails) && (
        <InlineAlert alertClassName="m-t-xs" {...inlineAlertDetails} />
      )}

      <div className="filters-config-form__actions">
        {onCancel && (
          <button
            className="filters-config-form__back"
            disabled={isSaving}
            type="button"
            onClick={onCancel}>
            {backText}
          </button>
        )}
        <button
          className="filters-config-form__submit"
          disabled={isSaving}
          type="button"
          onClick={handleSubmit}>
          {submitText}
        </button>
      </div>
    </div>
  );
}

export default FiltersConfigForm;
