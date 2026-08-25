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

import {
  Button,
  Card,
  Dropdown,
  Form,
  MenuItemProps,
  MenuProps,
  Select,
  Typography,
} from 'antd';
import type { MenuInfo } from 'rc-menu/lib/interface';
import { ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import FormCardSection from '../../../components/common/FormCardSection/FormCardSection';
import { useFqn } from '../../../hooks/useFqn';
import { getSourceOptionsFromResourceList } from '../../../utils/Alerts/AlertsUtil';
import './alert-form-source-item.less';
import { AlertFormSourceItemProps } from './AlertFormSourceItem.interface';

function AlertFormSourceItem({
  filterResources,
}: Readonly<AlertFormSourceItemProps>) {
  const { t } = useTranslation();
  const newRef = useRef(null);
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

  const dropdownCardComponent = useCallback((menuNode: ReactNode) => {
    return (
      <Card
        bodyStyle={{ padding: 0 }}
        className="source-dropdown-card"
        data-testid="drop-down-menu">
        <Typography.Text className="p-l-md text-grey-muted">
          {t('label.data-asset-plural')}
        </Typography.Text>
        <div className="p-t-xss">{menuNode}</div>
      </Card>
    );
  }, []);

  const dropdownMenuItems: MenuProps['items'] = useMemo(
    () =>
      resourcesOptions.map((option) => ({
        label: option.label,
        key: option.value,
      })),
    [resourcesOptions]
  );

  const handleMenuItemClick: MenuItemProps['onClick'] = useCallback(
    (info: MenuInfo) => {
      form.setFieldValue(['resources'], [info.key]);
      setIsEditMode(true);
    },
    []
  );

  return (
    <FormCardSection
      heading={t('label.source')}
      subHeading={t('message.alerts-source-description')}>
      <div className="source-input-container" ref={newRef}>
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
            <Dropdown
              destroyPopupOnHide
              dropdownRender={dropdownCardComponent}
              getPopupContainer={() => newRef.current ?? document.body}
              menu={{
                items: dropdownMenuItems,
                onClick: handleMenuItemClick,
              }}
              placement="bottomRight"
              trigger={['click']}>
              <Button data-testid="add-source-button" type="primary">
                {t('label.add-entity', {
                  entity: t('label.source'),
                })}
              </Button>
            </Dropdown>
          )}
        </Form.Item>
      </div>
    </FormCardSection>
  );
}

export default AlertFormSourceItem;
