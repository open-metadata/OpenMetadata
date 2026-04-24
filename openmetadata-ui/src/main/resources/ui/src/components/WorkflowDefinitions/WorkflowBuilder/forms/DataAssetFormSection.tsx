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

import { Autocomplete, SelectItemType } from '@openmetadata/ui-core-components';
import { upperFirst } from 'lodash';
import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useListData } from 'react-stately';
import { ALL_DATA_ASSETS_OPTION_VALUE } from '../../../../constants/WorkflowBuilder.constants';
import { useWorkflowModeContext } from '../../../../contexts/WorkflowModeContext';
import { DataAssetFormSectionProps } from '../../../../interface/workflow-builder-components.interface';

export const DataAssetFormSection: React.FC<DataAssetFormSectionProps> = ({
  availableDataAssets,
  dataAssets,
  lockFields = false,
  onDataAssetsChange,
  onRemoveDataAsset,
}) => {
  const { t } = useTranslation();
  const { isFormDisabled } = useWorkflowModeContext();
  const inputsDisabled = isFormDisabled || lockFields;

  const dataAssetOptionsIncludingAll = useMemo(
    () => [ALL_DATA_ASSETS_OPTION_VALUE, ...availableDataAssets],
    [availableDataAssets]
  );

  const dataAssetSelectDisplayValue = useMemo(() => {
    const hasAllDataAssetsSelected =
      availableDataAssets.length > 0 &&
      dataAssets.length === availableDataAssets.length &&
      availableDataAssets.every((asset) => dataAssets.includes(asset));

    return hasAllDataAssetsSelected
      ? [ALL_DATA_ASSETS_OPTION_VALUE]
      : dataAssets;
  }, [dataAssets, availableDataAssets]);

  const resolveLabel = (option: string) =>
    option === ALL_DATA_ASSETS_OPTION_VALUE
      ? t('label.all')
      : upperFirst(option);

  const isAllDataAssetsSelected = dataAssetSelectDisplayValue.includes(
    ALL_DATA_ASSETS_OPTION_VALUE
  );

  const toItem = (v: string): SelectItemType => ({
    id: v,
    isDisabled: false,
    label: resolveLabel(v),
  });

  const selectedItems = useListData<SelectItemType>({ initialItems: [] });
  const prevDisplayRef = useRef<string[]>([]);

  useEffect(() => {
    const prev = prevDisplayRef.current;
    const next = dataAssetSelectDisplayValue;
    if (prev.length !== next.length || next.some((v, i) => v !== prev[i])) {
      // Replace entire list: clear current items then set to next (avoids duplicates when parent state catches up)
      const currentIds = selectedItems.items.map((item) => item.id);
      currentIds.forEach((id) => selectedItems.remove(id));
      next.forEach((v) => selectedItems.append(toItem(v)));
      prevDisplayRef.current = next;
    }
  }, [dataAssetSelectDisplayValue]);

  const allItems: SelectItemType[] = dataAssetOptionsIncludingAll.map((v) => ({
    id: v,
    isDisabled: isAllDataAssetsSelected && v !== ALL_DATA_ASSETS_OPTION_VALUE,
    label: resolveLabel(v),
  }));

  const handleItemInserted = (key: React.Key) => {
    const id = String(key);
    selectedItems.append(toItem(id));
    if (id === ALL_DATA_ASSETS_OPTION_VALUE) {
      onDataAssetsChange([...availableDataAssets]);
    } else {
      onDataAssetsChange(
        [...selectedItems.items.map((i) => i.id), id].filter(
          (v) => v !== ALL_DATA_ASSETS_OPTION_VALUE
        )
      );
    }
  };

  const handleItemCleared = (key: React.Key) => {
    const id = String(key);
    selectedItems.remove(key);
    if (id === ALL_DATA_ASSETS_OPTION_VALUE) {
      onDataAssetsChange([]);
    } else {
      onRemoveDataAsset(id);
    }
  };

  return (
    <div className="tw:mb-6" data-testid="data-asset-form-section">
      <Autocomplete
        isRequired
        data-testid="data-asset"
        isDisabled={inputsDisabled}
        items={allItems}
        label={t('label.data-asset')}
        maxVisibleItems={4}
        placeholder={t('message.select-data-assets')}
        selectedItems={selectedItems}
        onItemCleared={handleItemCleared}
        onItemInserted={handleItemInserted}>
        {(item) => (
          <Autocomplete.Item
            id={item.id}
            isDisabled={item.isDisabled}
            key={item.id}
            label={item.label}
          />
        )}
      </Autocomplete>
    </div>
  );
};
