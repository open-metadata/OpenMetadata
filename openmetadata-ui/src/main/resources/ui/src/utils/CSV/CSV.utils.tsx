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
import { Typography } from 'antd';
import {
  compact,
  get,
  isEmpty,
  isString,
  isUndefined,
  startCase,
} from 'lodash';
import { parse } from 'papaparse';
import { Column } from 'react-data-grid';
import { ReactComponent as SuccessBadgeIcon } from '../..//assets/svg/success-badge.svg';
import { ReactComponent as FailBadgeIcon } from '../../assets/svg/fail-badge.svg';
import { TableTypePropertyValueType } from '../../components/common/CustomPropertyTable/CustomPropertyTable.interface';
import RichTextEditorPreviewerV1 from '../../components/common/RichTextEditor/RichTextEditorPreviewerV1';
import {
  ExtensionDataProps,
  ExtensionDataTypes,
} from '../../components/Modals/ModalWithCustomProperty/ModalWithMarkdownEditor.interface';
import { TABLE_TYPE_CUSTOM_PROPERTY } from '../../constants/CustomProperty.constants';
import { SEMICOLON_SPLITTER } from '../../constants/regex.constants';
import { EntityType } from '../../enums/entity.enum';
import {
  Config,
  CustomProperty,
  EntityReference,
  Type,
} from '../../generated/entity/type';
import { Status } from '../../generated/type/csvImportResult';
import { removeOuterEscapes } from '../CommonUtils';
import csvUtilsClassBase from './CSVUtilsClassBase';

export interface EditorProps {
  value: string;
  onChange: (value?: string) => void;
  onCancel: () => void;
  onComplete: (value?: string) => void;
}

export const COLUMNS_WIDTH: Record<string, number> = {
  description: 300,
  tags: 280,
  glossaryTerms: 280,
  'entityType*': 230,
  arrayDataType: 210,
  dataTypeDisplay: 220,
  fullyQualifiedName: 300,
  tiers: 120,
  status: 70,
};

export const CSV_DISABLED_COLUMNS = [
  'name*',
  'testDefinition*',
  'entityFQN*',
  'testSuite',
];

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

