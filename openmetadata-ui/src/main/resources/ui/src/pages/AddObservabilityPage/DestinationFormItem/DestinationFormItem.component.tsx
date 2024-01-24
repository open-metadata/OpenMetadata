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
import { Button, Card, Col, Form, Row, Select, Tabs, Typography } from 'antd';
import Input from 'antd/lib/input/Input';
import { SelectProps } from 'antd/lib/select';
import { isEmpty, isNil } from 'lodash';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch } from 'react-router-dom';
import { AsyncSelect } from '../../../components/AsyncSelect/AsyncSelect';
import {
  DESTINATION_SOURCE_ITEMS,
  EXTERNAL_CATEGORY_OPTIONS,
} from '../../../constants/Alerts.constants';
import { PAGE_SIZE_LARGE } from '../../../constants/constants';
import { SearchIndex } from '../../../enums/search.enum';
import { CreateEventSubscription } from '../../../generated/events/api/createEventSubscription';
import {
  SubscriptionCategory,
  SubscriptionType,
} from '../../../generated/events/eventSubscription';
import { searchData } from '../../../rest/miscAPI';
import { listLengthValidator } from '../../../utils/Alerts/AlertsUtil';
import { getEntityName } from '../../../utils/EntityUtils';
import {
  checkIfDestinationIsInternal,
  getConfigFieldFromDestinationType,
} from '../../../utils/ObservabilityUtils';
import { ModifiedDestination } from '../AddObservabilityPage.interface';
import './destination-form-item.less';

