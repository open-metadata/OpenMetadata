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

import { Col, Form, Select, Skeleton } from 'antd';
import { DefaultOptionType } from 'antd/lib/select';
import { isEmpty, isUndefined } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CURATED_ASSETS_LIST } from '../../../../../constants/AdvancedSearch.constants';
import { getSourceOptionsFromResourceList } from '../../../../../utils/Alerts/AlertsUtil';
import {
  AlertMessage,
  APP_CONFIG_PATH,
  getExploreURLWithFilters,
} from '../../../../../utils/CuratedAssetsUtils';
import searchClassBase from '../../../../../utils/SearchClassBase';
import { useAdvanceSearch } from '../../../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.component';

export const SelectAssetTypeField = ({
  fetchEntityCount,
  selectedAssetsInfo,
}: {
  fetchEntityCount: any;
  selectedAssetsInfo: any;
}) => {
  const { t } = useTranslation();
  const form = Form.useFormInstance<any>();

  const { config, onChangeSearchIndex } = useAdvanceSearch();
  const [isCountLoading, setIsCountLoading] = useState<boolean>(false);

  const selectedResource: Array<string> =
    Form.useWatch<Array<string>>(
      [...APP_CONFIG_PATH, 'resources', 'type'],
      form
    ) || [];

  const resourcesOptions: DefaultOptionType[] = useMemo(() => {
    return getSourceOptionsFromResourceList(
      CURATED_ASSETS_LIST,
      false,
      selectedResource,
      false
    );
  }, [selectedResource]);

  const handleEntityCountChange = useCallback(async () => {
    try {
      setIsCountLoading(true);

      await fetchEntityCount?.({
        countKey: 'resourceCount',
        selectedResource,
        shouldUpdateResourceList: false,
      });
    } finally {
      setIsCountLoading(false);
    }
  }, [fetchEntityCount, selectedResource]);

  const queryURL = useMemo(
    () =>
      getExploreURLWithFilters({
        queryFilter: '{}',
        selectedResource,
        config,
      }),
    [config, selectedResource]
  );

  const showFilteredResourceCount = useMemo(
    () =>
      !isEmpty(selectedResource) &&
      !isUndefined(selectedAssetsInfo?.resourceCount) &&
      !isCountLoading,
    [selectedAssetsInfo?.resourceCount, isCountLoading, selectedResource]
  );

  const handleResourceChange = useCallback(
    (val: string | string[]) => {
      if (form) {
        form.setFieldValue([...APP_CONFIG_PATH, 'resources', 'type'], [val]);
      }
    },
    [form]
  );

  useEffect(() => {
    const searchIndexMapping =
      searchClassBase.getEntityTypeSearchIndexMapping();

    onChangeSearchIndex(
      selectedResource.map((resource) => searchIndexMapping[resource])
    );

    if (!isEmpty(selectedResource)) {
      handleEntityCountChange();
    }
  }, [selectedResource, handleEntityCountChange, onChangeSearchIndex]);

  return (
    <>
      <Form.Item
        label={t('label.select-asset-type')}
        messageVariables={{
          fieldName: t('label.data-asset-plural'),
        }}
        name={[...APP_CONFIG_PATH, 'resources', 'type']}
        style={{ marginBottom: 8 }}>
        <Select
          options={resourcesOptions}
          placeholder={t('label.select-asset-type')}
          value={selectedResource}
          onChange={handleResourceChange}
        />
      </Form.Item>
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
        <Col span={24} style={{ marginBottom: 12 }}>
          <AlertMessage
            assetCount={selectedAssetsInfo?.resourceCount}
            href={queryURL}
          />
        </Col>
      )}
    </>
  );
};
