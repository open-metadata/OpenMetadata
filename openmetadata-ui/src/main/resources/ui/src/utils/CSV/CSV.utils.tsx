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
import { Tooltip, TooltipTrigger } from '@openmetadata/ui-core-components';
import { ChevronDown } from '@untitledui/icons';
import { Typography } from 'antd';
import { isEmpty, isString, isUndefined, startCase } from 'lodash';
import { parse, unparse } from 'papaparse';
import type { Column, RenderCellProps } from 'react-data-grid';
import { ReactComponent as SuccessBadgeIcon } from '../..//assets/svg/success-badge.svg';
import { ReactComponent as FailBadgeIcon } from '../../assets/svg/fail-badge.svg';
import { TableTypePropertyValueType } from '../../components/common/CustomPropertyTable/CustomPropertyTable.interface';
import CsvCellPreview from '../../components/common/EntityImport/CsvCellPreview/CsvCellPreview.component';
import {
  BulkActionOperation,
  BULK_ACTION_OPERATIONS,
} from '../../components/common/EntityImport/OperationCell/OperationCell.interface';
import RichTextEditorPreviewerV1 from '../../components/common/RichTextEditor/RichTextEditorPreviewerV1';
import {
  ExtensionDataProps,
  ExtensionDataTypes,
} from '../../components/Modals/ModalWithCustomProperty/ModalWithMarkdownEditor.interface';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import { TABLE_TYPE_CUSTOM_PROPERTY } from '../../constants/CustomProperty.constants';
import { SEMICOLON_SPLITTER } from '../../constants/regex.constants';
import { EntityType } from '../../enums/entity.enum';
import {
  LabelType,
  Metric,
  TagSource,
} from '../../generated/entity/data/metric';
import {
  Config,
  CustomProperty,
  EntityReference,
  Type,
} from '../../generated/entity/type';
import { Status } from '../../generated/type/csvImportResult';
import { CsvHeaderDocumentation } from '../../rest/csvAPI';
import { t } from '../i18next/LocalUtil';
import { removeOuterEscapes } from '../StringUtils';
import csvUtilsClassBase from './CSVUtilsClassBase';

export interface EditorProps {
  value: string;
  onChange: (value?: string) => void;
  onCancel: () => void;
  onComplete: (value?: string) => void;
}

export const COLUMNS_WIDTH: Record<string, number> = {
  description: 300,
  expressionCode: 420,
  operation: 160,
  tags: 200,
  glossaryTerms: 220,
  'entityType*': 230,
  arrayDataType: 210,
  dataTypeDisplay: 220,
  domains: 200,
  dataProducts: 200,
  fullyQualifiedName: 300,
  tiers: 120,
  status: 70,
  parameterValues: 300,
};

export const CSV_DISABLED_COLUMNS = [
  'name*',
  'operation',
  'testDefinition*',
  'entityFQN*',
  'testSuite',
];

export const METRIC_BULK_EDIT_HIDDEN_COLUMNS = [
  'relatedMetrics',
  'entityStatus',
];

// Hidden for metric in BOTH import and bulk edit: the expression language is set
// from the language tabs inside the unified Expression code cell, so a separate
// language column would be redundant. The value still round-trips in the CSV.
export const METRIC_HIDDEN_COLUMNS = ['expressionLanguage'];

// Per-row outcome the server writes into the import-result CSV `details` column
// (EntityCsv.ENTITY_UPDATED). The Import preview uses it to tell create from
// update without re-implementing matching on the client.
export const IMPORT_ENTITY_UPDATED_DETAIL = 'Entity updated';

// Per-row `status` the server writes when a row is skipped (EntityCsv.IMPORT_SKIPPED).
export const IMPORT_SKIPPED_STATUS = 'skipped';

export const IMPORT_OPERATION_COLUMN_KEY = '__importOperation';
export const CSV_CELL_STYLE_METADATA_KEY = '__csvCellStyleMetadata';

