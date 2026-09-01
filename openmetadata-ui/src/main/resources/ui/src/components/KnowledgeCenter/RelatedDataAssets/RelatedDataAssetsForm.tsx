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
import { BadgeWithButton, Box, Typography } from '@openmetadata/ui-core-components';
import { Button, Col, Row, Space } from 'antd';
import { FC, useState } from 'react';
import { DataAssetOption } from '../../../components/DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList.interface';
import DataAssetSelectList from '../../../components/DataAssets/DataAssetSelectList/DataAssetSelectList';
import i18n from '../../../utils/i18next/LocalUtil';

interface RelatedDataAssetsFormProps {
  defaultValue?: string[];
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
    const next = selected.filter((s) => String(s.value ?? '') !== id);
    handleChange(next.length ? next : undefined);
  };

  const handleSubmit = () => {
    setIsSubmitLoading(true);
    onSubmit(selected);
  };

  const chipItems = selected.map((s) => ({
    id: String(s.value ?? ''),
    label: s.displayName ?? String(s.label ?? ''),
  }));

  return (
    <div data-testid="dataAssetsForm">
      <Row gutter={[0, 8]}>
        <Col className="gutter-row d-flex justify-end" span={24}>
          <Space align="center">
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
          </Space>
        </Col>

        <Col className="gutter-row" span={24}>
          <DataAssetSelectList
            initialOptions={initialOptions}
            placeholder={placeholder}
            popoverPlacement="top end"
            queryFilter={knowledgeCenterQueryFilter}
            renderTrigger={({ open }) => (
              <Box
              align="center"
              className="tw:relative tw:w-full tw:rounded-lg tw:bg-primary tw:px-3 tw:py-1.5 tw:shadow-xs tw:outline-1 tw:-outline-offset-1 tw:outline-primary"
              gap={2}
                wrap="wrap"
                onClick={open}>
                {chipItems.length > 0 ? chipItems.map((item) => (
                    <BadgeWithButton
                      buttonLabel={t('label.remove')}
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
                            ellipsis={{ tooltip : item.label }}
                            size="text-xs">
                            {item.label}
                          </Typography>
                        </div>
                    </BadgeWithButton>
                )): <Typography className="tw:text-tertiary">
                  {t('label.data-asset-plural')}
                </Typography>}
              </Box>
            )}
            selectionMode="multiple"
            value={selected}
            onChange={handleChange}
          />
        </Col>
      </Row>
    </div>
  );
};
