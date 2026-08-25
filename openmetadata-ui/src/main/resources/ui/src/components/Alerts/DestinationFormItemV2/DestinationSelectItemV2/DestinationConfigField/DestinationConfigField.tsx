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
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  BadgeWithButton,
  Grid,
  Input,
  PasswordInput,
  Select,
} from '@openmetadata/ui-core-components';
import { isEmpty } from 'lodash';
import { useCallback, useState } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { ReactComponent as ConfigIcon } from '../../../../../assets/svg/configuration-icon.svg';
import { DESTINATION_TYPE_BASED_PLACEHOLDERS } from '../../../../../constants/Alerts.constants';
import { SearchIndex } from '../../../../../enums/search.enum';
import {
  SubscriptionCategory,
  SubscriptionType,
  Type,
} from '../../../../../generated/events/eventSubscription';
import { searchEntity } from '../../../../../utils/Alerts/AlertsUtil';
import { getTermQuery } from '../../../../../utils/SearchPureUtils';
import TeamAndUserSelectItemV2 from '../../TeamAndUserSelectItemV2/TeamAndUserSelectItemV2';

interface DestinationConfigFieldProps {
  type: SubscriptionType | SubscriptionCategory;
  fieldName: number;
}

const getUserOptions = async (searchText: string) =>
  searchEntity({
    searchText,
    searchIndex: SearchIndex.USER,
    queryFilter: getTermQuery({ isBot: 'false' }),
  });

const getTeamOptions = async (searchText: string) =>
  searchEntity({ searchText, searchIndex: SearchIndex.TEAM });

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <p className="tw:mt-1 tw:text-sm tw:text-fg-error-secondary">{message}</p>
  );
}

function EmailTagInput({ fieldName }: { fieldName: number }) {
  const { t } = useTranslation();
  const { setValue, control } = useFormContext();
  const [inputValue, setInputValue] = useState('');

  const receivers: string[] =
    useWatch({
      name: `destinations.${fieldName}.config.receivers`,
      control,
    }) ?? [];

  const addEmail = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed || receivers.includes(trimmed)) {
      setInputValue('');

      return;
    }
    setValue(`destinations.${fieldName}.config.receivers`, [
      ...receivers,
      trimmed,
    ]);
    setInputValue('');
  }, [inputValue, receivers, fieldName, setValue]);

  const removeEmail = useCallback(
    (email: string) => {
      setValue(
        `destinations.${fieldName}.config.receivers`,
        receivers.filter((r) => r !== email)
      );
    },
    [receivers, fieldName, setValue]
  );

  return (
    <div className="tw:flex tw:flex-col tw:gap-2">
      <Input
        data-testid={`email-input-${fieldName}`}
        inputDataTestId={`email-input-field-${fieldName}`}
        placeholder={
          DESTINATION_TYPE_BASED_PLACEHOLDERS[SubscriptionType.Email] ?? ''
        }
        value={inputValue}
        onChange={(val) => setInputValue(val)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            addEmail();
          }
        }}
      />
      {!isEmpty(receivers) && (
        <div
          className="tw:flex tw:flex-wrap tw:gap-1.5"
          data-testid={`email-tags-${fieldName}`}>
          {receivers.map((email) => (
            <BadgeWithButton
              buttonLabel={t('label.remove')}
              color="gray"
              data-testid={`email-tag-${email}`}
              key={email}
              type="pill-color"
              onButtonClick={() => removeEmail(email)}>
              {email}
            </BadgeWithButton>
          ))}
        </div>
      )}
    </div>
  );
}

