/*
 *  Copyright 2022 Collate.
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

import { FQN_SEPARATOR_CHAR } from '../constants/char.constants';
import { FqnPart } from '../enums/entity.enum';
import Fqn from './Fqn';

export const getPartialNameFromFQN = (
  fqn: string,
  arrTypes: Array<'service' | 'database' | 'table' | 'column'> = [],
  joinSeparator = '/'
): string => {
  const arrFqn = Fqn.split(fqn);

  const arrPartialName = [];
  for (const type of arrTypes) {
    if (type === 'service' && arrFqn.length > 0) {
      arrPartialName.push(arrFqn[0]);
    } else if (type === 'database' && arrFqn.length > 1) {
      arrPartialName.push(arrFqn[1]);
    } else if (type === 'table' && arrFqn.length > 2) {
      arrPartialName.push(arrFqn[2]);
    } else if (type === 'column' && arrFqn.length > 3) {
      arrPartialName.push(arrFqn[3]);
    }
  }

  return arrPartialName.join(joinSeparator);
};

/**
 * Retrieves a partial name from a fully qualified name (FQN) for tables.
 *
 * @param {string} fqn - The fully qualified name. It should be a decoded string.
 * @param {Array<FqnPart>} fqnParts - The parts of the FQN to include in the partial name. Defaults to an empty array.
 * @param {string} joinSeparator - The separator used to join the parts of the partial name. Defaults to '/'.
 * @return {string} The partial name derived from the FQN.
 */

export const getPartialNameFromTableFQN = (
  fqn: string,
  fqnParts: Array<FqnPart> = [],
  joinSeparator = '/'
): string => {
  if (!fqn) {
    return '';
  }
  const splitFqn = Fqn.split(fqn);
  // if nested column is requested, then ignore all the other
  // parts and just return the nested column name
  if (fqnParts.includes(FqnPart.NestedColumn)) {
    // Remove the first 4 parts (service, database, schema, table)

    return splitFqn.slice(4).join(FQN_SEPARATOR_CHAR);
  }

  if (fqnParts.includes(FqnPart.Topic)) {
    // Remove the first 2 parts ( service, database)
    return splitFqn.slice(2).join(FQN_SEPARATOR_CHAR);
  }

  if (fqnParts.includes(FqnPart.ApiEndpoint)) {
    // Remove the first 3 parts ( service, database, schema)
    return splitFqn.slice(3).join(FQN_SEPARATOR_CHAR);
  }

  if (fqnParts.includes(FqnPart.SearchIndexField)) {
    // Remove the first 2 parts ( service, searchIndex)
    return splitFqn.slice(2).join(FQN_SEPARATOR_CHAR);
  }

  if (fqnParts.includes(FqnPart.TestCase)) {
    // Get the last Part of the Fqn
    return splitFqn.splice(-1).join(FQN_SEPARATOR_CHAR);
  }

  const arrPartialName = [];
  if (splitFqn.length > 0) {
    if (fqnParts.includes(FqnPart.Service)) {
      arrPartialName.push(splitFqn[0]);
    }
    if (fqnParts.includes(FqnPart.Database) && splitFqn.length > 1) {
      arrPartialName.push(splitFqn[1]);
    }
    if (fqnParts.includes(FqnPart.Schema) && splitFqn.length > 2) {
      arrPartialName.push(splitFqn[2]);
    }
    if (fqnParts.includes(FqnPart.Table) && splitFqn.length > 3) {
      arrPartialName.push(splitFqn[3]);
    }
    if (fqnParts.includes(FqnPart.Column) && splitFqn.length > 4) {
      arrPartialName.push(splitFqn[4]);
    }
  }

  return arrPartialName.join(joinSeparator);
};

export const getTableFQNFromColumnFQN = (columnFQN: string): string => {
  return getPartialNameFromTableFQN(
    columnFQN,
    [FqnPart.Service, FqnPart.Database, FqnPart.Schema, FqnPart.Table],
    '.'
  );
};

export const getNameFromFQN = (fqn: string): string => {
  let arr: string[] = [];

  // Check for fqn containing name inside double quotes which can contain special characters such as '/', '.' etc.
  // Example: sample_data.example_table."example.sample/fqn"

  // Regular expression which matches pattern like '."some content"' at the end of string
  // Example in string 'sample_data."example_table"."example.sample/fqn"',
  // this regular expression  will match '."example.sample/fqn"'
  const regexForQuoteInFQN = /(\."[^"]+")$/g;

  if (regexForQuoteInFQN.test(fqn)) {
    arr = fqn.split('"');

    return arr[arr.length - 2];
  }

  arr = fqn.split(FQN_SEPARATOR_CHAR);

  return arr[arr.length - 1];
};