export type CsvCellStyleMetadata = Record<string, Record<string, string>>;

// The Import preview never has "no change" rows — every applied row is a create
// or update, and invalid rows are skipped.
export const IMPORT_OPERATIONS: BulkActionOperation[] =
  BULK_ACTION_OPERATIONS.filter((operation) => operation !== 'NO_CHANGE');

const CSV_SEPARATOR = ',';
const CSV_FIELD_SEPARATOR = ';';
const CSV_ENTITY_TYPE_SEPARATOR = ':';
const CSV_INTERNAL_ARRAY_SEPARATOR = '|';
const SYSTEM_CLASSIFICATION_TAG_PREFIXES = ['Certification', 'Tier'];

export const isSystemClassificationTagFqn = (tagFQN = '') =>
  SYSTEM_CLASSIFICATION_TAG_PREFIXES.some((classification) =>
    tagFQN.startsWith(`${classification}${FQN_SEPARATOR_CHAR}`)
  );

const getCsvColumnName = (column: string) =>
  (column.split('.').pop() ?? column).replace(/\*$/, '');

export const getCsvHeaderKey = (header: CsvHeaderDocumentation) =>
  header.required ? `${header.name}*` : header.name;

const getStringValue = (value: unknown) =>
  value === undefined || value === null ? '' : String(value);

const quoteCsvFieldValue = (value: string) =>
  value.includes(CSV_SEPARATOR) || value.includes(CSV_FIELD_SEPARATOR)
    ? `"${value}"`
    : value;

const quoteCsvFieldForSeparator = (value: string) =>
  value.includes(CSV_SEPARATOR) ? `"${value}"` : value;

const joinEntityReferences = (
  refs?: Array<Pick<EntityReference, 'fullyQualifiedName'>>
) =>
  refs?.length
    ? refs
        .map((ref) => ref.fullyQualifiedName)
        .filter(Boolean)
        .sort()
        .join(CSV_FIELD_SEPARATOR)
    : '';

const joinOwners = (owners?: Array<Pick<EntityReference, 'type' | 'name'>>) =>
  owners?.length
    ? owners
        .map((owner) =>
          [owner.type, owner.name]
            .filter(Boolean)
            .join(CSV_ENTITY_TYPE_SEPARATOR)
        )
        .filter(Boolean)
        .join(CSV_FIELD_SEPARATOR)
    : '';

type MetricTag = NonNullable<Metric['tags']>[number];

const isManualMetricClassificationTag = (tag: MetricTag) =>
  tag.source === TagSource.Classification &&
  tag.labelType !== LabelType.Derived;

const isManualMetricTierTag = (tag: MetricTag) =>
  isManualMetricClassificationTag(tag) &&
  tag.tagFQN.startsWith(`Tier${FQN_SEPARATOR_CHAR}`);

const isManualMetricEditableTag = (tag: MetricTag) =>
  isManualMetricClassificationTag(tag) &&
  !isSystemClassificationTagFqn(tag.tagFQN);

const joinMetricTags = (metric: Metric, source: TagSource) =>
  metric.tags?.length
    ? metric.tags
        .filter((tag) => {
          if (source === TagSource.Classification) {
            return isManualMetricEditableTag(tag);
          }

          return tag.source === TagSource.Glossary;
        })
        .map((tag) => tag.tagFQN)
        .join(CSV_FIELD_SEPARATOR)
    : '';

const joinMetricTiers = (metric: Metric) =>
  metric.tags?.length
    ? metric.tags
        .filter(isManualMetricTierTag)
        .map((tag) => tag.tagFQN)
        .join(CSV_FIELD_SEPARATOR)
    : '';

const setCsvCellStyleMetadata = (
  metadata: CsvCellStyleMetadata,
  column: string,
  value: string,
  color?: string
) => {
  if (!value || !color) {
    return;
  }

  metadata[column] = {
    ...(metadata[column] ?? {}),
    [value]: color,
  };
};