function DestinationConfigField({
  type,
  fieldName,
}: Readonly<DestinationConfigFieldProps>) {
  const { t } = useTranslation();
  const { control } = useFormContext();

  const selectedAuthType: string | undefined = useWatch({
    name: `destinations.${fieldName}.config.authType.type`,
    control,
  });

  const isWebhookType =
    type === SubscriptionType.Slack ||
    type === SubscriptionType.MSTeams ||
    type === SubscriptionType.GChat ||
    type === SubscriptionType.Webhook;

  if (isWebhookType) {
    return (
      <>
        <Grid.Item span={12}>
          <Controller
            control={control}
            name={`destinations.${fieldName}.config.endpoint`}
            render={({ field, fieldState }) => (
              <div>
                <Input
                  data-testid={`endpoint-input-${fieldName}`}
                  inputDataTestId={`endpoint-input-field-${fieldName}`}
                  placeholder={DESTINATION_TYPE_BASED_PLACEHOLDERS[type] ?? ''}
                  ref={field.ref}
                  value={field.value ?? ''}
                  onBlur={() => field.onBlur()}
                  onChange={(val) => field.onChange(val)}
                />
                <FieldError message={fieldState.error?.message} />
              </div>
            )}
            rules={{
              required: t('message.field-text-is-required', {
                fieldText: t('label.endpoint-url'),
              }),
            }}
          />
        </Grid.Item>

        <Grid.Item span={24}>
          <Accordion>
            <AccordionItem id={`advanced-config-${fieldName}`}>
              <AccordionHeader>
                <span className="tw:flex tw:items-center tw:gap-2">
                  <ConfigIcon className="tw:size-4" />
                  {t('label.advanced-configuration')}
                </span>
              </AccordionHeader>
              <AccordionPanel>
                <Grid colGap="2" rowGap="2">
                  <Grid.Item span={24}>
                    <Controller
                      control={control}
                      name={`destinations.${fieldName}.config.authType.type`}
                      render={({ field }) => (
                        <Select
                          data-testid={`auth-type-select-${fieldName}`}
                          label={`${t('label.authentication-type')}:`}
                          placeholder={t('label.authentication-type')}
                          selectedKey={field.value ?? null}
                          onSelectionChange={(key) => field.onChange(key)}>
                          <Select.Item id={Type.None}>
                            {t('label.no-authentication')}
                          </Select.Item>
                          <Select.Item id={Type.Bearer}>
                            {t('label.bearer-hmac-signature')}
                          </Select.Item>
                          <Select.Item id={Type.Oauth2}>
                            {t('label.oauth2-client-credential-plural')}
                          </Select.Item>
                        </Select>
                      )}
                    />
                  </Grid.Item>

                  {selectedAuthType === Type.Bearer && (
                    <Grid.Item data-testid="secret-key" span={24}>
                      <Controller
                        control={control}
                        name={`destinations.${fieldName}.config.authType.secretKey`}
                        render={({ field, fieldState }) => (
                          <div>
                            <PasswordInput
                              data-testid={`secret-key-input-${fieldName}`}
                              label={`${t('label.secret-key')}:`}
                              placeholder={t('label.secret-key')}
                              ref={field.ref}
                              value={field.value ?? ''}
                              onBlur={() => field.onBlur()}
                              onChange={(val) => field.onChange(val)}
                            />
                            <FieldError message={fieldState.error?.message} />
                          </div>
                        )}
                        rules={{
                          required: t('message.field-text-is-required', {
                            fieldText: t('label.secret-key'),
                          }),
                        }}
                      />
                    </Grid.Item>
                  )}

                  {selectedAuthType === Type.Oauth2 && (
                    <>
                      <Grid.Item span={24}>
                        <Controller
                          control={control}
                          name={`destinations.${fieldName}.config.authType.tokenUrl`}
                          render={({ field, fieldState }) => (
                            <div>
                              <Input
                                data-testid={`token-url-input-${fieldName}`}
                                inputDataTestId={`token-url-input-field-${fieldName}`}
                                label={`${t('label.token-url')}:`}
                                placeholder="https://auth.example.com/oauth/token"
                                ref={field.ref}
                                value={field.value ?? ''}
                                onBlur={() => field.onBlur()}
                                onChange={(val) => field.onChange(val)}
                              />
                              <FieldError message={fieldState.error?.message} />
                            </div>
                          )}
                          rules={{
                            required: t('message.field-text-is-required', {
                              fieldText: t('label.token-url'),
                            }),
                          }}
                        />
                      </Grid.Item>
                      <Grid.Item span={12}>
                        <Controller
                          control={control}
                          name={`destinations.${fieldName}.config.authType.clientId`}
                          render={({ field, fieldState }) => (
                            <div>
                              <PasswordInput
                                data-testid={`client-id-input-${fieldName}`}
                                label={`${t('label.client-id')}:`}
                                placeholder={t('label.client-id')}
                                ref={field.ref}
                                value={field.value ?? ''}
                                onBlur={() => field.onBlur()}
                                onChange={(val) => field.onChange(val)}
                              />
                              <FieldError message={fieldState.error?.message} />
                            </div>
                          )}
                          rules={{
                            required: t('message.field-text-is-required', {
                              fieldText: t('label.client-id'),
                            }),
                          }}
                        />
                      </Grid.Item>
                      <Grid.Item span={12}>
                        <Controller
                          control={control}
                          name={`destinations.${fieldName}.config.authType.clientSecret`}
                          render={({ field, fieldState }) => (
                            <div>
                              <PasswordInput
                                data-testid={`client-secret-input-${fieldName}`}
                                label={`${t('label.client-secret')}:`}
                                placeholder={t('label.client-secret')}
                                ref={field.ref}
                                value={field.value ?? ''}
                                onBlur={() => field.onBlur()}
                                onChange={(val) => field.onChange(val)}
                              />
                              <FieldError message={fieldState.error?.message} />
                            </div>
                          )}
                          rules={{
                            required: t('message.field-text-is-required', {
                              fieldText: t('label.client-secret'),
                            }),
                          }}
                        />
                      </Grid.Item>
                    </>
                  )}
                </Grid>
              </AccordionPanel>
            </AccordionItem>
          </Accordion>
        </Grid.Item>
      </>
    );
  }

  if (type === SubscriptionType.Email) {
    return (
      <Grid.Item span={24}>
        <EmailTagInput fieldName={fieldName} />
      </Grid.Item>
    );
  }

  if (type === SubscriptionCategory.Teams) {
    return (
      <Grid.Item span={24}>
        <TeamAndUserSelectItemV2
          destinationNumber={fieldName}
          entityType={t('label.team-lowercase')}
          fieldName={[fieldName, 'config', 'receivers']}
          onSearch={getTeamOptions}
        />
      </Grid.Item>
    );
  }

  if (type === SubscriptionCategory.Users) {
    return (
      <Grid.Item span={24}>
        <TeamAndUserSelectItemV2
          destinationNumber={fieldName}
          entityType={t('label.user-lowercase')}
          fieldName={[fieldName, 'config', 'receivers']}
          onSearch={getUserOptions}
        />
      </Grid.Item>
    );
  }

  return null;
}

export default DestinationConfigField;