export const renderColumnDataEditor = (
  column: string,
  recordData: {
    value: string;
    data: { details: string; glossaryStatus: string };
  }
) => {
  const {
    value,
    data: { glossaryStatus },
  } = recordData;
  switch (column) {
    case 'status':
      return statusRenderer(value as Status);
    case 'glossaryStatus':
      return <Typography.Text>{glossaryStatus}</Typography.Text>;
    case 'description':
      return (
        <RichTextEditorPreviewerV1
          enableSeeMoreVariant={false}
          markdown={value}
          reducePreviewLineClass="max-one-line"
        />
      );

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
  isBulkEdit = false
): Column<any> => {
  const colType = column.split('.').pop() ?? '';
  const disabledColumns = isBulkEdit
    ? CSV_DISABLED_COLUMNS.includes(colType)
    : false;

  return {
    key: column,
    name: startCase(column),
    sortable: false,
    resizable: true,
    cellClass: () => `rdg-cell-${column.replaceAll(/[^a-zA-Z0-9-_]/g, '')}`,
    editable: editable ? !disabledColumns : false,
    renderEditCell: csvUtilsClassBase.getEditor(
      colType,
      entityType,
      multipleOwner
    ),
    renderCell: (data: any) =>
      renderColumnDataEditor(colType, {
        value: data.row[column],
        data: { details: '', glossaryStatus: '' },
      }),
    minWidth: COLUMNS_WIDTH[colType] ?? 180,
  } as Column<any>;
};

/**
 * Checks if a column is a special column that requires special quote handling.
 */
const isSpecialColumn = (colName?: string): boolean => {
  if (!colName) {
    return false;
  }

  return (
    csvUtilsClassBase
      .columnsWithMultipleValuesEscapeNeeded()
      .includes(colName) ||
    colName === 'tags' ||
    colName === 'domains' ||
    colName.endsWith('.tags') ||
    colName.endsWith('.domains')
  );
};

/**
 * Checks if a column is a domains column.
 */
const isDomainsColumn = (colName?: string): boolean => {
  return colName === 'domains' || colName?.endsWith('.domains') || false;
};

/**
 * Strips all wrapper quotes from a value, handling multiple quote layers.
 * Continues until no more wrapper quotes are found or length stops decreasing.
 */
const stripAllWrapperQuotes = (value: string): string => {
  let normalized = value.trim();
  let previousLength = normalized.length + 1;

  while (
    normalized.length >= 2 &&
    normalized.startsWith('"') &&
    normalized.endsWith('"') &&
    normalized.length < previousLength
  ) {
    previousLength = normalized.length;

    // Handle triple quotes first ("""value""")
    if (
      normalized.startsWith('"""') &&
      normalized.endsWith('"""') &&
      normalized.length > 6
    ) {
      normalized = normalized.slice(3, -3);

      continue;
    }

    // Handle single quotes ("value")
    const innerValue = normalized.slice(1, -1);

    if (innerValue.length === 0) {
      return '';
    }

    if (!innerValue.startsWith('"') || !innerValue.endsWith('"')) {
      normalized = innerValue;
    } else {
      const doubleStripped = innerValue.slice(1, -1);

      if (doubleStripped.length > 0) {
        normalized = doubleStripped;
      } else {
        break;
      }
    }
  }

  return normalized;
};

/**
 * Normalizes CSV values during import by stripping wrapper quotes.
 * All columns use the same stripping logic, then unescape double quotes.
 * @param colName - Optional column name (kept for backward compatibility)
 */
const normalizeCSVValue = (value: string, _colName?: string): string => {
  if (typeof value !== 'string') {
    return value;
  }

  const normalized = stripAllWrapperQuotes(value);

  // Unescape double quotes ("" -> ")
  return normalized.replace(/""/g, '"');
};

export const getEntityColumnsAndDataSourceFromCSV = (
  csv: string[][],
  entityType: EntityType,
  multipleOwner: {
    user: boolean;
    team: boolean;
  },
  cellEditable: boolean,
  isBulkEdit: boolean
) => {
  const [cols, ...rows] = csv;

  const columns =
    cols?.map((column) =>
      getColumnConfig(
        column,
        entityType,
        multipleOwner,
        cellEditable,
        isBulkEdit
      )
    ) ?? [];

  const dataSource =
    rows.map((row, idx) => {
      return row.reduce(
        (acc: Record<string, string>, value: string, index: number) => {
          const colName = cols[index];
          const normalizedValue =
            typeof value === 'string'
              ? normalizeCSVValue(value, colName)
              : value;
          acc[colName] = normalizedValue;
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

/**
 * Normalizes values before export by stripping all wrapper quotes.
 * This prevents quote accumulation when re-exporting previously imported data.
 */
const normalizeValueForExport = (value: string): string => {
  if (typeof value !== 'string') {
    return String(value);
  }

  return stripAllWrapperQuotes(value);
};

/**
 * Determines if a value needs to be wrapped in quotes for CSV export.
 */
const needsWrapping = (value: string, colName: string): boolean => {
  const hasSpecialChars = value.includes(',') || value.includes('\n');
  const isSpecialCol = isSpecialColumn(colName);

  return hasSpecialChars || isSpecialCol || value.includes('"');
};

const getQuoteStyle = (value: string, colName: string): 'single' | 'triple' => {
  if (isDomainsColumn(colName)) {
    return 'triple';
  }

  if (isSpecialColumn(colName) && value.includes('"')) {
    return 'triple';
  }

  return 'single';
};

const formatValueForCSV = (value: string, colName: string): string => {
  if (isEmpty(value)) {
    return '';
  }

  const normalizedValue = normalizeValueForExport(value);
  const escapedValue = normalizedValue.replaceAll(/"/g, '""');

  if (!needsWrapping(normalizedValue, colName)) {
    return normalizedValue;
  }

  const quoteStyle = getQuoteStyle(normalizedValue, colName);

  if (quoteStyle === 'triple') {
    return `"""${escapedValue}"""`;
  }

  return `"${escapedValue}"`;
};

export const getCSVStringFromColumnsAndDataSource = (
  columns: Column<any>[],
  dataSource: Record<string, string>[]
) => {
  const header = columns.map((col) => col.key).join(',');
  const rows = dataSource.map((row) => {
    const compactValues = compact(columns.map((col) => row[col.key ?? '']));

    if (compactValues.length === 0) {
      return '';
    }

    return columns
      .map((col) => {
        const value = get(row, col.key ?? '', '');
        const colName = col.key ?? '';

        return formatValueForCSV(String(value), colName);
      })
      .join(',');
  });

  return [header, ...compact(rows)].join('\n');
};

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
      const interval = value as { start: string; end: string };

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