const getMetricCsvCellStyleMetadata = (metric: Metric) => {
  const metadata: CsvCellStyleMetadata = {};

  metric.tags?.forEach((tag) => {
    const color = tag.style?.color;

    if (isManualMetricEditableTag(tag)) {
      setCsvCellStyleMetadata(metadata, 'tags', tag.tagFQN, color);
    }

    if (tag.source === TagSource.Glossary) {
      setCsvCellStyleMetadata(metadata, 'glossaryTerms', tag.tagFQN, color);
    }

    if (isManualMetricTierTag(tag)) {
      setCsvCellStyleMetadata(metadata, 'tiers', tag.tagFQN, color);
    }
  });

  return metadata;
};

export const getCsvCellStyleMetadata = (row?: Record<string, string>) => {
  const rawMetadata = row?.[CSV_CELL_STYLE_METADATA_KEY];

  if (!rawMetadata) {
    return undefined;
  }

  try {
    return JSON.parse(rawMetadata) as CsvCellStyleMetadata;
  } catch {
    return undefined;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const formatMetricExtensionMap = (value: Record<string, unknown>) => {
  if ('type' in value && 'fullyQualifiedName' in value) {
    return `${getStringValue(
      value.type
    )}${CSV_ENTITY_TYPE_SEPARATOR}${getStringValue(value.fullyQualifiedName)}`;
  }

  if ('start' in value && 'end' in value) {
    return `${getStringValue(
      value.start
    )}${CSV_ENTITY_TYPE_SEPARATOR}${getStringValue(value.end)}`;
  }

  if (Array.isArray(value.columns) && Array.isArray(value.rows)) {
    const columns = value.columns.map(getStringValue);
    const rows = value.rows.filter(isRecord);

    return rows
      .map((row) =>
        columns
          .map((column) =>
            quoteCsvFieldForSeparator(getStringValue(row[column]))
          )
          .join(CSV_SEPARATOR)
      )
      .join(CSV_INTERNAL_ARRAY_SEPARATOR);
  }

  return String(value);
};

const formatMetricExtensionValue = (value: unknown): string => {
  if (Array.isArray(value)) {
    if (!value.length) {
      return '';
    }

    return value
      .map((item) =>
        isRecord(item) ? formatMetricExtensionMap(item) : getStringValue(item)
      )
      .join(CSV_INTERNAL_ARRAY_SEPARATOR);
  }

  if (isRecord(value)) {
    return formatMetricExtensionMap(value);
  }

  return getStringValue(value);
};

const formatMetricExtension = (extension: unknown) => {
  if (!isRecord(extension)) {
    return '';
  }

  return Object.entries(extension)
    .map(([key, value]) => ({
      key,
      value: formatMetricExtensionValue(value),
    }))
    .filter(({ value }) => value.trim())
    .map(({ key, value }) =>
      quoteCsvFieldValue(`${key}${CSV_ENTITY_TYPE_SEPARATOR}${value}`)
    )
    .join(CSV_FIELD_SEPARATOR);
};

const getMetricCsvValue = (metric: Metric, columnName: string) => {
  const expression = metric.metricExpression;

  switch (columnName) {
    case 'name':
      return metric.name;
    case 'displayName':
      return metric.displayName;
    case 'description':
      return metric.description;
    case 'metricType':
      return metric.metricType;
    case 'unitOfMeasurement':
      return metric.unitOfMeasurement;
    case 'customUnitOfMeasurement':
      return metric.customUnitOfMeasurement;
    case 'granularity':
      return metric.granularity;
    case 'expressionLanguage':
      return expression?.language;
    case 'expressionCode':
      return expression?.code;
    case 'relatedMetrics':
      return joinEntityReferences(metric.relatedMetrics);
    case 'tags':
      return joinMetricTags(metric, TagSource.Classification);
    case 'glossaryTerms':
      return joinMetricTags(metric, TagSource.Glossary);
    case 'tiers':
      return joinMetricTiers(metric);
    case 'owners':
      return joinOwners(metric.owners);
    case 'reviewers':
      return joinOwners(metric.reviewers);
    case 'domains':
      return joinEntityReferences(metric.domains);
    case 'dataProducts':
      return joinEntityReferences(metric.dataProducts);
    case 'entityStatus':
      return metric.entityStatus;
    case 'extension':
      return formatMetricExtension(metric.extension);
    default:
      return '';
  }
};

export const getMetricCsvRowsFromMetrics = (
  metrics: Metric[],
  headers: CsvHeaderDocumentation[]
) =>
  metrics.map((metric, index) => {
    const metadata = getMetricCsvCellStyleMetadata(metric);
    const rowSeed: Record<string, string> = {
      id: metric.id ?? `${index}`,
    };

    if (Object.keys(metadata).length) {
      rowSeed[CSV_CELL_STYLE_METADATA_KEY] = JSON.stringify(metadata);
    }

    return headers.reduce<Record<string, string>>((row, header) => {
      row[getCsvHeaderKey(header)] = getStringValue(
        getMetricCsvValue(metric, header.name)
      );

      return row;
    }, rowSeed);
  });

export const isMetricBulkEditHiddenColumn = (
  column: string,
  entityType: EntityType,
  isBulkEdit: boolean
) => {
  const columnName = getCsvColumnName(column);
  const isMetric = entityType === EntityType.METRIC;

  return (
    (isMetric && METRIC_HIDDEN_COLUMNS.includes(columnName)) ||
    (isBulkEdit &&
      isMetric &&
      METRIC_BULK_EDIT_HIDDEN_COLUMNS.includes(columnName))
  );
};

const statusRenderer = (value: Status) => {
  return value === Status.Failure ? (
    <FailBadgeIcon
      className="m-t-xss"
      data-testid="failure-badge"
      height={16}
      width={16}
    />
  ) : (
    <SuccessBadgeIcon
      className="m-t-xss"
      data-testid="success-badge"
      height={16}
      width={16}
    />
  );
};

const getSelectCellDisplayValue = (column: string, value: string) => {
  if (column === 'tiers') {
    return value.split('.').pop() ?? value;
  }

  return value;
};

const renderBulkEditSelectCell = (column: string, value: string) => (
  <span className="bulk-edit-select-cell">
    <span className="bulk-edit-select-cell-value">
      {getSelectCellDisplayValue(column, value) || '-'}
    </span>
    <ChevronDown className="bulk-edit-select-cell-icon" size={14} />
  </span>
);

export const renderColumnDataEditor = (
  column: string,
  recordData: {
    value: string;
    data: {
      details: string;
      glossaryStatus: string;
      row?: Record<string, string>;
    };
  },
  options: {
    showSelectAffordance?: boolean;
    usePlainTextDescription?: boolean;
  } = {}
) => {
  const {
    value,
    data: { glossaryStatus, row },
  } = recordData;
  const itemStyles = getCsvCellStyleMetadata(row)?.[column];

  switch (column) {
    case 'status':
      return statusRenderer(value as Status);
    case 'glossaryStatus':
      return <Typography.Text>{glossaryStatus}</Typography.Text>;
    case 'expressionCode': {
      const language = String(row?.expressionLanguage ?? '');
      const firstLine = value.split('\n').find((line) => line.trim()) ?? '';
      const snippet =
        firstLine.length > 80 ? `${firstLine.slice(0, 80)}…` : firstLine;

      return value ? (
        <span className="bulk-edit-code-preview">
          {language && (
            <span
              className={`bulk-edit-code-lang-pill ${language.toLowerCase()}`}>
              {language}
            </span>
          )}
          <span className="bulk-edit-code-snippet">{snippet}</span>
        </span>
      ) : (
        value
      );
    }
    case 'description':
      if (options.usePlainTextDescription) {
        return value;
      }

      return (
        <RichTextEditorPreviewerV1
          enableSeeMoreVariant={false}
          markdown={value}
          reducePreviewLineClass="max-one-line"
        />
      );
    case 'parameterValues':
      return value ? (
        <Tooltip
          containerClassName="tw:max-w-sm tw:break-all"
          placement="top"
          title={value}>
          <TooltipTrigger>
            <span className="tw:block tw:truncate">{value}</span>
          </TooltipTrigger>
        </Tooltip>
      ) : (
        value
      );

    case 'owners':
    case 'owner':
    case 'reviewers':
    case 'tags':
    case 'glossaryTerms':
    case 'relatedTerms':
    case 'domains':
    case 'dataProducts':
    case 'relatedMetrics':
      return (
        <CsvCellPreview column={column} itemStyles={itemStyles} value={value} />
      );
    case 'extension':
      return value ? (
        <CsvCellPreview column={column} value={value} />
      ) : (
        <span className="bulk-edit-custom-property-placeholder">
          {t('label.add-entity', {
            entity: t('label.custom-property-plural').toLowerCase(),
          })}
        </span>
      );

    case 'metricType':
    case 'unitOfMeasurement':
    case 'granularity':
    case 'entityStatus':
    case 'tiers':
      return options.showSelectAffordance
        ? renderBulkEditSelectCell(column, value)
        : value;

    default:
      return value;
  }
};

export const getColumnConfig = (
  column: string,
  entityType: EntityType,
  multipleOwner: {
    user: boolean;
    team: boolean;
  },
  editable = false,
  isBulkEdit = false,
  useMetricRichGrid = isBulkEdit
): Column<Record<string, string>> => {
  const colType = column.split('.').pop() ?? '';
  const isMetricRichGrid =
    useMetricRichGrid && entityType === EntityType.METRIC;
  const isMetricEnumColumn =
    isMetricRichGrid && csvUtilsClassBase.metricEnumColumns().includes(colType);
  const shouldUsePlainTextEditor = isMetricRichGrid;
  const isLockedColumn =
    isBulkEdit && entityType === EntityType.METRIC && colType === 'name';
  const columnDisplayName =
    isMetricRichGrid && colType === 'extension'
      ? t('label.custom-property-plural')
      : startCase(column);
  const disabledColumns = isBulkEdit
    ? CSV_DISABLED_COLUMNS.includes(colType) || isLockedColumn
    : false;

  return {
    key: column,
    name: columnDisplayName,
    sortable: false,
    resizable: true,
    cellClass: () =>
      `rdg-cell-${column.replaceAll(/[^a-zA-Z0-9-_]/g, '')}${
        isLockedColumn ? ' rdg-cell-locked' : ''
      }${isMetricEnumColumn ? ' rdg-cell-select' : ''}`,
    editable: editable ? !disabledColumns : false,
    renderEditCell: csvUtilsClassBase.getEditor(
      colType,
      entityType,
      multipleOwner,
      {
        usePlainTextEditor: shouldUsePlainTextEditor,
      }
    ),
    renderCell: (data: RenderCellProps<Record<string, string>>) =>
      renderColumnDataEditor(
        colType,
        {
          value: String(data.row[column] ?? ''),
          data: { details: '', glossaryStatus: '', row: data.row },
        },
        {
          showSelectAffordance: isMetricEnumColumn,
          usePlainTextDescription: shouldUsePlainTextEditor,
        }
      ),
    minWidth: COLUMNS_WIDTH[colType] ?? 180,
  } as Column<Record<string, string>>;
};

export const getEntityColumnsAndDataSourceFromCSV = (
  csv: string[][],
  entityType: EntityType,
  multipleOwner: {
    user: boolean;
    team: boolean;
  },
  cellEditable: boolean,
  isBulkEdit: boolean,
  useMetricRichGrid = isBulkEdit
) => {
  const [cols, ...rows] = csv;

  const columns =
    cols?.map((column) =>
      getColumnConfig(
        column,
        entityType,
        multipleOwner,
        cellEditable,
        isBulkEdit,
        useMetricRichGrid
      )
    ) ?? [];

  const dataSource =
    rows.map((row, idx) => {
      return row.reduce(
        (acc: Record<string, string>, value: string, index: number) => {
          acc[cols[index]] = value;
          acc['id'] = idx + '';

          return acc;
        },
        {} as Record<string, string>
      );
    }) ?? [];

  return {
    columns,
    dataSource,
  };
};

export const getMetricColumnsAndDataSourceFromMetrics = (
  metrics: Metric[],
  headers: CsvHeaderDocumentation[],
  multipleOwner: {
    user: boolean;
    team: boolean;
  },
  cellEditable: boolean,
  isBulkEdit: boolean
) => ({
  columns: headers.map((header) =>
    getColumnConfig(
      getCsvHeaderKey(header),
      EntityType.METRIC,
      multipleOwner,
      cellEditable,
      isBulkEdit
    )
  ),
  dataSource: getMetricCsvRowsFromMetrics(metrics, headers),
});

export const getCSVStringFromColumnsAndDataSource = (
  columns: Array<Pick<Column<unknown>, 'key'>>,
  dataSource: Record<string, string>[]
) => {
  const fieldNames = columns.map((c) => c.key);

  const data = dataSource.map((row) =>
    Object.fromEntries(
      fieldNames.map((key) => {
        const value = String(row[key] ?? '');

        return [key, value];
      })
    )
  );

  return unparse(data, {
    columns: fieldNames,
    header: true,
    newline: '\n',
  });
};

/**
 * Classify an import-result row into a catalog operation using the server's
 * authoritative `status` + `details` columns (no client-side name matching).
 */
export const getImportOperation = (
  row: Record<string, string>
): BulkActionOperation => {
  const status = String(row.status ?? '').toLowerCase();
  let operation: BulkActionOperation = 'CREATE';

  if (status === Status.Failure || status === IMPORT_SKIPPED_STATUS) {
    operation = 'SKIP';
  } else if (String(row.details ?? '') === IMPORT_ENTITY_UPDATED_DETAIL) {
    operation = 'UPDATE';
  }

  return operation;
};

export const getImportOperationRowClass = (row: Record<string, string>) =>
  `bulk-edit-op-row-${getImportOperation(row).toLowerCase()}`;

export const getImportOperationSummary = (
  rows: Record<string, string>[]
): Record<BulkActionOperation, number> =>
  rows.reduce(
    (summary, row) => {
      summary[getImportOperation(row)] += 1;

      return summary;
    },
    {
      CREATE: 0,
      UPDATE: 0,
      NO_CHANGE: 0,
      SKIP: 0,
    } as Record<BulkActionOperation, number>
  );

/**
 *
 * @param value  The value of the custom property in string format
 * @param customProperty The custom property object
 * @returns  The value of the custom property in the correct type
 */
const convertCustomPropertyStringToValueExtensionBasedOnType = (
  value: string,
  customProperty?: CustomProperty
) => {
  switch (customProperty?.propertyType.name) {
    case 'entityReference': {
      const entity = value.split(':');

      return {
        type: entity[0],
        fullyQualifiedName: entity[1],
        name: removeOuterEscapes(entity[1]),
      } as EntityReference;
    }

    case 'entityReferenceList': {
      const values = value.split('|');

      return values.map((entity) => {
        const [key, itemValue] = entity.split(':');

        return {
          type: key,
          fullyQualifiedName: itemValue,
          name: removeOuterEscapes(itemValue),
        } as EntityReference;
      });
    }

    case 'enum': {
      if (value.includes('|')) {
        return value.split('|');
      } else {
        return [value];
      }
    }

    case 'timeInterval': {
      const [start, end] = value.split(':');

      return {
        start: Number(start),
        end: Number(end),
      };
    }

    case TABLE_TYPE_CUSTOM_PROPERTY: {
      // step 1: get the columns from the custom property config
      const columns =
        (customProperty?.customPropertyConfig?.config as Config)?.columns ?? [];

      // step 2: split the value by row
      const rowStringList = value.split('|');

      // step 3: convert the rowStringList into objects with column names as keys
      const rows = rowStringList.map((row) => {
        // Step 1: Replace commas inside double quotes with a placeholder
        const preprocessedInput = row.replaceAll(/"([^"]*)"/g, (_, p1) => {
          return `${p1.replaceAll(/,/g, '__COMMA__')}`;
        });

        // Step 2: Split the row by comma
        const rowValues = preprocessedInput.split(',');

        // create an object with column names as keys
        return columns.reduce((acc: Record<string, string>, column, index) => {
          // replace the placeholder with comma
          acc[column] = rowValues[index].replaceAll('__COMMA__', ',');

          return acc;
        }, {} as Record<string, string>);
      });

      // return the columns and rows
      return {
        columns: columns,
        rows: rows,
      };
    }

    default:
      return value;
  }
};

