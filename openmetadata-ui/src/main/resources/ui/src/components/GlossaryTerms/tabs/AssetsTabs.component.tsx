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

import { Button, Radio } from 'antd';
import { AssetsUnion } from 'components/Assets/AssetsSelectionModal/AssetSelectionModal.interface';
import TableDataCardV2 from 'components/common/table-data-card-v2/TableDataCardV2';
import { EntityDetailsObjectInterface } from 'components/Explore/explore.interface';
import Loader from 'components/Loader/Loader';
import { OperationPermission } from 'components/PermissionProvider/PermissionProvider.interface';
import { SearchedDataProps } from 'components/searched-data/SearchedData.interface';
import { AssetsFilterOptions } from 'constants/Assets.constants';
import { PAGE_SIZE } from 'constants/constants';
import { GLOSSARIES_DOCS } from 'constants/docs.constants';
import { ERROR_PLACEHOLDER_TYPE } from 'enums/common.enum';
import { EntityType } from 'enums/entity.enum';
import { SearchIndex } from 'enums/search.enum';
import { t } from 'i18next';
import { startCase } from 'lodash';
import { AssetsDataType } from 'Models';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { searchData } from 'rest/miscAPI';
import { showErrorToast } from 'utils/ToastUtils';
import { getCountBadge } from '../../../utils/CommonUtils';
import ErrorPlaceHolder from '../../common/error-with-placeholder/ErrorPlaceHolder';

interface Props {
  assetData: AssetsDataType;
  currentPage: number;
  onAssetPaginate: (num: string | number, activePage?: number) => void;
  permissions: OperationPermission;
  onAssetClick?: (asset: EntityDetailsObjectInterface) => void;
}

const AssetsTabs = ({ permissions, onAssetClick }: Props) => {
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

  const fetchAssets = async (index: SearchIndex) => {
    try {
      const res = await searchData(
        '',
        1,
        PAGE_SIZE,
        `(tags.tagFQN:"${glossaryName}")`,
        '',
        '',
        index
      );

      const hits = res?.data?.hits?.hits;

      setData(hits as SearchedDataProps['data']);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchAssets(activeFilter);
  }, [activeFilter]);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <div data-testid="table-container">
      <Radio.Group
        className="m-b-sm"
        value={activeFilter}
        onChange={(e) => setActiveFilter(e.target.value)}>
        {AssetsFilterOptions.map((option) => {
          return itemCount[option.label] > 0 ? (
            <Radio.Button key={option.value} value={option.value}>
              {startCase(option.label)} {getCountBadge(itemCount[option.label])}
            </Radio.Button>
          ) : null;
        })}
      </Radio.Group>
      {data.length ? (
        <>
          {data.map(({ _source, _index, _id = '' }, index) => (
            <TableDataCardV2
              className="m-b-sm cursor-pointer"
              handleSummaryPanelDisplay={(source) =>
                onAssetClick &&
                onAssetClick({
                  details: source,
                })
              }
              id={_id}
              key={index}
              searchIndex={_index as SearchIndex}
              source={_source}
            />
          ))}
          {/* {data.total > PAGE_SIZE && assetData.data.length > 0 && (
            <NextPrevious
              isNumberBased
              currentPage={currentPage}
              pageSize={PAGE_SIZE}
              paging={{} as Paging}
              pagingHandler={onAssetPaginate}
              totalCount={assetData.total}
            />
          )} */}
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
                    type="primary">
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
};

export default AssetsTabs;