function DestinationFormItem({
  heading,
  subHeading,
  buttonLabel,
}: Readonly<{
  heading: string;
  subHeading: string;
  buttonLabel: string;
}>) {
  const { t } = useTranslation();
  const form = Form.useFormInstance();
  const [destinationOptions, setDestinationOptions] = useState(
    DESTINATION_SOURCE_ITEMS.internal
  );

  const selectedDestinations = Form.useWatch<ModifiedDestination[]>(
    'destinations',
    form
  );

  const [selectedTrigger] =
    Form.useWatch<CreateEventSubscription['resources']>(['resources'], form) ??
    [];

  const filteredOptions = destinationOptions.map((o) => {
    return {
      ...o,
      disabled: selectedDestinations?.some((d) => d.type === o.value),
    };
  });

  const getPlaceholder = (type: SubscriptionType) => {
    switch (type) {
      case SubscriptionType.Slack:
        return 'https://hooks.slack.com/services/XXXXX/XXXXX/XXXXX';
      case SubscriptionType.MSTeams:
        return 'https://outlook.office.com/webhook/XXXXX/XXXXX/XXXXX';
      case SubscriptionType.GChat:
        return 'https://chat.googleapis.com/v1/spaces/XXXXX/messages?key=XXXXX';
      case SubscriptionType.Generic:
        return 'https://example.com';
      case SubscriptionType.Email:
        return 'Add ↵ seprated Email addresses';
      default:
        return '';
    }
  };

  const searchEntity = useCallback(
    async (search: string, searchIndex: SearchIndex, filters?: string) => {
      try {
        const response = await searchData(
          search,
          1,
          PAGE_SIZE_LARGE,
          filters ?? '',
          '',
          '',
          searchIndex
        );

        return response.data.hits.hits.map((d) => ({
          label: getEntityName(d._source),
          value: d._source.fullyQualifiedName,
        }));
      } catch (error) {
        return [];
      }
    },
    []
  );

  const getUserOptions = useCallback(
    async (searchText: string) => {
      return searchEntity(searchText, SearchIndex.USER, 'isBot:false');
    },
    [searchEntity]
  );

  const getTeamOptions = useCallback(
    async (searchText: string) => {
      return searchEntity(searchText, SearchIndex.TEAM);
    },
    [searchEntity]
  );

  const getConfigField = (
    type: SubscriptionType | SubscriptionCategory,
    fieldName: number
  ) => {
    switch (type) {
      case SubscriptionType.Slack:
      case SubscriptionType.MSTeams:
      case SubscriptionType.GChat:
      case SubscriptionType.Generic:
        return (
          <Form.Item
            name={[fieldName, 'config', 'endpoint']}
            rules={[
              {
                required: true,
                message: t('message.field-text-is-required', {
                  fieldText: t('label.endpoint-url'),
                }),
              },
            ]}>
            <Input placeholder={getPlaceholder(type)} />
          </Form.Item>
        );
      case SubscriptionType.Email:
        return (
          <Form.Item
            label=""
            name={[fieldName, 'config', 'receivers']}
            rules={[
              {
                required: true,
                message: t('message.field-text-is-required', {
                  fieldText: t('label.email'),
                }),
              },
            ]}>
            <Select
              mode="tags"
              open={false}
              placeholder={getPlaceholder(type)}
            />
          </Form.Item>
        );
      case SubscriptionCategory.Teams:
      case SubscriptionCategory.Users:
        return (
          <Form.Item
            className="w-full"
            name={[fieldName, 'config', 'receivers']}
            rules={[
              {
                required: true,
                message: t('message.field-text-is-required', {
                  fieldText: t('label.entity-list', {
                    entity: t('label.entity-name', {
                      entity:
                        type === SubscriptionCategory.Teams
                          ? t('label.team')
                          : t('label.owner'),
                    }),
                  }),
                }),
              },
            ]}>
            <AsyncSelect
              api={
                type === SubscriptionCategory.Teams
                  ? getTeamOptions
                  : getUserOptions
              }
              data-testid={`${
                type === SubscriptionCategory.Teams
                  ? t('label.team')
                  : t('label.user')
              }-select`}
              mode="multiple"
              placeholder={t('label.search-by-type', {
                type:
                  type === SubscriptionCategory.Teams
                    ? t('label.team-lowercase')
                    : t('label.owner-lowercase'),
              })}
            />
          </Form.Item>
        );
      case SubscriptionCategory.Admins:
      case SubscriptionCategory.Owners:
      case SubscriptionCategory.Followers:
        return (
          <Form.Item
            hidden
            initialValue
            label=""
            name={[
              fieldName,
              'config',
              getConfigFieldFromDestinationType(type),
            ]}>
            <Switch />
          </Form.Item>
        );
      default:
        return null;
    }
  };

  const showAddDestination = useMemo(
    () => filteredOptions.some((o) => !o.disabled),
    [filteredOptions]
  );

  const handleTabChange = useCallback((key) => {
    setDestinationOptions(
      DESTINATION_SOURCE_ITEMS[key as keyof typeof DESTINATION_SOURCE_ITEMS]
    );
  }, []);

  const customDestinationDropdown: SelectProps['dropdownRender'] = useCallback(
    (menu: React.ReactElement) => {
      return (
        <Tabs
          centered
          className="destination-select-dropdown"
          defaultActiveKey="internal"
          tabBarStyle={{
            background: 'white',
          }}
          onTabClick={handleTabChange}>
          <Tabs.TabPane key="internal" tab={t('label.internal')}>
            {menu}
          </Tabs.TabPane>
          <Tabs.TabPane key="external" tab={t('label.external')}>
            {menu}
          </Tabs.TabPane>
        </Tabs>
      );
    },
    [handleTabChange]
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

  return (
    <Card className="alert-form-item-container">
      <Row gutter={[8, 8]}>
        <Col span={24}>
          <Typography.Text className="font-medium">{heading}</Typography.Text>
        </Col>
        <Col span={24}>
          <Typography.Text className="text-xs text-grey-muted">
            {subHeading}
          </Typography.Text>
        </Col>
        <Col span={24}>
          <Form.List
            name={['destinations']}
            rules={[
              {
                validator: listLengthValidator(t('label.destination')),
              },
            ]}>
            {(fields, { add, remove }, { errors }) => {
              return (
                <>
                  {fields.map(({ key, name }) => {
                    const destinationType =
                      form.getFieldValue([
                        'destinations',
                        name,
                        'destinationType',
                      ]) ?? SubscriptionType.Email;

                    const isInternalDestinationSelected =
                      checkIfDestinationIsInternal(destinationType);

                    return (
                      <Row
                        className="p-b-md"
                        gutter={[16, 16]}
                        justify="space-between"
                        key={key}>
                        <Col flex="1 1 auto">
                          <Form.Item
                            required
                            messageVariables={{
                              fieldName: t('label.data-asset-plural'),
                            }}
                            name={[name, 'destinationType']}>
                            <Select
                              className="w-full"
                              data-testid="triggerConfig-type"
                              dropdownRender={customDestinationDropdown}
                              options={destinationOptions}
                              placeholder={t('label.select-field', {
                                field: t('label.destination'),
                              })}
                              onSelect={(value) => {
                                form.setFieldValue(['destinations', name], {
                                  destinationType: value,
                                });
                              }}
                            />
                          </Form.Item>
                        </Col>
                        <Col flex="1 1 auto">
                          {getHiddenDestinationFields(
                            isInternalDestinationSelected,
                            name,
                            destinationType
                          )}
                          {selectedDestinations &&
                            !isEmpty(selectedDestinations[name]) &&
                            selectedDestinations[name] &&
                            getConfigField(
                              selectedDestinations[name]?.destinationType,
                              name
                            )}
                        </Col>
                        <Col className="d-flex justify-end" flex="0 0 32px">
                          <Button
                            data-testid={`remove-action-rule-${name}`}
                            icon={<CloseOutlined />}
                            onClick={() => remove(name)}
                          />
                        </Col>
                        {destinationType &&
                          checkIfDestinationIsInternal(destinationType) && (
                            <Col span={24}>
                              <Form.Item
                                required
                                messageVariables={{
                                  fieldName: t('label.data-asset-plural'),
                                }}
                                name={[name, 'type']}>
                                <Select
                                  className="w-full"
                                  data-testid="triggerConfig-type"
                                  options={EXTERNAL_CATEGORY_OPTIONS}
                                  placeholder={t('label.select-field', {
                                    field: t('label.destination'),
                                  })}
                                />
                              </Form.Item>
                            </Col>
                          )}
                      </Row>
                    );
                  })}

                  {showAddDestination && (
                    <Col span={24}>
                      <Button
                        disabled={
                          isEmpty(selectedTrigger) || isNil(selectedTrigger)
                        }
                        type="primary"
                        onClick={() => add({})}>
                        {buttonLabel}
                      </Button>
                    </Col>
                  )}
                  <Col span={24}>
                    <Form.ErrorList errors={errors} />
                  </Col>
                </>
              );
            }}
          </Form.List>
        </Col>
      </Row>
    </Card>
  );
}

export default DestinationFormItem;
