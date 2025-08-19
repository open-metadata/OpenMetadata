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
import { Button, Form, Input, Modal, Space, Typography,  } from 'antd';
import { Select, Tooltip } from '../../../../common/AntdCompat';;
import { useForm } from 'antd/lib/form/Form';
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import './teams-subscription.less';
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
          <div className="d-flex gap-2">
            <Typography.Text
              className="font-medium text-sm text-secondary-new "
              data-testid="subscription-no-data">
              {t('label.none')}
            </Typography.Text>
          </div>
        );
      }

      return (
        <Typography.Text
          className="font-medium text-sm text-secondary-new"
          data-testid="subscription-no-data">
          {NO_DATA_PLACEHOLDER}
        </Typography.Text>
      );
    }

    return cellItem(webhook[0], webhook[1]);
  }, [subscription, hasEditPermission]);

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
    <Space
      align="start"
      className="teams-subscription-container d-flex flex-col gap-2"
      data-testid="teams-subscription">
      <div className="d-flex gap-1 items-center teams-subscription-label-container">
        <Typography.Text className="right-panel-label text-sm font-medium subscription-label">
          {`${t('label.subscription')}`}
        </Typography.Text>
        {!editSubscription && !isEmpty(subscription) && hasEditPermission && (
          <Tooltip
            title={t('label.edit-entity', {
              entity: t('label.subscription'),
            })}>
            <Button
              className="flex-center teams-info-email-edit-button p-0"
              data-testid="edit-team-subscription"
              icon={<EditIcon {...ICON_DIMENSION} width="12px" />}
              {...ICON_DIMENSION}
              onClick={(e) => {
                // Used to stop click propagation event to parent TeamDetailV1 collapsible panel
                e.stopPropagation();
                setEditSubscription(true);
              }}
            />
          </Tooltip>
        )}
        {isEmpty(subscription) && hasEditPermission && (
          <Tooltip
            title={t('label.edit-entity', {
              entity: t('label.subscription'),
            })}>
            <Button
              className="flex-center teams-info-email-edit-button p-0"
              data-testid="edit-team-subscription"
              icon={
                <EditIcon
                  color={DE_ACTIVE_COLOR}
                  {...ICON_DIMENSION}
                  width="12px"
                />
              }
              onClick={(e) => {
                // Used to stop click propagation event to parent TeamDetailV1 collapsible panel
                e.stopPropagation();
                setEditSubscription(true);
              }}
            />
          </Tooltip>
        )}
      </div>

      {subscriptionRenderElement}

      {editSubscription && (
        // Used Button to stop click propagation event anywhere in the form to parent TeamDetailV1 collapsible panel
        <Button
          className="remove-button-default-styling"
          onClick={(e) => e.stopPropagation()}>
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
        </Button>
      )}
    </Space>
  );
};

export default TeamsSubscription;
