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
import { ButtonUtility, FilterSelect } from '@openmetadata/ui-core-components';
import { SwitchVertical01 } from '@openmetadata/ui-core-components/icons';
import { useTranslation } from 'react-i18next';
import { ASSET_FACETS, ASSET_SORT_OPTIONS } from './GlobalSearch.constants';
import { GlobalSearchFacetSelection } from './GlobalSearch.types';
import GlobalSearchFacetSelect from './GlobalSearchFacetSelect';

export interface GlobalSearchAssetBarProps {
  isVisible: boolean;
  query: string;
  facets: GlobalSearchFacetSelection;
  sort: string;
  onFacetChange: (field: string, values: string[]) => void;
  onSortChange: (sort: string) => void;
  onReverse: () => void;
}

const GlobalSearchAssetBar = ({
  isVisible,
  query,
  facets,
  sort,
  onFacetChange,
  onSortChange,
  onReverse,
}: GlobalSearchAssetBarProps) => {
  const { t } = useTranslation();

  if (!isVisible) {
    return null;
  }

  return (
    <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-1.5 tw:px-4 tw:pb-2">
      {ASSET_FACETS.map(({ field, labelKey }) => (
        <GlobalSearchFacetSelect
          field={field}
          key={field}
          labelKey={labelKey}
          query={query}
          selection={facets}
          onChange={onFacetChange}
        />
      ))}
      <span className="tw:flex-1" />
      <ButtonUtility
        color="tertiary"
        data-testid="global-search-sort-order"
        icon={SwitchVertical01}
        size="xs"
        tooltip={t('label.reverse-order')}
        onClick={onReverse}
      />
      <FilterSelect
        showRadio
        data-testid="global-search-sort"
        label={t('label.sort-by')}
        options={ASSET_SORT_OPTIONS.map((option) => ({
          value: option.value,
          label: t(option.labelKey),
        }))}
        selectedValues={[sort]}
        selectionMode="single"
        size="sm"
        triggerVariant="chip"
        onChange={(values) => values[0] && onSortChange(values[0])}
      />
    </div>
  );
};

export default GlobalSearchAssetBar;
