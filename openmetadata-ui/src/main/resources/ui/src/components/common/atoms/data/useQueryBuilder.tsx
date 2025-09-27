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

import { useMemo } from 'react';
import { UrlState } from '../shared/types';

interface QueryConfig {
  [filterKey: string]: string;
}

interface UseQueryBuilderProps {
  urlState: UrlState;
  queryConfig: QueryConfig;
  baseFilter?: string;
}

export const useQueryBuilder = ({
  urlState,
  queryConfig,
  baseFilter = '',
}: UseQueryBuilderProps) => {
  const filterQuery = useMemo(() => {
    const filterParts: string[] = [];

    if (baseFilter) {
      filterParts.push(baseFilter);
    }

    Object.entries(urlState.filters).forEach(([filterKey, values]) => {
      if (Array.isArray(values) && values.length > 0) {
        const queryField = queryConfig[filterKey];
        if (queryField) {
          const formattedValues = values
            .map((value: string) => `"${value.replace(/"/g, '\\"')}"`)
            .join(' OR ');
          filterParts.push(`(${queryField}:(${formattedValues}))`);
        }
      }
    });

    return filterParts.join(' AND ');
  }, [urlState.filters, queryConfig, baseFilter]);

  return {
    filterQuery,
  };
};
