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
    Box,
    FormField,
    HookForm,
    Input,
    Select,
    SimpleModal,
    Typography
} from '@openmetadata/ui-core-components';
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { NO_DATA_PLACEHOLDER } from '../../../../../constants/constants';
import {
    SUBSCRIPTION_WEBHOOK,
    SUBSCRIPTION_WEBHOOK_OPTIONS
} from '../../../../../constants/Teams.constants';
import { Webhook } from '../../../../../generated/type/profile';
import { isValidUrl } from '../../../../../utils/SSOUtils';
import { getWebhookIcon } from '../../../../../utils/TeamUtils';
import { EditIconButton } from '../../../../common/IconButtons/EditIconButton';

import { SubscriptionWebhook, TeamsSubscriptionProps } from '../team.interface';
import './teams-subscription.less';

// react-aria keys cannot be empty, so the "None" option gets a sentinel id.
const NO_WEBHOOK = 'none';

const TeamsSubscription = ({
  subscription,
  hasEditPermission,
  updateTeamSubscription,
}: TeamsSubscriptionProps) => {
  const { t } = useTranslation();
  const form = useForm<SubscriptionWebhook>({
    defaultValues: { webhook: NO_WEBHOOK, endpoint: '' },
  });
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

  const isWebhookEmpty = form.watch('webhook') === NO_WEBHOOK;

  const cellItem = useCallback(
    (key: string, value: Webhook) => (
      <Typography>
        <a href={value.endpoint} rel="noopener noreferrer" target="_blank">
          {getWebhookIconByKey(key as SUBSCRIPTION_WEBHOOK)}
        </a>
      </Typography>
    ),
    [getWebhookIconByKey]
  );

  const subscriptionRenderElement = useMemo(() => {
    const webhook = Object.entries(subscription ?? {})?.[0];

    if (isEmpty(subscription)) {
      if (hasEditPermission) {
        return (
          <div className="d-flex gap-2">
            <Typography
              className="font-medium text-sm text-secondary-new"
              data-testid="subscription-no-data">
              {t('label.none')}
            </Typography>
          </div>
        );
      }

      return (
        <Typography
          className="font-medium text-sm text-secondary-new"
          data-testid="subscription-no-data">
          {NO_DATA_PLACEHOLDER}
        </Typography>
      );
    }

    return cellItem(webhook[0], webhook[1]);
  }, [subscription, hasEditPermission, cellItem, t]);

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
      form.setValue('endpoint', '');
      form.clearErrors('endpoint');
    }
  }, [isWebhookEmpty, form]);

  useEffect(() => {
    const [webhook, value] = Object.entries(subscription ?? {})[0] ?? [];
    form.reset({
      webhook: webhook ?? NO_WEBHOOK,
      endpoint: value?.endpoint ?? '',
    });
  }, [subscription, editSubscription, form]);

  const webhookItems = useMemo(
    () =>
      SUBSCRIPTION_WEBHOOK_OPTIONS.map((option) => ({
        id: option.value || NO_WEBHOOK,
        label: t(option.label),
      })),
    [t]
  );

  return (
    <Box
      align="start"
      className="layout-space layout-space-horizontal teams-subscription-container d-flex flex-col"
      data-testid="teams-subscription"
      gap={2}
      itemClassName="layout-space-item">
      <div className="d-flex gap-1 items-center teams-subscription-label-container">
        <Typography className="right-panel-label text-sm font-medium subscription-label">
          {`${t('label.subscription')}`}
        </Typography>
        {!editSubscription && !isEmpty(subscription) && hasEditPermission && (
          <EditIconButton
            newLook
            data-testid="edit-team-subscription"
            size="small"
            title={t('label.edit-entity', {
              entity: t('label.subscription'),
            })}
            onClick={(e) => {
              // Used to stop click propagation event to parent TeamDetailV1 collapsible panel
              e.stopPropagation();
              setEditSubscription(true);
            }}
          />
        )}
        {isEmpty(subscription) && hasEditPermission && (
          <EditIconButton
            newLook
            data-testid="edit-team-subscription"
            size="small"
            title={t('label.edit-entity', {
              entity: t('label.subscription'),
            })}
            onClick={(e) => {
              // Used to stop click propagation event to parent TeamDetailV1 collapsible panel
              e.stopPropagation();
              setEditSubscription(true);
            }}
          />
        )}
      </div>

      {subscriptionRenderElement}

      {editSubscription && (
        // Stops clicks in the form reaching the parent TeamDetailV1 collapsible panel
        <div role="presentation" onClick={(e) => e.stopPropagation()}>
          <SimpleModal
            isOpen
            isDismissable={false}
            isOkLoading={isLoading}
            okText={t('label.confirm')}
            title={t('label.add-entity', {
              entity: t('label.subscription'),
            })}
            onCancel={() => setEditSubscription(false)}
            onOk={form.handleSubmit(handleSave)}>
            <HookForm
              className="tw:flex tw:flex-col tw:gap-4"
              data-testid="subscription-modal"
              form={form}
              id="subscription-form"
              onSubmit={form.handleSubmit(handleSave)}>
              <FormField control={form.control} name="webhook">
                {({ field }) => (
                  <Select
                    data-testid="webhook-select"
                    items={webhookItems}
                    label={t('label.webhook')}
                    placeholder={t('label.select-field', {
                      field: t('label.condition'),
                    })}
                    selectedKey={field.value}
                    onSelectionChange={(key) =>
                      key !== null && field.onChange(String(key))
                    }>
                    {(item) => <Select.Item id={item.id} label={item.label} />}
                  </Select>
                )}
              </FormField>
              <FormField
                control={form.control}
                name="endpoint"
                rules={{
                  required:
                    !isWebhookEmpty &&
                    t('label.field-required-plural', {
                      field: t('label.endpoint'),
                    }),
                  validate: (value) =>
                    isWebhookEmpty ||
                    isValidUrl(value) ||
                    t('message.endpoint-should-be-valid'),
                }}>
                {({ field, fieldState }) => (
                  <Input
                    hint={fieldState.error?.message}
                    id="endpoint"
                    isDisabled={isWebhookEmpty}
                    isInvalid={fieldState.invalid}
                    label={t('label.endpoint')}
                    placeholder={t('label.enter-entity-value', {
                      entity: t('label.endpoint'),
                    })}
                    value={field.value}
                    onBlur={field.onBlur}
                    onChange={field.onChange}
                  />
                )}
              </FormField>
            </HookForm>
          </SimpleModal>
        </div>
      )}
    </Box>
  );
};

export default TeamsSubscription;
