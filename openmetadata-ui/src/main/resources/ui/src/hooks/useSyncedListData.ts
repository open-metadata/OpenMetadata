/*
 *  Copyright 2026 Collate.
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
import { SelectItemType } from '@openmetadata/ui-core-components';
import { useEffect, useRef } from 'react';
import { useListData } from 'react-stately';

/**
 * Sync a useListData instance with an external string[] value. Replaces list content to avoid
 * duplicates, and relabels it when getLabel changes, e.g. once the labels have loaded.
 */
export const useSyncedListData = (
  values: string[],
  getLabel?: (v: string) => string
) => {
  const listData = useListData<SelectItemType>({ initialItems: [] });
  const prevRef = useRef<string[]>([]);
  const prevGetLabelRef = useRef(getLabel);

  useEffect(() => {
    const prev = prevRef.current;
    const same =
      prev.length === values.length && values.every((v, i) => v === prev[i]);
    if (!same || prevGetLabelRef.current !== getLabel) {
      const currentIds = listData.items.map((item) => item.id);
      currentIds.forEach((id) => listData.remove(id));
      values.forEach((v) =>
        listData.append({ id: v, label: getLabel ? getLabel(v) : v })
      );
      prevRef.current = values;
      prevGetLabelRef.current = getLabel;
    }
  }, [values, getLabel]);

  return listData;
};
