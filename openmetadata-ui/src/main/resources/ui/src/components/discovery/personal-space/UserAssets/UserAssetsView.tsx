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

import { Box, FilterSelect, Input } from '@openmetadata/ui-core-components';
import { FilterLines, Search } from '@openmetadata/ui-core-components/icons';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { User } from '../../../../generated/entity/teams/user';
import { useDebouncedValue } from '../../../../hooks/common/useDebouncedValue';
import SomethingWentWrongPlaceholder from '../../../common/EmptyPlaceholder/SomethingWentWrongPlaceholder';
import EntitySummaryPanel from '../../../Explore/EntitySummaryPanel/EntitySummaryPanel.component';
import UserAssetCardList from './UserAssetCardList';
import { SEARCH_DEBOUNCE_MS, TYPE_OPTIONS } from './UserAssets.constants';
import { getSelectedAsset, UserAssetsKind } from './UserAssets.utils';
import UserAssetsEmpty from './UserAssetsEmpty';
import UserAssetStats from './UserAssetStats';
import { useUserAssetsList } from './useUserAssetsList';

export interface UserAssetsViewProps {
  user: User;
  kind: UserAssetsKind;
  // Stat tiles render only for kind === 'owned'.
  showStats?: boolean;
}

/**
 * A user's owned or followed assets: optional stat tiles, a search + type
 * filter, the asset cards and the selected asset's summary panel.
 */
const UserAssetsView: React.FC<UserAssetsViewProps> = ({
  user,
  kind,
  showStats = true,
}) => {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const search = useDebouncedValue(searchText.trim(), SEARCH_DEBOUNCE_MS);
  const [indexes, setIndexes] = useState<string[]>([]);
  // `null` once the summary panel is closed; undefined until a card is picked.
  const [selectedId, setSelectedId] = useState<string | null>();
  const { assets, total, isLoading, error, hasMore, loadMore, retry } =
    useUserAssetsList(kind, user, search, indexes);
  const selected = getSelectedAsset(assets, selectedId);
  const searchLabel = t('label.search-entity', {
    entity: t('label.asset-plural-lowercase'),
  });
  const isUnfiltered = !search && indexes.length === 0;
  const hasNoAssets = !isLoading && !error && total === 0 && isUnfiltered;

  return (
    <Box
      className="tw:min-h-0 tw:flex-1"
      data-testid="user-assets-view"
      direction="col"
      gap={4}>
      {showStats && kind === 'owned' && <UserAssetStats user={user} />}
      {hasNoAssets ? (
        <UserAssetsEmpty kind={kind} user={user} />
      ) : (
        <Box className="tw:grid tw:min-h-0 tw:flex-1 tw:grid-cols-[minmax(0,1fr)_minmax(0,420px)] tw:gap-4">
          <Box className="tw:min-h-0 tw:min-w-0" direction="col" gap={3}>
            <Box align="center" className="tw:shrink-0" gap={2}>
              <FilterSelect
                bordered
                hideCounts
                data-testid="user-assets-type-filter"
                label={t('label.type')}
                options={TYPE_OPTIONS}
                popoverClassName="tw:w-52"
                selectedValues={indexes}
                selectionMode="multiple"
                triggerIcon={FilterLines}
                triggerVariant="button"
                onChange={setIndexes}
              />
              <Input
                aria-label={searchLabel}
                className="tw:min-w-0 tw:flex-1"
                icon={Search}
                inputDataTestId="user-assets-search"
                placeholder={searchLabel}
                value={searchText}
                onChange={setSearchText}
              />
            </Box>
            {error ? (
              <Box className="tw:relative tw:min-h-80 tw:flex-1">
                <SomethingWentWrongPlaceholder onReload={retry} />
              </Box>
            ) : (
              <UserAssetCardList
                assets={assets}
                hasMore={hasMore}
                isLoading={isLoading}
                selectedId={selected?.id}
                onLoadMore={loadMore}
                onSelect={(source) => setSelectedId(source.id)}
              />
            )}
          </Box>
          {selected && (
            <Box
              className="tw:min-h-0 tw:min-w-0 tw:overflow-y-auto"
              data-testid="user-assets-summary">
              {/* "explore" keeps the panel's own container transparent, so the
                  summary and rail sit on the dialog surface in both themes. */}
              <EntitySummaryPanel
                entityDetails={{ details: selected }}
                handleClosePanel={() => setSelectedId(null)}
                panelPath="explore"
              />
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default UserAssetsView;
