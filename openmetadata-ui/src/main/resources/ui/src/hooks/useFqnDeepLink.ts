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
import { useEffect } from 'react';
import { findFieldByFQN, getParentKeysToExpand } from '../utils/TableUtils';

interface UseFqnDeepLinkProps<T> {
  data: T[];
  columnPart?: string;
  setExpandedRowKeys: (keys: (prev: string[]) => string[]) => void;
  openColumnDetailPanel: (field: T) => void;
  selectedColumn?: T | null;
  fqn?: string;
}

export const useFqnDeepLink = <
  T extends { fullyQualifiedName?: string; children?: T[] }
>({
  data,
  columnPart,
  fqn,
  setExpandedRowKeys,
  openColumnDetailPanel,
  selectedColumn,
}: UseFqnDeepLinkProps<T>) => {
  useEffect(() => {
    if (!columnPart || !fqn) {
      return;
    }

    const fullColumnFqn = fqn;

    const parentKeys = getParentKeysToExpand(data, fullColumnFqn);
    if (parentKeys.length > 0) {
      setExpandedRowKeys((prev) => [...new Set([...prev, ...parentKeys])]);
    }

    const matchedField = findFieldByFQN(data, fullColumnFqn);
    if (matchedField) {
      if (
        selectedColumn?.fullyQualifiedName !== matchedField.fullyQualifiedName
      ) {
        openColumnDetailPanel(matchedField);
      }
    }
  }, [
    columnPart,
    fqn,
    data,
    openColumnDetailPanel,
    selectedColumn,
    setExpandedRowKeys,
  ]);
};
