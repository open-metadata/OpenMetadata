/*
 *  Copyright 2023 Collate.
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
  Col,
  Divider,
  Form,
  FormProps,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Typography,
} from 'antd';
import { DE_ACTIVE_COLOR, ICON_DIMENSION } from 'constants/constants';
import {
  SUBSCRIPTION_WEBHOOK,
  SUBSCRIPTION_WEBHOOK_LABEL,
  SUBSCRIPTION_WEBHOOK_OPTIONS,
} from 'constants/Teams.constants';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../../assets/svg/edit-new.svg';
import { ReactComponent as DeleteIcon } from '../../../../assets/svg/ic-delete.svg';

import { PlusOutlined } from '@ant-design/icons';
import Icon from '@ant-design/icons/lib/components/Icon';
import { useForm } from 'antd/lib/form/Form';
import TagsV1 from 'components/Tag/TagsV1/TagsV1.component';
import { TAG_CONSTANT, TAG_START_WITH } from 'constants/Tag.constants';
import { Webhook } from 'generated/type/profile';
import { isEmpty } from 'lodash';
import { getWebhookIcon } from 'utils/TeamUtils';
import { SubscriptionWebhook, TeamsSubscriptionProps } from '../team.interface';

const TeamsSubscription = ({
  subscription,
  updateTeamSubscription,
}: TeamsSubscriptionProps) => {
  const [form] = useForm();
  const { t } = useTranslation();
  const [editSubscription, setEditSubscription] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const getWebhookIconByKey = useCallback((item: SUBSCRIPTION_WEBHOOK) => {
    const Icon = getWebhookIcon(item);

    return (
      <Icon
        className="flex-shrink m-r-xss"
        data-testid={`${item}-icon`}
        height={24}
        width={24}
      />
    );
  }, []);

  // Watchers
  const webhooks: {
    webhook: string;
    endpoint: string;
  }[] = Form.useWatch(['subscriptions'], form);

  // Run time values needed for conditional rendering
  const subscriptionOptions = useMemo(() => {
    const exitingWebhook = webhooks?.map((f) => f?.webhook) ?? [];

    return SUBSCRIPTION_WEBHOOK_OPTIONS.map((func) => ({
      label: func.label,
      value: func.value,
      disabled: exitingWebhook.includes(func.value),
    }));
  }, [webhooks]);

  const cellItem = useCallback((key: string, value: Webhook) => {
    return (
      <div className="d-flex items-center w-full w-max-95">
        {getWebhookIconByKey(key as SUBSCRIPTION_WEBHOOK)}
        <Space className="w-full p-l-sm" direction="vertical" size={0}>
          <Typography.Text className="text-sm">
            {SUBSCRIPTION_WEBHOOK_LABEL[key as SUBSCRIPTION_WEBHOOK]}
          </Typography.Text>
          <Typography.Text
            className="text-xs text-grey-muted"
            ellipsis={{
              tooltip: true,
            }}>
            {value.endpoint}
          </Typography.Text>
        </Space>
      </div>
    );
  }, []);

  const subscriptionRenderElement = useMemo(
    () =>
      isEmpty(subscription) ? (
        <Space onClick={() => setEditSubscription(true)}>
          <TagsV1 startWith={TAG_START_WITH.PLUS} tag={TAG_CONSTANT} />
        </Space>
      ) : (
        <Space className="w-full" direction="vertical" size={12}>
          {Object.entries(subscription ?? {}).map((item) =>
            cellItem(item[0], item[1])
          )}
        </Space>
      ),
    [subscription]
  );

  const handleSave: FormProps['onFinish'] = async (values) => {
    setIsLoading(true);

    try {
      await updateTeamSubscription(
        values.subscriptions as SubscriptionWebhook[]
      );
    } catch {
      // parent block will throw error
    } finally {
      setEditSubscription(false);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (subscription) {
      form.setFieldsValue({
        subscriptions: Object.entries(subscription).map((item) => ({
          webhook: item[0],
          endpoint: item[1].endpoint,
        })),
      });
    }
  }, [subscription, editSubscription]);

  return (
    <Card
      className="ant-card-feed relative card-body-border-none card-padding-y-0"
      data-testid="teams-subscription"
      key="teams-subscription-card"
      title={
        <Space align="center">
          <Typography.Text className="right-panel-label">
            {t('label.subscription')}
          </Typography.Text>
          {!editSubscription && !isEmpty(subscription) && (
            <EditIcon
              className="cursor-pointer"
              color={DE_ACTIVE_COLOR}
              data-testid="edit-roles"
              {...ICON_DIMENSION}
              onClick={() => setEditSubscription(true)}
            />
          )}
        </Space>
      }>
      {subscriptionRenderElement}

      {editSubscription && (
        <Modal
          centered
          open
          closable={false}
          confirmLoading={isLoading}
          maskClosable={false}
          okButtonProps={{
            form: 'subscription-form',
            type: 'primary',
            htmlType: 'submit',
          }}
          okText={t('label.confirm')}
          title={t('label.add-entity', {
            entity: t('label.subscription'),
          })}
          onCancel={() => setEditSubscription(false)}>
          <Form
            data-testid="subscription-modal"
            form={form}
            id="subscription-form"
            onFinish={handleSave}>
            <Form.List name={['subscriptions']}>
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name }) => {
                    return (
                      <div key={`subscriptions-${key}`}>
                        {name > 0 && (
                          <Divider
                            style={{
                              margin: 0,
                              marginBottom: '16px',
                            }}
                          />
                        )}
                        <Row>
                          <Col span={22}>
                            <div className="flex-1">
                              <Form.Item key={key} name={[name, 'webhook']}>
                                <Select
                                  options={subscriptionOptions}
                                  placeholder={t('label.select-field', {
                                    field: t('label.condition'),
                                  })}
                                />
                              </Form.Item>
                              <Form.Item
                                key={key}
                                name={[name, 'endpoint']}
                                rules={[
                                  {
                                    required: true,
                                    message: t('label.field-required-plural', {
                                      field: t('label.endpoint'),
                                    }),
                                  },
                                  {
                                    type: 'url',
                                    message: t(
                                      'message.endpoint-should-be-valid'
                                    ),
                                  },
                                ]}>
                                <Input
                                  placeholder={t('label.enter-entity-value', {
                                    entity: t('label.endpoint'),
                                  })}
                                />
                              </Form.Item>
                            </div>
                          </Col>
                          <Col span={2}>
                            <Icon
                              className="m-l-sm"
                              component={DeleteIcon}
                              data-testid={`remove-filter-rule-${name}`}
                              style={{ fontSize: '16px' }}
                              onClick={() => remove(name)}
                            />
                          </Col>
                        </Row>
                      </div>
                    );
                  })}
                  {webhooks?.length !== SUBSCRIPTION_WEBHOOK_OPTIONS.length && (
                    <Form.Item>
                      <Button
                        block
                        icon={<PlusOutlined />}
                        type="dashed"
                        onClick={() => add()}>
                        {t('label.add-entity', {
                          entity: t('label.webhook'),
                        })}
                      </Button>
                    </Form.Item>
                  )}
                </>
              )}
            </Form.List>
          </Form>
        </Modal>
      )}
    </Card>
  );
};

export default TeamsSubscription;
