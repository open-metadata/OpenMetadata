/*
 *  Copyright 2025 Collate.
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
import Icon from '@ant-design/icons';
import { Button, Col, Input, Row, Typography } from 'antd';
import { AxiosError } from 'axios';
import { debounce } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconSearchV1 } from '../../../assets/svg/search.svg';
import { ENTITY_PATH } from '../../../constants/constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { SearchSettings } from '../../../generated/api/search/previewSearchRequest';
import { usePaging } from '../../../hooks/paging/usePaging';
import { searchPreview } from '../../../rest/searchAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../common/Loader/Loader';
import NextPrevious from '../../common/NextPrevious/NextPrevious';
import { PagingHandlerParams } from '../../common/NextPrevious/NextPrevious.interface';
import ExploreSearchCard from '../../ExploreV1/ExploreSearchCard/ExploreSearchCard';
import { SearchedDataProps } from '../../SearchedData/SearchedData.interface';
import './search-preview.less';

interface SearchPreviewProps {
  searchConfig: SearchSettings;
  handleRestoreDefaults: () => void;
  handleSaveChanges: () => void;
  isSaving: boolean;
  disabledSave: boolean;
}

const SearchPreview = ({
  searchConfig,
  handleRestoreDefaults,
  handleSaveChanges,
  isSaving,
  disabledSave,
}: SearchPreviewProps) => {
  const { t } = useTranslation();
  const { fqn } = useRequiredParams<{ fqn: keyof typeof ENTITY_PATH }>();
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<SearchedDataProps['data']>([]);
  const [searchValue, setSearchValue] = useState<string>('');
  const {
    currentPage,
    pageSize,
    paging,
    handlePageChange,
    handlePageSizeChange,
    handlePagingChange,
    showPagination,
  } = usePaging();

  const entityType = useMemo(() => ENTITY_PATH[fqn], [fqn]);

  const fetchAssets = useCallback(
    async ({
      page = currentPage,
      searchTerm = searchValue,
    }: { page?: number; searchTerm?: string } = {}) => {
      if (searchConfig && Object.keys(searchConfig).length > 0) {
        try {
          setIsLoading(true);
          const res = await searchPreview({
            from: (page - 1) * pageSize,
            size: pageSize,
            index: entityType as SearchIndex,
            query: searchTerm,
            queryFilter: '',
            searchSettings: searchConfig,
          });

          const hits = res.hits.hits as unknown as SearchedDataProps['data'];
          const totalCount = res?.hits?.total.value ?? 0;

          handlePagingChange({ total: totalCount });
          setData(hits);
        } catch (error) {
          showErrorToast(error as AxiosError);
        } finally {
          setIsLoading(false);
        }
      }
    },
    [currentPage, pageSize, searchConfig, entityType, handlePagingChange]
  );

  const renderSearchResults = () => {
    if (isLoading) {
      return <Loader />;
    }

    if (data.length === 0) {
      return <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.NO_DATA} />;
    }

    return (
      <>
        {data.map(({ _score, _source, _id = '' }) => (
          <ExploreSearchCard
            showEntityIcon
            className="search-card"
            classNameForBreadcrumb="breadcrumb-width"
            data-testid="searched-data-card"
            id={_id}
            key={_source.name}
            score={_score}
            searchValue={searchValue}
            showTags={false}
            source={_source}
          />
        ))}
        {showPagination && (
          <NextPrevious
            isNumberBased
            currentPage={currentPage}
            pageSize={pageSize}
            paging={paging}
            pagingHandler={({ currentPage }: PagingHandlerParams) =>
              handlePageChange(currentPage)
            }
            onShowSizeChange={handlePageSizeChange}
          />
        )}
      </>
    );
  };

  const searchResults = renderSearchResults();

  const debouncedSearch = useMemo(
    () =>
      debounce((searchTerm: string) => {
        if (searchConfig && Object.keys(searchConfig).length > 0) {
          fetchAssets({ searchTerm });
        }
      }, 1000),
    [fetchAssets]
  );

  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  const handleSearch = (value: string) => {
    setSearchValue(value);
    debouncedSearch(value);
  };

  useEffect(() => {
    if (searchConfig && Object.keys(searchConfig).length > 0) {
      fetchAssets({ searchTerm: searchValue, page: currentPage });
    }
  }, [searchConfig, currentPage]);

  return (
    <div className="search-preview">
      <Row className="d-flex justify-between items-center m-b-sm">
        <Col>
          <Typography.Text
            className="header-title"
            data-testid="search-preview">
            {t('label.preview')}
          </Typography.Text>
        </Col>
        <Col>
          <Button
            className="restore-defaults-btn font-semibold"
            data-testid="restore-defaults-btn"
            onClick={handleRestoreDefaults}>
            {t('label.restore-default-plural')}
          </Button>
          <Button
            className="save-btn font-semibold m-l-md"
            data-testid="save-btn"
            disabled={disabledSave}
            loading={isSaving}
            onClick={handleSaveChanges}>
            {t('label.save')}
          </Button>
        </Col>
      </Row>

      <Input
        allowClear
        className="search-box"
        data-testid="searchbar"
        placeholder={t('message.search-for-data-assets-placeholder')}
        suffix={
          <Icon className="text-md font-bold m-r-xs" component={IconSearchV1} />
        }
        type="text"
        value={searchValue}
        onChange={(e) => handleSearch(e.target.value)}
      />
      <div className="search-results-container">{searchResults}</div>
    </div>
  );
};

export default SearchPreview;
