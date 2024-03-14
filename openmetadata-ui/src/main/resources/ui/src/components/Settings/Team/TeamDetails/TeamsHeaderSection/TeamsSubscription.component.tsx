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
import { Form, Input, Modal, Select, Space, Tooltip, Typography } from 'antd';
import { useForm } from 'antd/lib/form/Form';
import { isEmpty } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../../../assets/svg/edit-new.svg';
import {
  DE_ACTIVE_COLOR,
  ICON_DIMENSION,
  NO_DATA_PLACEHOLDER,
} from '../../../../../constants/constants';
import {
  SUBSCRIPTION_WEBHOOK,
  SUBSCRIPTION_WEBHOOK_OPTIONS,
} from '../../../../../constants/Teams.constants';
import { Webhook } from '../../../../../generated/type/profile';
import { getWebhookIcon } from '../../../../../utils/TeamUtils';
import { SubscriptionWebhook, TeamsSubscriptionProps } from '../team.interface';

const TeamsSubscription = ({
  subscription,
  hasEditPermission,
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
        className="align-middle"
        data-testid={`${item}-icon`}
        height={20}
        width={20}
      />
    );
  }, []);

  // Watchers
  const isWebhookEmpty = isEmpty(Form.useWatch('webhook', form));

  const cellItem = useCallback(
    (key: string, value: Webhook) => (
      <Typography.Link href={value.endpoint} target="_blank">
        {getWebhookIconByKey(key as SUBSCRIPTION_WEBHOOK)}
      </Typography.Link>
    ),
    []
  );

  const subscriptionRenderElement = useMemo(() => {
    const webhook = Object.entries(subscription ?? {})?.[0];

    if (isEmpty(subscription)) {
      if (hasEditPermission) {
        return (
          <div className="flex-center gap-2">
            <Typography.Text
              className="font-medium"
              data-testid="subscription-no-data">
              {t('label.none')}
            </Typography.Text>
            <Tooltip
              title={t('label.edit-entity', {
                entity: t('label.subscription'),
              })}>
              <EditIcon
                className="cursor-pointer"
                color={DE_ACTIVE_COLOR}
                data-testid="edit-team-subscription"
                width={14}
                onClick={() => setEditSubscription(true)}
              />
            </Tooltip>
          </div>
        );
      }

      return (
        <Typography.Text
          className="font-medium"
          data-testid="subscription-no-data">
          {NO_DATA_PLACEHOLDER}
        </Typography.Text>
      );
    }

    return cellItem(webhook[0], webhook[1]);
  }, [subscription, hasEditPermission, setEditSubscription]);

  const handleSave = async (values: SubscriptionWebhook) => {
    setIsLoading(true);

    try {
      await updateTeamSubscription(isWebhookEmpty ? undefined : values);
    } catch {
      // parent block will throw error
    } finally {
      setEditSubscription(false);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isWebhookEmpty) {
      form.setFieldValue('endpoint', '');
    }
  }, [isWebhookEmpty]);

  useEffect(() => {
    if (subscription) {
      const data = Object.entries(subscription)[0];
      form.setFieldsValue({
        webhook: data[0],
        endpoint: data[1].endpoint,
      });
    }
  }, [subscription, editSubscription]);

  return (
    <Space align="center" data-testid="teams-subscription">
      <Typography.Text className="right-panel-label font-normal">
        {`${t('label.subscription')} :`}
      </Typography.Text>
      {subscriptionRenderElement}

      {!editSubscription && !isEmpty(subscription) && hasEditPermission && (
        <Tooltip
          title={t('label.edit-entity', {
            entity: t('label.subscription'),
          })}>
          <EditIcon
            className="cursor-pointer align-middle"
            color={DE_ACTIVE_COLOR}
            data-testid="edit-team-subscription"
            {...ICON_DIMENSION}
            onClick={() => setEditSubscription(true)}
          />
        </Tooltip>
      )}

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
            layout="vertical"
            onFinish={handleSave}>
            <Form.Item label={t('label.webhook')} name="webhook">
              <Select
                options={SUBSCRIPTION_WEBHOOK_OPTIONS}
                placeholder={t('label.select-field', {
                  field: t('label.condition'),
                })}
              />
            </Form.Item>
            <Form.Item
              label={t('label.endpoint')}
              name="endpoint"
              rules={[
                {
                  required: !isWebhookEmpty,
                  message: t('label.field-required-plural', {
                    field: t('label.endpoint'),
                  }),
                },
                {
                  type: 'url',
                  message: t('message.endpoint-should-be-valid'),
                },
              ]}>
              <Input
                disabled={isWebhookEmpty}
                placeholder={t('label.enter-entity-value', {
                  entity: t('label.endpoint'),
                })}
              />
            </Form.Item>
          </Form>
        </Modal>
      )}
    </Space>
  );
};

export default TeamsSubscription;
