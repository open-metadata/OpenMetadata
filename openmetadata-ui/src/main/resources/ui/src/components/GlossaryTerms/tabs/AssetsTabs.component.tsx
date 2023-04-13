/*
 *  Copyright 2022 Collate.
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

import { Button } from 'antd';
import type { ButtonType } from 'antd/lib/button';
import classNames from 'classnames';
import { AssetsUnion } from 'components/Assets/AssetsSelectionModal/AssetSelectionModal.interface';
import NextPrevious from 'components/common/next-previous/NextPrevious';
import TableDataCardV2 from 'components/common/table-data-card-v2/TableDataCardV2';
import { EntityDetailsObjectInterface } from 'components/Explore/explore.interface';
import Loader from 'components/Loader/Loader';
import { OperationPermission } from 'components/PermissionProvider/PermissionProvider.interface';
import {
  SearchedDataProps,
  SourceType,
} from 'components/searched-data/SearchedData.interface';
import { AssetsFilterOptions } from 'constants/Assets.constants';
import { PAGE_SIZE } from 'constants/constants';
import { GLOSSARIES_DOCS } from 'constants/docs.constants';
import { ERROR_PLACEHOLDER_TYPE } from 'enums/common.enum';
import { EntityType } from 'enums/entity.enum';
import { SearchIndex } from 'enums/search.enum';
import { t } from 'i18next';
import { startCase } from 'lodash';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';
import { useParams } from 'react-router-dom';
import { searchData } from 'rest/miscAPI';
import { showErrorToast } from 'utils/ToastUtils';
import { getCountBadge } from '../../../utils/CommonUtils';
import ErrorPlaceHolder from '../../common/error-with-placeholder/ErrorPlaceHolder';

interface Props {
  onAddAsset: () => void;
  permissions: OperationPermission;
  onAssetClick?: (asset?: EntityDetailsObjectInterface) => void;
  isSummaryPanelOpen: boolean;
}

export interface AssetsTabRef {
  refreshAssets: () => void;
  closeSummaryPanel: () => void;
}

const AssetsTabs = forwardRef(
  (
    { permissions, onAssetClick, isSummaryPanelOpen, onAddAsset }: Props,
    ref
  ) => {
    const [itemCount, setItemCount] = useState<Record<AssetsUnion, number>>({
      table: 0,
      pipeline: 0,
      mlmodel: 0,
      container: 0,
      topic: 0,
      dashboard: 0,
    });
    const [activeFilter, setActiveFilter] = useState<SearchIndex>(
      SearchIndex.TABLE
    );
    const { glossaryName } = useParams<{ glossaryName: string }>();
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<SearchedDataProps['data']>([]);
    const [total, setTotal] = useState<number>(0);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [selectedCard, setSelectedCard] = useState<SourceType>();

    const fetchCountsByEntity = () => {
      Promise.all(
        [
          SearchIndex.TABLE,
          SearchIndex.TOPIC,
          SearchIndex.DASHBOARD,
          SearchIndex.PIPELINE,
          SearchIndex.MLMODEL,
          SearchIndex.CONTAINER,
        ].map((index) =>
          searchData('', 0, 0, `(tags.tagFQN:"${glossaryName}")`, '', '', index)
        )
      )
        .then(
          ([
            tableResponse,
            topicResponse,
            dashboardResponse,
            pipelineResponse,
            mlmodelResponse,
            containerResponse,
          ]) => {
            setItemCount({
              [EntityType.TOPIC]: topicResponse.data.hits.total.value,
              [EntityType.TABLE]: tableResponse.data.hits.total.value,
              [EntityType.DASHBOARD]: dashboardResponse.data.hits.total.value,
              [EntityType.PIPELINE]: pipelineResponse.data.hits.total.value,
              [EntityType.MLMODEL]: mlmodelResponse.data.hits.total.value,
              [EntityType.CONTAINER]: containerResponse.data.hits.total.value,
            });

            setActiveFilter(
              tableResponse.data.hits.total.value
                ? SearchIndex.TABLE
                : topicResponse.data.hits.total.value
                ? SearchIndex.TOPIC
                : SearchIndex.DASHBOARD
            );
          }
        )
        .catch((err) => {
          showErrorToast(err);
        })
        .finally(() => setIsLoading(false));
    };

    useEffect(() => {
      fetchCountsByEntity();
    }, []);

    const fetchAssets = useCallback(
      async ({
        index = activeFilter,
        page = 1,
      }: {
        index?: SearchIndex;
        page?: number;
      }) => {
        try {
          const res = await searchData(
            '',
            page,
            PAGE_SIZE,
            `(tags.tagFQN:"${glossaryName}")`,
            '',
            '',
            index
          );

          // Extract useful details from the Response
          const totalCount = res?.data?.hits?.total.value ?? 0;
          const hits = res?.data?.hits?.hits;

          // Find EntityType for selected searchIndex
          const entityType = AssetsFilterOptions.find(
            (f) => f.value === activeFilter
          )?.label;

          // Update states
          setTotal(totalCount);
          entityType &&
            setItemCount((prevCount) => ({
              ...prevCount,
              [entityType]: totalCount,
            }));
          setData(hits as SearchedDataProps['data']);

          // Select first card to show summary right panel
          hits[0] && setSelectedCard(hits[0]._source as SourceType);
        } catch (error) {
          console.error(error);
        }
      },
      [activeFilter, currentPage]
    );

    useEffect(() => {
      fetchAssets({ index: activeFilter, page: currentPage });
    }, [activeFilter, currentPage]);

    useImperativeHandle(ref, () => ({
      refreshAssets() {
        fetchAssets({});
        fetchCountsByEntity();
      },
      closeSummaryPanel() {
        setSelectedCard(undefined);
      },
    }));

    useEffect(() => {
      if (onAssetClick) {
        onAssetClick(selectedCard ? { details: selectedCard } : undefined);
      }
    }, [selectedCard, onAssetClick]);

    useEffect(() => {
      if (!isSummaryPanelOpen) {
        setSelectedCard(undefined);
      }
    }, [isSummaryPanelOpen]);

    if (isLoading) {
      return <Loader />;
    }

    return (
      <div data-testid="table-container">
        {AssetsFilterOptions.map((option) => {
          const buttonStyle =
            activeFilter === option.value
              ? {
                  ghost: true,
                  type: 'primary' as ButtonType,
                  style: { background: 'white' },
                }
              : {};

          return itemCount[option.label] > 0 ? (
            <Button
              {...buttonStyle}
              className="m-r-sm m-b-sm"
              key={option.value}
              onClick={() => {
                setCurrentPage(1);
                setActiveFilter(option.value);
              }}>
              {startCase(option.label)}{' '}
              <span className="p-l-xs">
                {getCountBadge(
                  itemCount[option.label],
                  '',
                  activeFilter === option.value
                )}
              </span>
            </Button>
          ) : null;
        })}
        {data.length ? (
          <>
            {data.map(({ _source, _id = '' }, index) => (
              <TableDataCardV2
                className={classNames(
                  'm-b-sm cursor-pointer',
                  selectedCard?.id === _source.id ? 'highlight-card' : ''
                )}
                handleSummaryPanelDisplay={setSelectedCard}
                id={_id}
                key={index}
                source={_source}
              />
            ))}
            {total > PAGE_SIZE && data.length > 0 && (
              <NextPrevious
                isNumberBased
                currentPage={currentPage}
                pageSize={PAGE_SIZE}
                paging={{ total }}
                pagingHandler={(page: string | number) =>
                  setCurrentPage(Number(page))
                }
                totalCount={total}
              />
            )}
          </>
        ) : (
          <div className="m-t-xlg">
            <ErrorPlaceHolder
              buttons={
                <div className="tw-text-lg tw-text-center">
                  {permissions.Create && (
                    <Button
                      ghost
                      data-testid="add-new-asset-button"
                      type="primary"
                      onClick={onAddAsset}>
                      {t('label.add-entity', {
                        entity: t('label.asset'),
                      })}
                    </Button>
                  )}
                </div>
              }
              doc={GLOSSARIES_DOCS}
              heading={t('label.asset')}
              type={ERROR_PLACEHOLDER_TYPE.ADD}
            />
          </div>
        )}
      </div>
    );
  }
);

export default AssetsTabs;
