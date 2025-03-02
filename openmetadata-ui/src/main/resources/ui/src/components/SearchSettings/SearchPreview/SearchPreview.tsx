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
import { Input, Typography } from 'antd';
import { AxiosError } from 'axios';
import { debounce } from 'lodash';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { ReactComponent as IconSearchV1 } from '../../../assets/svg/search.svg';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { usePaging } from '../../../hooks/paging/usePaging';
import { searchQuery } from '../../../rest/searchAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../common/Loader/Loader';
import NextPrevious from '../../common/NextPrevious/NextPrevious';
import { PagingHandlerParams } from '../../common/NextPrevious/NextPrevious.interface';
import ExploreSearchCard from '../../ExploreV1/ExploreSearchCard/ExploreSearchCard';
import { SearchedDataProps } from '../../SearchedData/SearchedData.interface';
import './search-preview.less';

const SearchPreview = () => {
  const { t } = useTranslation();
  const { entityType } = useParams<{ entityType: string }>();
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

  const fetchAssets = useCallback(
    async ({ page = currentPage }: { page?: number } = {}) => {
      try {
        setIsLoading(true);
        const res = await searchQuery({
          pageNumber: page,
          pageSize: pageSize,
          searchIndex: [entityType as SearchIndex],
          query: `*${searchValue}*`,
          queryFilter: {},
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
    },
    [currentPage, pageSize, searchValue]
  );

  const renderSearchResults = () => {
    if (isLoading) {
      return <Loader />;
    }
    if (data.length > 0) {
      return (
        <>
          {data.map(({ _source, _id = '' }) => (
            <ExploreSearchCard
              showEntityIcon
              className="search-card"
              id={_id}
              key={_source.name}
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
    }

    return <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.NO_DATA} />;
  };

  const handleSearch = useCallback(
    debounce((value: string) => {
      setSearchValue(value);
    }, 1000),
    []
  );

  useEffect(() => {
    fetchAssets({ page: currentPage });
  }, [searchValue, currentPage, pageSize]);

  return (
    <div className="search-preview">
      <Typography.Title className="header-title" level={5}>
        {t('label.preview')}
      </Typography.Title>
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
      <div className="search-results-container">{renderSearchResults()}</div>
    </div>
  );
};

export default SearchPreview;