/**
 *
 * @param value  The value of the custom property in object format
 * @param customProperty The custom property object
 * @returns The value of the custom property in string format
 */
const convertCustomPropertyValueExtensionToStringBasedOnType = (
  value: ExtensionDataTypes,
  customProperty: CustomProperty
) => {
  switch (customProperty.propertyType.name) {
    case 'entityReference': {
      const entity = value as EntityReference;

      return `${entity.type}:${entity.fullyQualifiedName ?? ''}`;
    }

    case 'entityReferenceList': {
      let stringList = '';
      const values = value as unknown as EntityReference[];
      values.forEach((item, index) => {
        stringList += `${item.type}:${item.fullyQualifiedName ?? ''}${
          index + 1 === values.length ? '' : '|'
        }`;
      });

      return stringList;
    }
    case 'enum':
      return (value as unknown as string[]).map((item) => item).join('|');

    case 'timeInterval': {
      const interval = value as unknown as { start: number; end: number };

      return `${interval.start}:${interval.end}`;
    }

    case TABLE_TYPE_CUSTOM_PROPERTY: {
      const tableTypeValue = value as TableTypePropertyValueType;

      // step 1: get the columns from the custom property config
      const columns = tableTypeValue?.columns ?? [];

      // step 2: get the rows from the value
      const rows = tableTypeValue?.rows ?? [];

      // step 3: convert the rows into a string
      const rowStringList = rows.map((row) => {
        return columns
          .map((column) => {
            const value = row[column] ?? '';

            // if value contains comma, wrap it in quotes
            return value.includes(',') ? `"${value}"` : value;
          })
          .join(',');
      });

      return `${rowStringList.join('|')}`;
    }

    default:
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
  }
};

