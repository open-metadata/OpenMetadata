/*
 *  Copyright 2023 Collate.
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
import i18next from 'i18next';
import { isEmpty } from 'lodash';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import { EntityType } from '../../enums/entity.enum';
import {
  importEntityInCSVFormat,
  importServiceInCSVFormat,
} from '../../rest/importExportAPI';
import entityUtilClassBase from '../EntityUtilClassBase';
import Fqn from '../Fqn';

type ParsedDataType<T> = Array<T>;

export const parseCSV = <T extends Record<string, unknown>>(
  csvData: string[][]
): ParsedDataType<T> => {
  const recordList: ParsedDataType<T> = [];

  if (!isEmpty(csvData)) {
    const [headers, ...data] = csvData;

    data.forEach((line) => {
      const record: Record<string, unknown> = {};

      headers.forEach((header, index) => {
        record[header] = line[index] as unknown;
      });

      recordList.push(record as T);
    });
  }

  return recordList;
};

export const getImportedEntityType = (entityType: EntityType) => {
  switch (entityType) {
    case EntityType.DATABASE_SERVICE:
      return EntityType.DATABASE;

    case EntityType.DATABASE:
      return EntityType.DATABASE_SCHEMA;

    case EntityType.DATABASE_SCHEMA:
      return EntityType.TABLE;

    default:
      return entityType;
  }
};

export const getBulkEntityImportBreadcrumbList = (
  entityType: EntityType,
  fqn: string
): TitleBreadcrumbProps['titleLinks'] => [
  {
    name: Fqn.split(fqn).pop(),
    url: entityUtilClassBase.getEntityLink(entityType, fqn),
  },
  {
    name: i18next.t('label.import'),
    url: '',
    activeTitle: true,
  },
];

export const validateCsvString = async (
  csvData: string,
  entityType: EntityType,
  fqn: string,
  isBulkEdit: boolean
) => {
  const api =
    entityType === EntityType.DATABASE_SERVICE
      ? importServiceInCSVFormat
      : importEntityInCSVFormat;

  const response = await api({
    entityType,
    name: fqn,
    data: csvData,
    dryRun: true,
    recursive: !isBulkEdit,
  });

  return response;
};
