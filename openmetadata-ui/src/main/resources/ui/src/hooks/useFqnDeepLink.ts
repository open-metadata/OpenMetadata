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
import { useLocation } from 'react-router-dom';
import { findFieldByFQN, getParentKeysToExpand } from '../utils/TableUtils';

interface UseFqnDeepLinkProps<T> {
  data: T[];
  setHighlightedFqn: (fqn: string | undefined) => void;
  setExpandedRowKeys: (keys: (prev: string[]) => string[]) => void;
  openColumnDetailPanel: (field: T) => void;
  timeoutMs?: number;
}

export const useFqnDeepLink = <T extends { fullyQualifiedName?: string; children?: T[] }>({
  data,
  setHighlightedFqn,
  setExpandedRowKeys,
  openColumnDetailPanel,
  timeoutMs = 3000,
}: UseFqnDeepLinkProps<T>) => {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const fqn = decodeURIComponent(location.hash.slice(1));
      setHighlightedFqn(fqn);

      const parentKeys = getParentKeysToExpand(data, fqn);
      if (parentKeys.length > 0) {
        setExpandedRowKeys((prev) => [...new Set([...prev, ...parentKeys])]);
      }

      const matchedField = findFieldByFQN(data, fqn);
      if (matchedField) {
        openColumnDetailPanel(matchedField);
      }

      const timer = setTimeout(() => {
        if (!fqn) {return;}

        setHighlightedFqn(undefined);
      }, timeoutMs);

      return () => clearTimeout(timer);
    }
  }, [location.hash, data, openColumnDetailPanel, setHighlightedFqn, setExpandedRowKeys]);
};
