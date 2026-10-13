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
  EmptyPlaceholder,
  Input,
  PaginationCardWithControls,
  Toggle,
} from '@openmetadata/ui-core-components';
import { Search } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { debounce } from 'lodash';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PAGE_SIZE_BASE } from '../../../../../../../constants/constants';
import { ENTITY_PATH_TO_SEARCH_INDEX } from '../../../../../../../constants/SearchSettings.constant';
import { SearchSettings } from '../../../../../../../generated/configuration/searchSettings';
import { searchPreview } from '../../../../../../../rest/searchAPI';
import { showErrorToast } from '../../../../../../../utils/ToastUtils';
import ExploreSearchCard from '../../../../../../ExploreV1/ExploreSearchCard/ExploreSearchCard';
import { SearchedDataProps } from '../../../../../../SearchedData/SearchedData.interface';
import { SettingsSkeleton } from '../SettingsFormLayout';
import { SearchSectionTitle } from './SearchSection';

const SEARCH_DEBOUNCE_MS = 1000;
const CONFIG_DEBOUNCE_MS = 400;

interface SearchPreviewPanelProps {
  entityType: string;
  /** The full settings with the unsaved draft applied. */
  searchConfig: SearchSettings;
}

/** Live results for the entity's index, ranked by the unsaved settings. */
const SearchPreviewPanel = ({
  entityType,
  searchConfig,
}: SearchPreviewPanelProps) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_BASE);
  const [showRankingDetails, setShowRankingDetails] = useState(false);
  const [hits, setHits] = useState<SearchedDataProps['data']>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const latestRequestId = useRef(0);
  // Slider drags change the draft many times a second; preview once it settles.
  const [previewConfig, setPreviewConfig] = useState(searchConfig);

  useEffect(() => {
    const handle = setTimeout(
      () => setPreviewConfig(searchConfig),
      CONFIG_DEBOUNCE_MS
    );

    return () => clearTimeout(handle);
  }, [searchConfig]);

  const debouncedSetSearchTerm = useMemo(
    () =>
      debounce((value: string) => {
        setSearchTerm(value);
        setPage(1);
      }, SEARCH_DEBOUNCE_MS),
    []
  );

  useEffect(
    () => () => debouncedSetSearchTerm.cancel(),
    [debouncedSetSearchTerm]
  );

  useEffect(() => {
    // A slow, superseded response must never overwrite the latest preview.
    const requestId = ++latestRequestId.current;
    const fetchPreview = async () => {
      setIsLoading(true);
      try {
        const response = await searchPreview({
          from: (page - 1) * pageSize,
          size: pageSize,
          index: ENTITY_PATH_TO_SEARCH_INDEX[entityType],
          query: searchTerm,
          queryFilter: '',
          explain: showRankingDetails,
          searchSettings: previewConfig,
        });
        if (requestId === latestRequestId.current) {
          setHits(response.hits.hits as unknown as SearchedDataProps['data']);
          setTotal(response.hits.total.value ?? 0);
        }
      } catch (error) {
        if (requestId === latestRequestId.current) {
          showErrorToast(error as AxiosError);
        }
      } finally {
        if (requestId === latestRequestId.current) {
          setIsLoading(false);
        }
      }
    };
    void fetchPreview();
  }, [
    entityType,
    page,
    pageSize,
    previewConfig,
    searchTerm,
    showRankingDetails,
  ]);

  const renderResults = () => {
    if (isLoading) {
      return <SettingsSkeleton rows={4} />;
    }

    if (hits.length === 0) {
      return (
        <div className="tw:relative tw:min-h-60">
          <EmptyPlaceholder
            data-testid="search-preview-empty"
            icon={<Search className="tw:text-quaternary" />}
            title={t('message.no-data-available')}
          />
        </div>
      );
    }

    return hits.map(
      ({
        _score,
        _source,
        _id = '',
        highlight,
        _explanation,
        matched_queries,
      }) => (
        <ExploreSearchCard
          showEntityIcon
          data-testid="searched-data-card"
          highlight={highlight}
          id={_id}
          key={_source.fullyQualifiedName}
          matchedQueries={showRankingDetails ? matched_queries : undefined}
          score={showRankingDetails ? _score : undefined}
          scoreExplanation={showRankingDetails ? _explanation : undefined}
          showTags={false}
          source={_source}
        />
      )
    );
  };

  return (
    <Box data-testid="search-preview" direction="col" gap={3}>
      <Box align="center" direction="row" gap={3} justify="between">
        <SearchSectionTitle>{t('label.preview')}</SearchSectionTitle>
        <Toggle
          data-testid="ranking-details-switch"
          isSelected={showRankingDetails}
          label={t('label.ranking-detail-plural')}
          onChange={setShowRankingDetails}
        />
      </Box>
      <Input
        aria-label={t('label.search')}
        icon={Search}
        inputDataTestId="search-preview-input"
        placeholder={t('message.search-for-data-assets-placeholder')}
        value={query}
        onChange={(value) => {
          setQuery(value);
          debouncedSetSearchTerm(value);
        }}
      />
      <Box direction="col" gap={2}>
        {renderResults()}
      </Box>
      {total > pageSize && (
        <PaginationCardWithControls
          page={page}
          pageSize={pageSize}
          total={Math.ceil(total / pageSize)}
          onPageChange={setPage}
          onPageSizeChange={(next) => {
            setPageSize(next);
            setPage(1);
          }}
        />
      )}
    </Box>
  );
};

export default SearchPreviewPanel;
