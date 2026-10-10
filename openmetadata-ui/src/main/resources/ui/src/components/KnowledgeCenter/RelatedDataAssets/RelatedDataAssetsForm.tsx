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
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import {
  BadgeWithButton,
  Box,
  Grid,
  Typography,
} from '@openmetadata/ui-core-components';
import { Button } from 'antd';
import { FC, useState } from 'react';
import { Pressable } from 'react-aria-components';
import { DataAssetOption } from '../../../components/DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList.interface';
import DataAssetSelectList from '../../../components/DataAssets/DataAssetSelectList/DataAssetSelectList';
import { getLayoutGutter } from '../../../utils/common/layout.utils';
import i18n from '../../../utils/i18next/LocalUtil';

interface RelatedDataAssetsFormProps {
  initialOptions?: DataAssetOption[];
  onSubmit: (option: DataAssetOption[]) => Promise<void>;
  onCancel: () => void;
}

const knowledgeCenterQueryFilter = {
  query: {
    bool: {
      must_not: [
        { term: { entityType: 'dataProduct' } },
        { term: { entityType: 'domain' } },
        // Columns are not first-class entities (no repository), so they cannot be related
        // entities — resolving one 404s the list. Keep them out of the picker.
        { term: { entityType: 'tableColumn' } },
        { match: { isBot: true } },
      ],
    },
  },
};

export const RelatedDataAssetsForm: FC<RelatedDataAssetsFormProps> = ({
  initialOptions,
  onCancel,
  onSubmit,
}) => {
  const { t } = i18n;
  const [selected, setSelected] = useState<DataAssetOption[]>(
    initialOptions ?? []
  );
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);

  const placeholder = t('label.data-asset-plural');

  const handleChange = (option?: DataAssetOption | DataAssetOption[]) => {
    if (!option) {
      setSelected([]);

      return;
    }
    setSelected(Array.isArray(option) ? option : [option]);
  };

  const handleRemoveChip = (id: string) => {
    const next = selected.filter((s) => s.reference.id !== id);
    handleChange(next.length ? next : undefined);
  };

  const handleSubmit = () => {
    setIsSubmitLoading(true);
    onSubmit(selected);
  };

  const chipItems = selected.map((s) => ({
    id: s.reference.id,
    label: s.displayName ?? s.label ?? '',
  }));

  return (
    <div data-testid="dataAssetsForm">
      <Grid
        className="layout-row layout-grid"
        style={{ ...getLayoutGutter(0, 8) }}>
        <Grid.Item
          className="layout-column gutter-row d-flex justify-end"
          span={24}>
          <Box
            inline
            align="center"
            className="layout-space layout-space-horizontal"
            gap={2}
            itemClassName="layout-space-item">
            <Button
              className="p-x-05"
              data-testid="cancelDataAssets"
              disabled={isSubmitLoading}
              icon={<CloseOutlined size={12} />}
              size="small"
              onClick={onCancel}
            />
            <Button
              className="p-x-05"
              data-testid="saveDataAssets"
              icon={<CheckOutlined size={12} />}
              loading={isSubmitLoading}
              size="small"
              type="primary"
              onClick={handleSubmit}
            />
          </Box>
        </Grid.Item>

        <Grid.Item className="layout-column gutter-row" span={24}>
          <DataAssetSelectList
            initialOptions={initialOptions}
            placeholder={placeholder}
            popoverPlacement="top end"
            queryFilter={knowledgeCenterQueryFilter}
            renderTrigger={({ open }) => (
              <Pressable onClick={open}>
                <Box
                  align="center"
                  className="tw:relative tw:w-full tw:min-h-10 tw:rounded-lg tw:bg-primary tw:shadow-xs tw:px-3 tw:py-2 tw:outline-1 tw:-outline-offset-1 tw:outline-primary"
                  gap={2}
                  wrap="wrap">
                  {chipItems.length > 0 ? (
                    chipItems.map((item) => (
                      <BadgeWithButton
                        buttonLabel={t('label.remove-entity', {
                          entity: item.label,
                        })}
                        color="gray"
                        key={item.id}
                        size="sm"
                        type="modern"
                        onButtonClick={(e) => {
                          e.stopPropagation();
                          handleRemoveChip(item.id);
                        }}>
                        <div className="tw:max-w-28">
                          <Typography
                            className="tw:whitespace-nowrap"
                            ellipsis={{
                              tooltip: item.label,
                              excludeTriggerFromTabOrder: true,
                            }}
                            size="text-xs">
                            {item.label}
                          </Typography>
                        </div>
                      </BadgeWithButton>
                    ))
                  ) : (
                    <Typography className="tw:text-tertiary">
                      {t('label.data-asset-plural')}
                    </Typography>
                  )}
                </Box>
              </Pressable>
            )}
            selectionMode="multiple"
            value={selected}
            onChange={handleChange}
          />
        </Grid.Item>
      </Grid>
    </div>
  );
};
