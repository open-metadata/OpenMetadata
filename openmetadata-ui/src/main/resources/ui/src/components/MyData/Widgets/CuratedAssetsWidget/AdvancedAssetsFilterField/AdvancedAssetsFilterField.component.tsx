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

import {
  Builder,
  Config,
  ImmutableTree,
  JsonTree,
  Query,
  Utils as QbUtils,
} from '@react-awesome-query-builder/antd';
import { Col, Form, Input, Row, Skeleton } from 'antd';
import { debounce, isEmpty, isUndefined } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CURATED_ASSETS_LIST } from '../../../../../constants/AdvancedSearch.constants';
import { EntityType } from '../../../../../enums/entity.enum';
import { useFqn } from '../../../../../hooks/useFqn';
import {
  AlertMessage,
  CuratedAssetsFormSelectedAssetsInfo,
  getExploreURLWithFilters,
  getModifiedQueryFilterWithSelectedAssets,
} from '../../../../../utils/CuratedAssetsUtils';
import { elasticSearchFormat } from '../../../../../utils/QueryBuilderElasticsearchFormatUtils';
import { getJsonTreeFromQueryFilter } from '../../../../../utils/QueryBuilderUtils';
import { useAdvanceSearch } from '../../../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.component';
import { CuratedAssetsConfig } from '../CuratedAssetsModal/CuratedAssetsModal.interface';
import './advanced-assets-filter-field.less';

export const AdvancedAssetsFilterField = ({
  fetchEntityCount,
  selectedAssetsInfo,
}: {
  fetchEntityCount: (args: {
    countKey: string;
    selectedResource: string[];
    queryFilter: string;
  }) => Promise<void>;
  selectedAssetsInfo: CuratedAssetsFormSelectedAssetsInfo;
}) => {
  const { fqn } = useFqn();
  const { t } = useTranslation();
  const isMounting = useRef(true);
  const form = Form.useFormInstance<CuratedAssetsConfig>();

  const queryFilterValue = form.getFieldValue('queryFilter');

  const [queryFilter, setQueryFilter] = useState<string>(
    queryFilterValue ?? ''
  );

  const [isCountLoading, setIsCountLoading] = useState<boolean>(false);
  const { config, treeInternal, onTreeUpdate, onReset, searchIndex } =
    useAdvanceSearch();

  const selectedResource: Array<string> =
    Form.useWatch('resources', form) || [];

  // Helper function to expand 'all' selection to all individual entity types
  const getExpandedResourceList = useCallback((resources: Array<string>) => {
    if (resources.includes(EntityType.ALL)) {
      // Return all entity types except 'all' itself
      return CURATED_ASSETS_LIST.filter((type) => type !== EntityType.ALL);
    }

    return resources;
  }, []);

  const queryURL = useMemo(() => {
    // Expand 'all' selection to individual entity types for the query URL
    const expandedResources = getExpandedResourceList(selectedResource);

    return getExploreURLWithFilters({
      queryFilter,
      selectedResource: expandedResources,
      config,
    });
  }, [queryFilter, config, selectedResource, getExpandedResourceList]);

  const handleChange = useCallback(
    (nTree: ImmutableTree, nConfig: Config) => {
      onTreeUpdate(nTree, nConfig);
      const queryFilter = {
        query: elasticSearchFormat(nTree, nConfig),
      };
      form.setFieldValue('queryFilter', JSON.stringify(queryFilter));
    },
    [onTreeUpdate, form]
  );

  const handleEntityCount = useCallback(
    async (queryFilter: string) => {
      try {
        setIsCountLoading(true);

        // Expand 'all' selection to individual entity types for the API call
        const expandedResources = getExpandedResourceList(selectedResource);

        const queryFilterObject = JSON.parse(queryFilter || '{}');

        const modifiedQueryFilter = getModifiedQueryFilterWithSelectedAssets(
          queryFilterObject,
          expandedResources
        );

        await fetchEntityCount?.({
          countKey: 'filteredResourceCount',
          selectedResource: expandedResources,
          queryFilter: JSON.stringify(modifiedQueryFilter),
        });
      } finally {
        setIsCountLoading(false);
      }
    },
    [fetchEntityCount, selectedResource, getExpandedResourceList]
  );

  const debouncedFetchEntityCount = useCallback(
    debounce(handleEntityCount, 500),
    [handleEntityCount]
  );

  const showFilteredResourceCount = useMemo(
    () =>
      !isEmpty(queryFilter) &&
      !isEmpty(selectedResource) &&
      !isUndefined(selectedAssetsInfo?.filteredResourceCount) &&
      !isCountLoading,
    [
      queryFilter,
      selectedResource,
      selectedAssetsInfo?.filteredResourceCount,
      isCountLoading,
    ]
  );

  useEffect(() => {
    setQueryFilter(queryFilterValue);
    if (!queryFilterValue) {
      onReset();
    }
  }, [queryFilterValue, onReset]);

  useEffect(() => {
    if (!isEmpty(selectedResource)) {
      debouncedFetchEntityCount(queryFilter);
    }
  }, [selectedResource, queryFilter, debouncedFetchEntityCount]);

  useEffect(() => {
    try {
      if (isMounting.current && !isEmpty(fqn) && !isEmpty(queryFilter)) {
        const tree = QbUtils.checkTree(
          QbUtils.loadTree(
            getJsonTreeFromQueryFilter(
              JSON.parse(queryFilter || '{}')
            ) as JsonTree
          ),
          config
        );
        onTreeUpdate(tree, config);
      }
    } catch (error) {
      return;
    }
  }, []);

  // always Keep this useEffect at the end...
  useEffect(() => {
    isMounting.current = false;
  }, []);

  return (
    <>
      <Form.Item hidden name="queryFilter">
        <Input />
      </Form.Item>
      <Row className="advanced-filter-form-field" gutter={[8, 8]}>
        <Col data-testid="advanced-filter-container" span={24}>
          <div className="ant-form-item-label advanced-filter-label">
            <label>{t('label.advance-filter')}</label>
          </div>
          <Query
            {...config}
            key={searchIndex.toLocaleString()}
            renderBuilder={(props) => (
              <div className="query-builder-container query-builder qb-lite">
                <Builder {...props} />
              </div>
            )}
            settings={{
              ...config.settings,
            }}
            value={treeInternal}
            onChange={handleChange}
          />
        </Col>

        {isCountLoading && (
          <Col span={24}>
            <Skeleton
              active
              loading={isCountLoading}
              paragraph={false}
              title={{ style: { height: '32px' } }}
            />
          </Col>
        )}

        {showFilteredResourceCount && (
          <Col span={24}>
            <AlertMessage
              assetCount={selectedAssetsInfo?.filteredResourceCount}
              href={queryURL}
            />
          </Col>
        )}
      </Row>
    </>
  );
};
