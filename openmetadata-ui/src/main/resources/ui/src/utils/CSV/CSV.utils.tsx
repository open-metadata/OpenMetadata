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
import { startCase } from 'lodash';
import type { Column, RenderCellProps } from 'react-data-grid';
import { ReactComponent as SuccessBadgeIcon } from '../..//assets/svg/success-badge.svg';
import { ReactComponent as FailBadgeIcon } from '../../assets/svg/fail-badge.svg';
import CsvCellPreview from '../../components/common/EntityImport/CsvCellPreview/CsvCellPreview.component';
import {
  BulkActionOperation,
  BULK_ACTION_OPERATIONS,
} from '../../components/common/EntityImport/OperationCell/OperationCell.interface';
import RichTextEditorPreviewerV1 from '../../components/common/RichTextEditor/RichTextEditorPreviewerV1';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import { EntityType } from '../../enums/entity.enum';
import {
  LabelType,
  Metric,
  TagSource,
} from '../../generated/entity/data/metric';
import { EntityReference } from '../../generated/entity/type';
import { Status } from '../../generated/type/csvImportResult';
import { CsvHeaderDocumentation } from '../../rest/csvAPI';
import { t } from '../i18next/LocalUtil';
import { COLUMNS_WIDTH, CSV_DISABLED_COLUMNS } from './CSVPureUtils';
import csvUtilsClassBase from './CSVUtilsClassBase';
import entityBulkEditConfigClassBase from './EntityBulkEditConfigClassBase';

export interface EditorProps {
  value: string;
  onChange: (value?: string) => void;
  onCancel: () => void;
  onComplete: (value?: string) => void;
}

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
  const config = entityBulkEditConfigClassBase.getConfig(entityType);
  const columnName = getCsvColumnName(column);

  return Boolean(
    config &&
      (config.hiddenColumns.includes(columnName) ||
        (isBulkEdit && config.bulkEditHiddenColumns.includes(columnName)))
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
  const bulkEditConfig = entityBulkEditConfigClassBase.getConfig(entityType);
  const isRichGrid = useMetricRichGrid && Boolean(bulkEditConfig?.richGrid);
  const isEnumColumn =
    isRichGrid && Boolean(bulkEditConfig?.enumColumns[colType]);
  // Bulk edit uses the synchronous inline text editor for text columns. The
  // lazy (Suspense) text editor does not mount reliably in the bulk-edit grid,
  // leaving text cells non-editable for non-metric entities.
  const shouldUsePlainTextEditor = isRichGrid || isBulkEdit;
  const isLockedColumn =
    isBulkEdit && Boolean(bulkEditConfig?.lockedColumns.includes(colType));
  const columnDisplayName =
    isRichGrid && colType === 'extension'
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
      }${isEnumColumn ? ' rdg-cell-select' : ''}`,
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
          showSelectAffordance: isEnumColumn,
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
