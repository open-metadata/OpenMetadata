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
import { getEntityName } from './EntityNameUtils';
import { GenericNestedField } from './EntitySummaryPanelUtilsV1.interface';

/**
 * Shared utility to filter items by search text using case-insensitive
 * name/displayName matching. Used by all entity child components.
 */
export const filterItemsBySearchText = <T extends { name?: string }>(
  items: T[],
  searchText?: string
): T[] => {
  if (!searchText) {
    return items;
  }
  const lowerSearch = searchText.toLowerCase();

  return items.filter(
    (item) =>
      item.name?.toLowerCase().includes(lowerSearch) ||
      getEntityName(item)?.toLowerCase().includes(lowerSearch)
  );
};

// Shared recursive filter that preserves tree structure (used by Topic, Container, SearchIndex)
export const filterNestedFields = (
  fieldList: GenericNestedField[],
  searchText: string
): GenericNestedField[] => {
  const lowerSearch = searchText.toLowerCase();

  return fieldList.reduce<GenericNestedField[]>((acc, field) => {
    const nameMatch =
      field.name?.toLowerCase().includes(lowerSearch) ||
      getEntityName(field)?.toLowerCase().includes(lowerSearch);
    const filteredChildren = field.children
      ? filterNestedFields(field.children, searchText)
      : [];

    if (nameMatch || filteredChildren.length > 0) {
      acc.push({
        ...field,
        children: nameMatch ? field.children : filteredChildren,
      });
    }

    return acc;
  }, []);
};
