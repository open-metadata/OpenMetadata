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
import { TypeColumn } from '@inovua/reactdatagrid-community/types';
import { compact, get, isEmpty, isUndefined, startCase } from 'lodash';
import React from 'react';
import { ReactComponent as SuccessBadgeIcon } from '../..//assets/svg/success-badge.svg';
import { ReactComponent as FailBadgeIcon } from '../../assets/svg/fail-badge.svg';
import {
  ExtensionDataProps,
  ExtensionDataTypes,
} from '../../components/Modals/ModalWithCustomProperty/ModalWithMarkdownEditor.interface';
import { SEMICOLON_SPLITTER } from '../../constants/regex.constants';
import { EntityType } from '../../enums/entity.enum';
import {
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
  tiers: 120,
  status: 70,
};

const statusRenderer = ({
  value,
}: {
  value: Status;
  data: { details: string };
}) => {
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

export const getColumnConfig = (
  column: string,
  entityType: EntityType
): TypeColumn => {
  const colType = column.split('.').pop() ?? '';

  return {
    header: startCase(column),
    name: column,
    defaultFlex: 1,
    sortable: false,
    renderEditor: csvUtilsClassBase.getEditor(colType, entityType),
    minWidth: COLUMNS_WIDTH[colType] ?? 180,
    render: column === 'status' ? statusRenderer : undefined,
  } as TypeColumn;
};

export const getEntityColumnsAndDataSourceFromCSV = (
  csv: string[][],
  entityType: EntityType
) => {
  const [cols, ...rows] = csv;

  const columns =
    cols?.map((column) => getColumnConfig(column, entityType)) ?? [];

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

export const getCSVStringFromColumnsAndDataSource = (
  columns: TypeColumn[],
  dataSource: Record<string, string>[]
) => {
  const header = columns.map((col) => col.name).join(',');
  const rows = dataSource.map((row) => {
    const compactValues = compact(columns.map((col) => row[col.name ?? '']));

    if (compactValues.length === 0) {
      return '';
    }

    return columns
      .map((col) => {
        const value = get(row, col.name ?? '', '');
        const colName = col.name ?? '';
        if (colName === 'extension') {
          return `"${value.replaceAll(new RegExp('"', 'g'), '""')}"`;
        } else if (
          value.includes(',') ||
          value.includes('\n') ||
          colName.includes('tags') ||
          colName.includes('glossaryTerms') ||
          colName.includes('domain')
        ) {
          return isEmpty(value) ? '' : `"${value}"`;
        }

        return get(row, col.name ?? '', '');
      })
      .join(',');
  });

  return [header, ...compact(rows)].join('\n');
};

const convertCustomPropertyStringToValueExtensionBasedOnType = (
  value: string,
  customProperty: CustomProperty
) => {
  switch (customProperty?.propertyType.name) {
    case 'entityReference': {
      const entity = value.split(':');

      return {
        type: entity[0],
        fullyQualifiedName: entity[1],
        name: entity[1],
      } as EntityReference;
    }

    case 'entityReferenceList': {
      const values = value.split('|');

      return values.map((entity) => {
        const [key, itemValue] = entity.split(':');

        return {
          type: key,
          fullyQualifiedName: itemValue,
          name: itemValue,
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
        start,
        end,
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
      const interval = value as { start: string; end: string };

      return `${interval.start}:${interval.end}`;
    }

    default:
      return value;
  }
};

export const convertCustomPropertyStringToEntityExtension = (
  value: string,
  customPropertyType: Type
) => {
  if (isUndefined(customPropertyType)) {
    return {};
  }

  const keyAndValueTypes: Record<string, CustomProperty> = {};

  const result: ExtensionDataProps = {};

  customPropertyType.customProperties?.forEach(
    (cp) => (keyAndValueTypes[cp.name] = cp)
  );

  // Split the input into pairs using `;` and handle quoted strings properly
  const pairs = value.split(SEMICOLON_SPLITTER);

  pairs.forEach((pair) => {
    const cleanedText = removeOuterEscapes(pair);

    const [key, ...valueParts] = cleanedText.split(':');
    const value = valueParts.join(':').trim(); // Join back in case of multiple `:`

    // Clean up quotes if they are around the value
    if (key && value) {
      result[key.trim()] =
        convertCustomPropertyStringToValueExtensionBasedOnType(
          value,
          keyAndValueTypes[key]
        );
    }
  });

  return result;
};

export const convertEntityExtensionToCustomPropertyString = (
  value: ExtensionDataProps,
  customPropertyType?: Type
) => {
  if (isUndefined(customPropertyType)) {
    return '';
  }

  const keyAndValueTypes: Record<string, CustomProperty> = {};
  customPropertyType.customProperties?.forEach(
    (cp) => (keyAndValueTypes[cp.name] = cp)
  );

  let convertedString = '';

  const objectArray = Object.entries(value);

  objectArray.forEach(([key, value], index) => {
    const isLastElement = objectArray.length - 1 === index;
    if (keyAndValueTypes[key]) {
      const stringValue =
        convertCustomPropertyValueExtensionToStringBasedOnType(
          value,
          keyAndValueTypes[key]
        );

      if (
        ['markdown', 'sqlQuery'].includes(
          keyAndValueTypes[key].propertyType.name ?? ''
        )
      ) {
        convertedString += `"${`${key}:${stringValue}`}"${
          isLastElement ? '' : ';'
        }`;
      } else {
        convertedString += `${key}:${stringValue}${isLastElement ? '' : ';'}`;
      }
    }
  });

  return convertedString;
};
