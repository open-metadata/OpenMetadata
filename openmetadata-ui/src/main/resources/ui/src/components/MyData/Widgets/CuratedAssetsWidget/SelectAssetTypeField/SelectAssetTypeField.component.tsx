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

import { Form, TreeSelect } from 'antd';
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CURATED_ASSETS_LIST } from '../../../../../constants/AdvancedSearch.constants';
import { EntityType } from '../../../../../enums/entity.enum';
import { getSourceOptionsFromResourceList } from '../../../../../utils/Alerts/AlertsUtil';
import { CuratedAssetsFormSelectedAssetsInfo } from '../../../../../utils/CuratedAssetsUtils';
import searchClassBase from '../../../../../utils/SearchClassBase';
import { useAdvanceSearch } from '../../../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.component';
import { CuratedAssetsConfig } from '../CuratedAssetsModal/CuratedAssetsModal.interface';

export const SelectAssetTypeField = ({
  fetchEntityCount,
}: {
  fetchEntityCount: (args: {
    countKey: string;
    selectedResource: string[];
    shouldUpdateResourceList: boolean;
  }) => Promise<void>;
  selectedAssetsInfo: CuratedAssetsFormSelectedAssetsInfo;
}) => {
  const { t } = useTranslation();
  const form = Form.useFormInstance<CuratedAssetsConfig>();

  const { onChangeSearchIndex } = useAdvanceSearch();

  const watchedResources = Form.useWatch<Array<string>>('resources', form);
  // Memoised so the `|| []` fallback does not hand every dependent hook a new
  // array identity on each render.
  const selectedResource: Array<string> = useMemo(
    () => watchedResources ?? [],
    [watchedResources]
  );

  const resourcesOptions = useMemo(() => {
    const allOptions = getSourceOptionsFromResourceList(
      CURATED_ASSETS_LIST,
      false,
      selectedResource,
      true
    );

    // Create tree structure with "All" as parent
    const allOption = allOptions.find(
      (option) => option.value === EntityType.ALL
    );
    const individualOptions = allOptions.filter(
      (option) => option.value !== EntityType.ALL
    );

    if (allOption) {
      return [
        {
          title: allOption.label,
          value: allOption.value,
          key: allOption.value,
          children: individualOptions.map((option) => ({
            title: option.label,
            value: option.value,
            key: option.value,
          })),
        },
      ];
    }

    return allOptions.map((option) => ({
      title: option.label,
      value: option.value,
      key: option.value,
    }));
  }, [selectedResource]);

  const handleEntityCountChange = useCallback(
    () =>
      fetchEntityCount?.({
        countKey: 'resourceCount',
        selectedResource,
        shouldUpdateResourceList: false,
      }),
    [fetchEntityCount, selectedResource]
  );

  const handleResourceChange = useCallback(
    (val: string[]) => {
      if (!form) {
        return;
      }

      form.setFieldValue('resources', val);
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
        data-testid="asset-type-select"
        label={t('label.select-asset-type')}
        messageVariables={{
          fieldName: t('label.data-asset-plural'),
        }}
        name="resources"
        style={{ marginBottom: 8 }}>
        <TreeSelect
          treeCheckable
          treeDefaultExpandAll
          autoClearSearchValue={false}
          className="w-full"
          maxTagCount="responsive"
          placeholder={t('label.select-asset-type')}
          showCheckedStrategy={TreeSelect.SHOW_PARENT}
          treeData={resourcesOptions}
          value={selectedResource}
          onChange={handleResourceChange}
        />
      </Form.Item>
    </>
  );
};
