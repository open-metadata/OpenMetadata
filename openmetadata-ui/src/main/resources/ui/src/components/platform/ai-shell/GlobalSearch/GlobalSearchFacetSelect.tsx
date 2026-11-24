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
import {
  FilterSelect,
  FilterSelectOption,
} from '@openmetadata/ui-core-components';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getAggregateFieldOptions } from '../../../../rest/miscAPI';
import { GlobalSearchFacetSelection } from './GlobalSearch.types';
import { getFacetQueryFilter } from './GlobalSearch.utils';
import { getAssetSearchIndexes } from './useGlobalSearchResults';

interface AggregationBucket {
  key: string;
  doc_count: number;
}

export interface GlobalSearchFacetSelectProps {
  field: string;
  labelKey: string;
  query: string;
  selection: GlobalSearchFacetSelection;
  onChange: (field: string, values: string[]) => void;
}

/**
 * One asset facet. Values and counts load when the menu opens, counted
 * against the query and every other selected facet — the same narrowing
 * Explore's quick filters apply.
 */
const GlobalSearchFacetSelect = ({
  field,
  labelKey,
  query,
  selection,
  onChange,
}: GlobalSearchFacetSelectProps) => {
  const { t } = useTranslation();
  const [options, setOptions] = useState<FilterSelectOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const selected = selection[field] ?? [];

  const loadOptions = useCallback(
    async (isOpen: boolean) => {
      if (!isOpen) {
        return;
      }
      setIsLoading(true);
      try {
        const filter = getFacetQueryFilter(selection, field);
        const res = await getAggregateFieldOptions(
          getAssetSearchIndexes(),
          field,
          '',
          JSON.stringify(filter ?? {}),
          undefined,
          false,
          false,
          query.trim()
        );
        const aggregation = Object.values(res.data.aggregations ?? {})[0] as
          | { buckets?: AggregationBucket[] }
          | undefined;
        setOptions(
          (aggregation?.buckets ?? []).map((bucket) => ({
            value: bucket.key,
            label: bucket.key,
            count: bucket.doc_count,
          }))
        );
      } catch {
        setOptions([]);
      } finally {
        setIsLoading(false);
      }
    },
    [field, query, selection]
  );

  return (
    <FilterSelect
      searchable
      data-testid={`global-search-facet-${field}`}
      isLoading={isLoading}
      label={t(labelKey)}
      options={options}
      selectedValues={selected}
      selectionMode="multiple"
      size="sm"
      triggerVariant="chip"
      onChange={(values) => onChange(field, values)}
      onOpenChange={loadOptions}
    />
  );
};

export default GlobalSearchFacetSelect;
