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

import { FilterValue } from 'antd/lib/table/interface';
import { isEmpty } from 'lodash';
import { TagsData } from 'Models';
import { useCallback, useMemo, useState } from 'react';
import { TABLE_COLUMNS_KEYS } from '../constants/TableKeys.constants';
import { getFilteredTagsData } from '../utils/TableTags/TableTags.utils';

/**
 * Antd's column filter only prunes top-level rows and leaves nested `children`
 * untouched. For trees (schema fields, table columns, tasks, charts) the tag
 * column filter therefore keeps every child of a matched parent. This hook owns
 * the controlled filter state for the Classification (`tags`) and Glossary tag
 * columns and returns a tree pruned to only the matched nodes (plus their
 * ancestor path). Wire it as:
 *
 *  const { tagFilterState, filteredData, handleTableChange } =
 *    useTreeTagFilter(sourceData);
 *
 * then set `filteredValue: tagFilterState[KEY] ?? null` on each tag column
 * (dropping `onFilter`), pass `dataSource={filteredData}` and
 * `onChange={handleTableChange}` to the table.
 */
export const useTreeTagFilter = <T extends TagsData>(data: T[]) => {
  const [tagFilterState, setTagFilterState] = useState<
    Record<string, FilterValue | null>
  >({});

  const handleTableChange = useCallback(
    (_pagination: unknown, filters: Record<string, FilterValue | null>) => {
      setTagFilterState(filters);
    },
    []
  );

  const selectedTags = useMemo(
    () => [
      ...(tagFilterState[TABLE_COLUMNS_KEYS.TAGS] ?? []),
      ...(tagFilterState[TABLE_COLUMNS_KEYS.GLOSSARY] ?? []),
    ],
    [tagFilterState]
  );

  const filteredData = useMemo(
    () =>
      isEmpty(selectedTags) ? data : getFilteredTagsData(data, selectedTags),
    [data, selectedTags]
  );

  return { tagFilterState, filteredData, handleTableChange };
};
