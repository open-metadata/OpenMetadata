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
  Box,
  Button,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { SearchSourceAlias } from '../../../../interface/search.interface';
import UserAssetCard from './UserAssetCard';
import { SKELETON_KEYS } from './UserAssets.constants';

interface UserAssetCardListProps {
  assets: SearchSourceAlias[];
  selectedId?: string;
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onSelect: (source: SearchSourceAlias) => void;
}

const UserAssetCardList: React.FC<UserAssetCardListProps> = ({
  assets,
  selectedId,
  isLoading,
  hasMore,
  onLoadMore,
  onSelect,
}) => {
  const { t } = useTranslation();

  return (
    <Box
      className="tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:pb-1"
      data-testid="user-assets-list"
      direction="col"
      gap={3}>
      {assets.map((asset) => (
        <UserAssetCard
          isSelected={asset.id === selectedId}
          key={asset.id}
          source={asset}
          onSelect={onSelect}
        />
      ))}
      {isLoading &&
        SKELETON_KEYS.map((key) => (
          <Skeleton height={112} key={key} variant="rounded" />
        ))}
      {!isLoading && assets.length === 0 && (
        <Box
          className="tw:rounded-xl tw:border tw:border-dashed tw:border-primary tw:p-8"
          data-testid="user-assets-no-match"
          justify="center">
          <Typography className="tw:text-tertiary" size="text-sm">
            {t('message.no-assets-match-your-search')}
          </Typography>
        </Box>
      )}
      {hasMore && (
        <Button
          className="tw:self-center"
          color="secondary"
          data-testid="user-assets-load-more"
          size="sm"
          onClick={onLoadMore}>
          {t('label.load-more')}
        </Button>
      )}
    </Box>
  );
};

export default UserAssetCardList;
