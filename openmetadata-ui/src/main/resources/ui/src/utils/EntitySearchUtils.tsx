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

import { isUndefined, lowerCase } from 'lodash';
import { SearchedDataProps } from '../components/SearchedData/SearchedData.interface';
import { SearchIndexField } from '../generated/entity/data/searchIndex';
import { Column } from '../generated/entity/data/table';
import { getEntityName } from './EntityNameUtils';
import { getDataTypeString } from './TablePureUtils';

/**
 * It searches for a given text in a given table and returns a new table with only the columns that
 * contain the given text
 * @param {Column[]} table - Column[] - the table to search in
 * @param {string} searchText - The text to search for.
 * @returns An array of columns that have been searched for a specific string.
 */
export const searchInColumns = <T extends Column | SearchIndexField>(
  table: T[],
  searchText: string
): T[] => {
  const searchedValue: T[] = table.reduce((searchedCols, column) => {
    const searchLowerCase = lowerCase(searchText);
    const isContainData =
      lowerCase(column.name).includes(searchLowerCase) ||
      lowerCase(column.displayName).includes(searchLowerCase) ||
      lowerCase(column.description).includes(searchLowerCase) ||
      lowerCase(getDataTypeString(column.dataType)).includes(searchLowerCase);

    if (isContainData) {
      return [...searchedCols, column];
    } else if (!isUndefined(column.children)) {
      const searchedChildren = searchInColumns<T>(
        column.children as T[],
        searchText
      );
      if (searchedChildren.length > 0) {
        return [
          ...searchedCols,
          {
            ...column,
            children: searchedChildren,
          },
        ];
      }
    }

    return searchedCols;
  }, [] as T[]);

  return searchedValue;
};

export const highlightEntityNameAndDescription = (
  entity: SearchedDataProps['data'][number]['_source'],
  highlight: SearchedDataProps['data'][number]['highlight']
): SearchedDataProps['data'][number]['_source'] => {
  let entityDescription = entity.description ?? '';
  const descHighlights = highlight?.description ?? [];

  if (descHighlights.length > 0) {
    const matchTextArr = descHighlights.map((val: string) =>
      val.replace(/<\/?span(.*?)>/g, '')
    );

    matchTextArr.forEach((text: string, i: number) => {
      entityDescription = entityDescription.replace(text, descHighlights[i]);
    });
  }

  let entityDisplayName = getEntityName(entity);
  if (!isUndefined(highlight)) {
    entityDisplayName =
      highlight?.displayName?.join(' ') ||
      highlight?.name?.join(' ') ||
      entityDisplayName;
  }

  return {
    ...entity,
    displayName: entityDisplayName,
    description: entityDescription,
  };
};

export const highlightSearchText = (
  text?: string,
  searchText?: string
): string => {
  if (!searchText || !text) {
    return text ?? '';
  }

  const regex = new RegExp(`(${searchText})`, 'gi');

  return text.replace(
    regex,
    `<span data-highlight="true" class="text-highlighter">$1</span>`
  );
};

/**
 * It searches for a given text in a given string and returns an array that contains the string parts that have
 * highlighted element if match found.
 * @param text - The text to search in.
 * @param searchText - The text to search for.
 * @returns An Array of string or JSX.Element which contains highlighted element.
 */
export const highlightSearchArrayElement = (
  text?: string,
  searchText?: string
): string | (string | JSX.Element)[] => {
  if (!searchText || !text) {
    return text ?? '';
  }
  const stringParts = text.split(new RegExp(`(${searchText})`, 'gi'));

  return stringParts.map((part, index) =>
    part.toLowerCase() === (searchText ?? '').toLowerCase() ? (
      <span className="text-highlighter" key={`${part}-${index}`}>
        {part}
      </span>
    ) : (
      part
    )
  );
};
