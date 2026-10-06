/*
 *  Copyright 2024 Collate.
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

import { Button, Dropdown, Typography } from '@openmetadata/ui-core-components';
import { Form, Select } from 'antd';
import { Key, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import FormCardSection from '../../../components/common/FormCardSection/FormCardSection';
import { useFqn } from '../../../hooks/useFqn';
import { getSourceOptionsFromResourceList } from '../../../utils/Alerts/AlertsUtil';
import { AlertFormSourceItemProps } from './AlertFormSourceItem.interface';

function AlertFormSourceItem({
  filterResources,
}: Readonly<AlertFormSourceItemProps>) {
  const { t } = useTranslation();
  const form = Form.useFormInstance();
  const { fqn } = useFqn();
  const [selectedResource, setSelectedResource] = useState<string[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);

  const resourcesOptions = useMemo(
    () =>
      getSourceOptionsFromResourceList(
        (filterResources ?? []).map((r) => r.name ?? ''),
        false,
        undefined,
        true
      ),
    [filterResources]
  );

  const handleSourceChange = (value: string) => {
    // Reset the filters, triggers and destination on change of source,
    // since the options for above are source specific.
    form.setFieldValue('input', {});
    form.setFieldValue('destinations', []);
    setSelectedResource([value]);
    form.setFieldValue('resources', [value]);
  };

  const handleMenuItemClick = useCallback((key: Key) => {
    form.setFieldValue(['resources'], [key]);
    setIsEditMode(true);
  }, []);

  return (
    <FormCardSection
      heading={t('label.source')}
      subHeading={t('message.alerts-source-description')}>
      <div className="source-input-container">
        <Form.Item
          required
          initialValue={
            fqn
              ? form.getFieldValue(['filteringRules', 'resources'])
              : undefined
          }
          messageVariables={{
            fieldName: t('label.data-asset-plural'),
          }}
          name={['resources']}
          rules={[
            {
              required: true,
              message: t('label.please-select-entity', {
                entity: t('label.data-asset'),
              }),
            },
          ]}>
          {isEditMode || fqn ? (
            <Select
              className="w-full"
              data-testid="source-select"
              options={resourcesOptions}
              placeholder={t('label.select-field', {
                field: t('label.data-asset-plural'),
              })}
              value={selectedResource[0]}
              onChange={handleSourceChange}
            />
          ) : (
            <Dropdown.Root>
              <Button data-testid="add-source-button" size="sm">
                {t('label.add-entity', {
                  entity: t('label.source'),
                })}
              </Button>
              <Dropdown.Popover
                className="tw:w-auto tw:min-w-50"
                placement="bottom start"
                shouldFlip={false}>
                <div className="tw:pt-2" data-testid="drop-down-menu">
                  <Typography className="tw:px-4" color="secondary">
                    {t('label.data-asset-plural')}
                  </Typography>
                  <Dropdown.Menu
                    aria-label={t('label.data-asset-plural')}
                    className="tw:max-h-75 tw:overflow-y-auto"
                    selectionMode="none"
                    onAction={handleMenuItemClick}>
                    {resourcesOptions.map((option) => (
                      <Dropdown.Item
                        id={option.value}
                        key={option.value}
                        textValue={option.value}>
                        {option.label}
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Menu>
                </div>
              </Dropdown.Popover>
            </Dropdown.Root>
          )}
        </Form.Item>
      </div>
    </FormCardSection>
  );
}

export default AlertFormSourceItem;