export const convertCustomPropertyStringToEntityExtension = (
  value: string,
  customPropertyType?: Type
) => {
  if (isUndefined(customPropertyType)) {
    return {};
  }

  // Step 1: Create a map of custom properties by name
  const customPropertiesMapByName: Record<string, CustomProperty> = {};

  customPropertyType.customProperties?.forEach(
    (cp) => (customPropertiesMapByName[cp.name] = cp)
  );

  // Step 2: Split the input into pairs using `;` and handle quoted strings properly
  const pairs = value.split(SEMICOLON_SPLITTER);

  // Step 3: Create a map of key-value pairs
  const result: ExtensionDataProps = {};

  // Step 4: Iterate over the pairs and convert them to key-value pairs
  pairs.forEach((pair) => {
    const cleanedText = removeOuterEscapes(pair);

    const [propertyName, ...propertyValueParts] = cleanedText.split(':');
    const propertyValue = propertyValueParts.join(':').trim(); // Join back in case of multiple `:`

    const trimmedPropertyName = propertyName.trim();

    // Clean up quotes if they are around the value
    if (trimmedPropertyName && propertyValue) {
      result[trimmedPropertyName] =
        convertCustomPropertyStringToValueExtensionBasedOnType(
          propertyValue,
          customPropertiesMapByName[trimmedPropertyName]
        );
    }
  });

  return result;
};

