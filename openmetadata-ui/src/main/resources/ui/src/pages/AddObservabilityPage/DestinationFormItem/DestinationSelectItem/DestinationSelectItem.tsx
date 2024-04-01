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

import { CloseOutlined } from '@ant-design/icons';
import { Alert, Button, Col, Form, Row, Select, Tabs, Typography } from 'antd';
import { isEmpty, isUndefined, map } from 'lodash';
import React, {
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  DESTINATION_DROPDOWN_TABS,
  DESTINATION_SOURCE_ITEMS,
} from '../../../../constants/Alerts.constants';
import { WHITE_COLOR } from '../../../../constants/constants';
import { CreateEventSubscription } from '../../../../generated/events/api/createEventSubscription';
import { SubscriptionCategory } from '../../../../generated/events/eventSubscription';
import { useFqn } from '../../../../hooks/useFqn';
import {
  getDestinationConfigField,
  getFilteredDestinationOptions,
  getSubscriptionTypeOptions,
} from '../../../../utils/Alerts/AlertsUtil';
import { checkIfDestinationIsInternal } from '../../../../utils/ObservabilityUtils';
import { ModifiedDestination } from '../../AddObservabilityPage.interface';
import { DestinationSelectItemProps } from './DestinationSelectItem.interface';

function DestinationSelectItem({
  selectorKey,
  id,
  remove,
}: Readonly<DestinationSelectItemProps>) {
  const { t } = useTranslation();
  const form = Form.useFormInstance();
  const { fqn } = useFqn();
  const [activeTab, setActiveTab] = useState(
    DESTINATION_DROPDOWN_TABS.internal
  );
  const [destinationOptions, setDestinationOptions] = useState(
    DESTINATION_SOURCE_ITEMS.internal
  );

  // Selected destinations list
  const selectedDestinations = Form.useWatch<ModifiedDestination[]>(
    'destinations',
    form
  );

  // Selected source for the alert
  const [selectedSource] =
    Form.useWatch<CreateEventSubscription['resources']>(['resources'], form) ??
    [];

  const handleTabChange = useCallback(
    (key) => {
      setActiveTab(key);
      setDestinationOptions(getFilteredDestinationOptions(key, selectedSource));
    },
    [selectedSource]
  );

  const destinationType = form.getFieldValue([
    'destinations',
    id,
    'destinationType',
  ]);
  const subscriptionType = form.getFieldValue(['destinations', id, 'type']);

  // Check if selected destination type is internal destination
  const isInternalDestinationSelected = useMemo(
    () => checkIfDestinationIsInternal(destinationType),
    [destinationType]
  );

  const getTabItems = useCallback(
    (children: ReactElement) =>
      map(DESTINATION_DROPDOWN_TABS, (tabName) => ({
        key: tabName,
        label: (
          <span data-testid={`tab-label-${tabName}`}>
            {t(`label.${tabName}`)}
          </span>
        ),
        children,
      })),
    []
  );

  const customDestinationDropdown = useCallback(
    (menu: ReactElement, name: number) => {
      return (
        <Tabs
          centered
          activeKey={activeTab}
          className="destination-select-dropdown"
          data-testid={`destination-category-dropdown-${name}`}
          defaultActiveKey={DESTINATION_DROPDOWN_TABS.internal}
          items={getTabItems(menu)}
          key={`destination-tabs-${name}`}
          tabBarStyle={{
            background: WHITE_COLOR,
          }}
          onTabClick={handleTabChange}
        />
      );
    },
    [handleTabChange, getTabItems, activeTab]
  );

  const getHiddenDestinationFields = (
    isInternalDestination: boolean,
    item: number,
    destinationType: string
  ) => (
    <>
      <Form.Item
        hidden
        initialValue={
          isInternalDestination
            ? destinationType
            : SubscriptionCategory.External
        }
        key={`${destinationType}-category`}
        name={[item, 'category']}
      />
      {!isInternalDestination && (
        <Form.Item
          hidden
          initialValue={destinationType}
          key={`${destinationType}-type`}
          name={[item, 'type']}
        />
      )}
    </>
  );

  const isEditMode = useMemo(() => !isEmpty(fqn), [fqn]);

  useEffect(() => {
    // Get the current destinations list
    const [selectedSource] = form.getFieldValue('resources');
    const destinationsValue = form.getFieldValue('destinations');

    // Logic to set the initial values for the active tab and the destination options
    // after the component is mounted, based on the set destination values
    if (!isEmpty(destinationsValue)) {
      // Set the active tab and selection options as external when in edit mode
      // and the destination category is 'External'
      if (
        destinationsValue[id].category === SubscriptionCategory.External &&
        isEditMode &&
        // Since the default value of category for new added destination form item is 'External'
        // Adding the below condition to exclude the case and set default tab as 'Internal'
        !isUndefined(destinationsValue[id].destinationType)
      ) {
        setActiveTab(DESTINATION_DROPDOWN_TABS.external);
        setDestinationOptions(
          getFilteredDestinationOptions(
            DESTINATION_DROPDOWN_TABS.external,
            selectedSource
          )
        );
      } else {
        setActiveTab(DESTINATION_DROPDOWN_TABS.internal);
        setDestinationOptions(
          getFilteredDestinationOptions(
            DESTINATION_DROPDOWN_TABS.internal,
            selectedSource
          )
        );
      }
    }
  }, []);

  return (
    <Col data-testid={`destination-${id}`} key={selectorKey} span={24}>
      <div className="flex gap-4">
        <div className="flex-1 w-min-0">
          <Row gutter={[8, 8]}>
            <Col span={12}>
              <Form.Item
                required
                name={[id, 'destinationType']}
                rules={[
                  {
                    required: true,
                    message: t('message.field-text-is-required', {
                      fieldText: t('label.destination'),
                    }),
                  },
                ]}>
                <Select
                  className="w-full"
                  data-testid={`destination-category-select-${id}`}
                  dropdownRender={(menu) =>
                    customDestinationDropdown(menu, selectorKey)
                  }
                  options={destinationOptions}
                  placeholder={t('label.select-field', {
                    field: t('label.destination'),
                  })}
                  onSelect={(value) => {
                    form.setFieldValue(['destinations', id], {
                      destinationType: value,
                    });
                  }}
                />
              </Form.Item>
            </Col>
            {getHiddenDestinationFields(
              isInternalDestinationSelected,
              id,
              destinationType
            )}
            {selectedDestinations &&
              !isEmpty(selectedDestinations[id]) &&
              selectedDestinations[id] &&
              getDestinationConfigField(
                selectedDestinations[id]?.destinationType,
                id
              )}
            {destinationType && checkIfDestinationIsInternal(destinationType) && (
              <Col span={24}>
                <Form.Item
                  required
                  extra={
                    destinationType &&
                    subscriptionType && (
                      <Alert
                        closable
                        className="m-t-sm"
                        message={
                          <Typography.Text className="font-medium text-sm">
                            {t('message.destination-selection-warning', {
                              subscriptionCategory: destinationType,
                              subscriptionType,
                            })}
                          </Typography.Text>
                        }
                        type="warning"
                      />
                    )
                  }
                  name={[id, 'type']}
                  rules={[
                    {
                      required: true,
                      message: t('message.field-text-is-required', {
                        fieldText: t('label.field'),
                      }),
                    },
                  ]}>
                  <Select
                    className="w-full"
                    data-testid={`destination-type-select-${id}`}
                    options={getSubscriptionTypeOptions(destinationType)}
                    placeholder={t('label.select-field', {
                      field: t('label.destination'),
                    })}
                    popupClassName="select-options-container"
                  />
                </Form.Item>
              </Col>
            )}
          </Row>
        </div>

        <Button
          data-testid={`remove-destination-${id}`}
          icon={<CloseOutlined />}
          onClick={() => remove(id)}
        />
      </div>
    </Col>
  );
}

export default DestinationSelectItem;
