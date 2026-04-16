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

import { Button, Card, Typography } from '@openmetadata/ui-core-components';
import { ChevronDown, Plus, XClose } from '@untitledui/icons';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWorkflowModeContext } from '../../../../contexts/WorkflowModeContext';
import { EntityType } from '../../../../enums/entity.enum';
import { DataAssetFiltersSectionProps } from '../../../../interface/workflow-builder-components.interface';
import { SearchOutputType } from '../../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';
import { FormField } from '../common/FormField';
import { QueryBuilderSection } from './QueryBuilderSection';

export const DataAssetFiltersSection: React.FC<
  DataAssetFiltersSectionProps
> = ({
  dataAssetFilters,
  dataAssets,
  lockFields = false,
  onAddDataAssetFilter,
  onUpdateDataAssetFilter,
  onRemoveDataAssetFilter,
}) => {
  const { t } = useTranslation();
  const { isFormDisabled } = useWorkflowModeContext();

  const [open, setOpen] = useState(false);
  const handleDropdownClick = () => {
    setOpen((prev) => !prev);
  };

  const handleDropdownClose = () => {
    setOpen(false);
  };

  const handleDataAssetSelect = (dataAsset: string) => {
    onAddDataAssetFilter(dataAsset);
    handleDropdownClose();
  };

  if (!dataAssets || dataAssets.length === 0) {
    return null;
  }

  const selectedDataAssets = dataAssetFilters.map((df) => df.dataAsset);
  const hasAvailableAssets = dataAssets.some(
    (asset) => !selectedDataAssets.includes(asset)
  );
  const isDisabled =
    isFormDisabled ||
    lockFields ||
    (!hasAvailableAssets && dataAssetFilters.length > 0);

  return (
    <div className="tw:mb-6">
      <FormField
        description={t('message.choose-which-assets-this-workflow-can-act-on')}
        label={t('label.data-asset-filter')}
        showInfoIcon={false}>
        <>
          {dataAssetFilters.map((dataAssetFilter) => (
            <div className="tw:mt-6 first:tw:mt-0" key={dataAssetFilter.id}>
              <Card className="tw:p-4">
                <div className="tw:flex tw:items-center tw:gap-1.5 tw:mb-3">
                  <Typography
                    ellipsis
                    as="span"
                    className="tw:text-secondary"
                    size="text-xs"
                    weight="semibold">
                    {dataAssetFilter.dataAsset.charAt(0).toUpperCase() +
                      dataAssetFilter.dataAsset.slice(1)}
                  </Typography>
                  <Button
                    color="tertiary"
                    iconLeading={XClose}
                    isDisabled={isDisabled}
                    size="sm"
                    onPress={() => onRemoveDataAssetFilter(dataAssetFilter.id)}
                  />
                </div>

                {dataAssetFilter.dataAsset && (
                  <div className="tw:mt-4">
                    <QueryBuilderSection
                      entityTypes={
                        dataAssetFilter.dataAsset.toLowerCase() as EntityType
                      }
                      forceReadOnly={lockFields}
                      label={`Filter for ${dataAssetFilter.dataAsset}`}
                      outputType={SearchOutputType.ElasticSearch}
                      value={dataAssetFilter.filters || ''}
                      onChange={(value: string) => {
                        onUpdateDataAssetFilter(
                          dataAssetFilter.id || 0,
                          value || ''
                        );
                      }}
                    />
                  </div>
                )}
              </Card>
            </div>
          ))}

          <div className="tw:relative tw:mt-6">
            <Button
              className="tw:w-full"
              color="secondary"
              data-testid="add-data-asset-filter-button"
              iconLeading={Plus}
              iconTrailing={ChevronDown}
              isDisabled={isDisabled}
              size="sm"
              onPress={isDisabled ? undefined : handleDropdownClick}>
              {t('label.add-asset-filter')}
            </Button>
            {open && (
              <Card className="tw:absolute tw:left-0 tw:right-0 tw:top-full tw:mt-1 tw:z-50 tw:max-h-55 tw:overflow-y-auto">
                <div className="tw:flex tw:flex-col">
                  {dataAssets.map((dataAsset) => {
                    const isAlreadySelected =
                      selectedDataAssets.includes(dataAsset);

                    return (
                      <Button
                        className="tw:w-full tw:justify-start"
                        color="tertiary"
                        data-testid={`data-asset-option-${dataAsset}`}
                        isDisabled={isAlreadySelected}
                        key={dataAsset}
                        size="sm"
                        onPress={() => {
                          if (!isAlreadySelected) {
                            handleDataAssetSelect(dataAsset);
                          }
                        }}>
                        {dataAsset}
                      </Button>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>
        </>
      </FormField>
    </div>
  );
};