/**
 *
 * @param value  The value of the custom property in object format
 * @param customPropertyType  The custom property object
 * @returns  The value of the custom property in string format
 */
export const convertEntityExtensionToCustomPropertyString = (
  value?: ExtensionDataProps,
  customPropertyType?: Type
) => {
  if (isEmpty(customPropertyType) || isEmpty(value)) {
    return;
  }

  // Step 1: Create a map of custom properties by name
  const customPropertiesMapByName: Record<string, CustomProperty> = {};

  customPropertyType?.customProperties?.forEach(
    (cp) => (customPropertiesMapByName[cp.name] = cp)
  );

  // Step 2: Convert the object into an array of key-value pairs
  const objectArray = Object.entries(value ?? {});

  // Step 3: Convert the key-value pairs into a string
  let convertedString = '';
  objectArray.forEach(([key, value], index) => {
    const isLastElement = objectArray.length - 1 === index;
    // Check if the key exists in the custom properties map
    if (customPropertiesMapByName[key]) {
      // Convert the value to a string based on the type
      const stringValue =
        convertCustomPropertyValueExtensionToStringBasedOnType(
          value,
          customPropertiesMapByName[key]
        );

      const endValue = isLastElement ? '' : ';';

      const hasSeparator =
        isString(stringValue) &&
        (stringValue.includes(',') || stringValue.includes(';'));

      // Ensure stringValue is a string
      const safeStringValue = String(stringValue);

      // Check if the property type is markdown or sqlQuery or string and add quotes around the value
      if (
        ['markdown', 'sqlQuery', 'string'].includes(
          customPropertiesMapByName[key]?.propertyType?.name ?? ''
        ) &&
        hasSeparator
      ) {
        convertedString += `"${key}:${safeStringValue}"${endValue}`;
      } else if (
        // Check if the property type is table and add quotes around the value
        customPropertiesMapByName[key]?.propertyType?.name ===
        TABLE_TYPE_CUSTOM_PROPERTY
      ) {
        convertedString += `"${key}:${safeStringValue}"${endValue}`;
      } else {
        convertedString += `${key}:${safeStringValue}${endValue}`;
      }
    }
  });

  return `${convertedString}`;
};

/**
 * Splits a CSV string into an array of values, properly handling quoted values and commas.
 * Uses Papa Parse for robust CSV parsing.
 * @param input The CSV string to split
 * @returns Array of string values
 */
export const splitCSV = (input: string): string[] => {
  // First, normalize the input by replacing escaped quotes with a temporary marker
  const normalizedInput = input.replaceAll(/\\"/g, '__ESCAPED_QUOTE__');

  const result = parse<string[]>(normalizedInput, {
    delimiter: ',',
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim(),
    transform: (value: string) => {
      // Remove outer quotes if they exist and trim
      const trimmed = value.trim();
      if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
        return trimmed.slice(1, -1).trim();
      }

      return trimmed;
    },
  });

  // Restore the escaped quotes in the result and ensure no trailing spaces
  return (result.data[0] || []).map((value) =>
    value.replaceAll(/__ESCAPED_QUOTE__/g, '"').trim()
  );
};

export const getCustomPropertyEntityType = (entityType: EntityType) => {
  switch (entityType) {
    case EntityType.GLOSSARY:
      return EntityType.GLOSSARY_TERM;
    default:
      return entityType;
  }
};
