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

import { Box, Skeleton, Typography } from '@openmetadata/ui-core-components';
import { JsonTree, Utils as QbUtils } from '@react-awesome-query-builder/ui';
import { debounce, isEmpty, isUndefined } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../../../enums/entity.enum';
import { useFqn } from '../../../../../hooks/useFqn';
import {
    getExpandedResourceList,
    getExploreURLForAdvancedFilter,
    getModifiedQueryFilterWithSelectedAssets
} from '../../../../../utils/CuratedAssetsPureUtils';
import {
    AlertMessage,
    CuratedAssetsFormSelectedAssetsInfo
} from '../../../../../utils/CuratedAssetsUtils';
import { getJsonTreeFromQueryFilter } from '../../../../../utils/QueryBuilderPureUtils';
import QueryBuilder from '../../../../common/QueryBuilder/QueryBuilder';
import { useAdvanceSearch } from '../../../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.component';
import { CuratedAssetsConfig } from '../CuratedAssetsModal/CuratedAssetsModal.interface';

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
  const { control, setValue } = useFormContext<CuratedAssetsConfig>();

  const queryFilterValue = useWatch({ control, name: 'queryFilter' });

  const [queryFilter, setQueryFilter] = useState<string>(
    queryFilterValue ?? ''
  );

  const [isCountLoading, setIsCountLoading] = useState<boolean>(false);
  const { config, treeInternal, onTreeUpdate, onReset, searchIndex } =
    useAdvanceSearch();

  const watchedResources = useWatch({ control, name: 'resources' });
  const selectedResource = useMemo(
    () => watchedResources ?? [],
    [watchedResources]
  );

  const queryURL = useMemo(() => {
    return getExploreURLForAdvancedFilter({
      queryFilter,
      selectedResource,
      config,
    });
  }, [queryFilter, config, selectedResource]);

  // The provider holds an ImmutableTree; the builder takes a plain JsonTree.
  const treeJson = useMemo(() => QbUtils.getTree(treeInternal), [treeInternal]);

  const handleChange = useCallback(
    (nextValue: string, nextTree?: JsonTree) => {
      if (nextTree) {
        onTreeUpdate(QbUtils.loadTree(nextTree), config);
      }

      // The raw query filter, without the entity type filter — that is added later by
      // getModifiedQueryFilterWithSelectedAssets.
      const queryFilter = nextValue || JSON.stringify({ query: '' });

      setValue('queryFilter', queryFilter);
      setQueryFilter(queryFilter);
    },
    [onTreeUpdate, setValue, config]
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
    [fetchEntityCount, selectedResource]
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
    setQueryFilter(queryFilterValue ?? '');
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
    <Box className="tw:mt-2" direction="col" gap={2}>
      <Box data-testid="advanced-filter-container" direction="col" gap={2}>
        <Typography
          as="span"
          className="tw:text-secondary"
          size="text-sm"
          weight="medium">
          {t('label.advance-filter')}
        </Typography>
        <QueryBuilder
          entityType={EntityType.ALL}
          fields={config.fields}
          groupMode="flat"
          key={searchIndex.toLocaleString()}
          // Counting and the Explore link are done here, scoped to the selected resources, so the builder's own
          // preview stays off.
          showCountPreview={false}
          tree={treeJson}
          onChange={handleChange}
        />
      </Box>

      {isCountLoading && <Skeleton height={32} />}

      {showFilteredResourceCount && (
        <AlertMessage
          assetCount={selectedAssetsInfo?.filteredResourceCount}
          href={queryURL}
          target="_blank"
        />
      )}
    </Box>
  );
};
