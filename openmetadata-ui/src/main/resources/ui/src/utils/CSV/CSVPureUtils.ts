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
import { isEmpty, isString, isUndefined } from 'lodash';
import { parse, unparse } from 'papaparse';
import type { Column } from 'react-data-grid';
import type { TableTypePropertyValueType } from '../../components/common/CustomPropertyTable/CustomPropertyTable.interface';
import type {
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
import { removeOuterEscapes } from '../StringUtils';

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
  parameterValues: 300,
};

export const CSV_DISABLED_COLUMNS = [
  'name*',
  'testDefinition*',
  'entityFQN*',
  'testSuite',
];

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
      const columns =
        (customProperty?.customPropertyConfig?.config as Config)?.columns ?? [];

      const rowStringList = value.split('|');

      const rows = rowStringList.map((row) => {
        const preprocessedInput = row.replaceAll(/"([^"]*)"/g, (_, p1) => {
          return `${p1.replaceAll(/,/g, '__COMMA__')}`;
        });

        const rowValues = preprocessedInput.split(',');

        return columns.reduce((acc: Record<string, string>, column, index) => {
          acc[column] = rowValues[index].replaceAll('__COMMA__', ',');

          return acc;
        }, {} as Record<string, string>);
      });

      return {
        columns: columns,
        rows: rows,
      };
    }

    default:
      return value;
  }
};

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
      const interval = value as unknown as { start: string; end: string };

      return `${interval.start}:${interval.end}`;
    }

    case TABLE_TYPE_CUSTOM_PROPERTY: {
      const tableTypeValue = value as TableTypePropertyValueType;

      const columns = tableTypeValue?.columns ?? [];
      const rows = tableTypeValue?.rows ?? [];

      const rowStringList = rows.map((row) => {
        return columns
          .map((column) => {
            const cellValue = row[column] ?? '';

            return cellValue.includes(',') ? `"${cellValue}"` : cellValue;
          })
          .join(',');
      });

      return `${rowStringList.join('|')}`;
    }

    default:
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
  }
};

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

export const convertCustomPropertyStringToEntityExtension = (
  value: string,
  customPropertyType?: Type
) => {
  if (isUndefined(customPropertyType)) {
    return {};
  }

  const customPropertiesMapByName: Record<string, CustomProperty> = {};

  customPropertyType.customProperties?.forEach(
    (cp) => (customPropertiesMapByName[cp.name] = cp)
  );

  const pairs = value.split(SEMICOLON_SPLITTER);

  const result: ExtensionDataProps = {};

  pairs.forEach((pair) => {
    const cleanedText = removeOuterEscapes(pair);

    const [propertyName, ...propertyValueParts] = cleanedText.split(':');
    const propertyValue = propertyValueParts.join(':').trim();

    const trimmedPropertyName = propertyName.trim();

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

export const convertEntityExtensionToCustomPropertyString = (
  value?: ExtensionDataProps,
  customPropertyType?: Type
) => {
  if (isEmpty(customPropertyType) || isEmpty(value)) {
    return;
  }

  const customPropertiesMapByName: Record<string, CustomProperty> = {};

  customPropertyType?.customProperties?.forEach(
    (cp) => (customPropertiesMapByName[cp.name] = cp)
  );

  const objectArray = Object.entries(value ?? {});

  let convertedString = '';
  objectArray.forEach(([key, entryValue], index) => {
    const isLastElement = objectArray.length - 1 === index;
    if (customPropertiesMapByName[key]) {
      const stringValue =
        convertCustomPropertyValueExtensionToStringBasedOnType(
          entryValue,
          customPropertiesMapByName[key]
        );

      const endValue = isLastElement ? '' : ';';

      const hasSeparator =
        isString(stringValue) &&
        (stringValue.includes(',') || stringValue.includes(';'));

      const safeStringValue = String(stringValue);

      if (
        ['markdown', 'sqlQuery', 'string'].includes(
          customPropertiesMapByName[key]?.propertyType?.name ?? ''
        ) &&
        hasSeparator
      ) {
        convertedString += `"${key}:${safeStringValue}"${endValue}`;
      } else if (
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

export const splitCSV = (input: string): string[] => {
  const normalizedInput = input.replaceAll(/\\"/g, '__ESCAPED_QUOTE__');

  const result = parse<string[]>(normalizedInput, {
    delimiter: ',',
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim(),
    transform: (csvValue: string) => {
      const trimmed = csvValue.trim();
      if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
        return trimmed.slice(1, -1).trim();
      }

      return trimmed;
    },
  });

  return (result.data[0] || []).map((csvValue) =>
    csvValue.replaceAll(/__ESCAPED_QUOTE__/g, '"').trim()
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
