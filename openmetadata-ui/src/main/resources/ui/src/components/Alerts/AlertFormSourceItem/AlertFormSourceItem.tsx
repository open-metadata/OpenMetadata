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
  Typography,
} from 'antd';
import type { MenuInfo } from 'rc-menu/lib/interface';
import { ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import FormCardSection from '../../../components/common/FormCardSection/FormCardSection';
import { useAlertSelectionContext } from '../../../hooks/useAlertSelection';
import { useFqn } from '../../../hooks/useFqn';
import { getSourceOptionsFromResourceList } from '../../../utils/Alerts/AlertsUtil';
import AlertSourcePicker from '../AlertSourcePicker/AlertSourcePicker';
import './alert-form-source-item.less';
import { AlertFormSourceItemProps } from './AlertFormSourceItem.interface';

function AlertFormSourceItem({
  filterResources,
}: Readonly<AlertFormSourceItemProps>) {
  const { t } = useTranslation();
  const { capabilities } = useAlertSelectionContext();
  const newRef = useRef(null);
  const form = Form.useFormInstance();
  const { fqn } = useFqn();
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

  const sourceNames = useMemo(
    () => (filterResources ?? []).map((resource) => resource.name ?? ''),
    [filterResources]
  );

  // Filters and triggers depend on the sources, so they start again. A destination is offered
  // when any source allows it, so adding a source keeps the destinations, and taking one away
  // starts them again, as changing the source always has.
  const handleSourcesChange = (values: string[], previous: string[]) => {
    const sourceTakenAway = previous.some((source) => !values.includes(source));

    form.setFieldValue('input', {});
    if (sourceTakenAway) {
      form.setFieldValue('destinations', []);
    }
    form.setFieldValue('resources', values);
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

  const sourceControl = (
    <AlertSourcePicker
      loading={capabilities.loading}
      selection={capabilities.selection}
      sources={sourceNames}
      onChange={handleSourcesChange}
    />
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
            sourceControl
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
