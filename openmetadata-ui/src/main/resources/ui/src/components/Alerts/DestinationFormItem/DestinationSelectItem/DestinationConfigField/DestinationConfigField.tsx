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
  Badge,
  BadgeWithButton,
  Button,
  Grid,
  Input,
  PasswordInput,
  RadioButton,
  RadioGroup,
  Select,
} from '@openmetadata/ui-core-components';
import { Plus, Trash01 } from '@untitledui/icons';
import { isEmpty } from 'lodash';
import { useCallback, useState } from 'react';
import {
  Controller,
  useFieldArray,
  useFormContext,
  useWatch,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { ReactComponent as ConfigIcon } from '../../../../../assets/svg/configuration-icon.svg';
import { DESTINATION_TYPE_BASED_PLACEHOLDERS } from '../../../../../constants/Alerts.constants';
import { SearchIndex } from '../../../../../enums/search.enum';
import {
  HTTPMethod,
  SubscriptionCategory,
  SubscriptionType,
  Type,
} from '../../../../../generated/events/eventSubscription';
import { searchEntity } from '../../../../../utils/Alerts/AlertsUtil';
import { getTermQuery } from '../../../../../utils/SearchPureUtils';
import TeamAndUserSelectItem from '../../TeamAndUserSelectItem/TeamAndUserSelectItem';
import { isValidEmailAddress } from './DestinationConfigField.utils';

interface DestinationConfigFieldProps {
  type: SubscriptionType | SubscriptionCategory;
  fieldName: number;
  isViewMode?: boolean;
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

function EmailTagInput({
  fieldName,
  isDisabled,
}: {
  fieldName: number;
  isDisabled: boolean;
}) {
  const { t } = useTranslation();
  const { setValue, control } = useFormContext();
  const [inputValue, setInputValue] = useState('');
  const [emailError, setEmailError] = useState<string>();

  const receivers: string[] =
    useWatch({
      name: `destinations.${fieldName}.config.receivers`,
      control,
    }) ?? [];

  const addEmail = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed || receivers.includes(trimmed)) {
      setInputValue('');
      setEmailError(undefined);

      return;
    }
    if (!isValidEmailAddress(trimmed)) {
      setEmailError(t('message.email-is-invalid'));

      return;
    }
    setValue(`destinations.${fieldName}.config.receivers`, [
      ...receivers,
      trimmed,
    ]);
    setInputValue('');
    setEmailError(undefined);
  }, [inputValue, receivers, fieldName, setValue, t]);

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
        isDisabled={isDisabled}
        placeholder={
          DESTINATION_TYPE_BASED_PLACEHOLDERS[SubscriptionType.Email] ?? ''
        }
        value={inputValue}
        onChange={(val) => {
          setInputValue(val);
          setEmailError(undefined);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            addEmail();
          }
        }}
      />
      <FieldError message={emailError} />
      {!isEmpty(receivers) && (
        <div
          className="tw:flex tw:flex-wrap tw:gap-1.5"
          data-testid={`email-tags-${fieldName}`}>
          {receivers.map((email) =>
            isDisabled ? (
              <Badge
                color="gray"
                data-testid={`email-tag-${email}`}
                key={email}
                type="pill-color">
                {email}
              </Badge>
            ) : (
              <BadgeWithButton
                buttonLabel={t('label.remove')}
                color="gray"
                data-testid={`email-tag-${email}`}
                key={email}
                type="pill-color"
                onButtonClick={() => removeEmail(email)}>
                {email}
              </BadgeWithButton>
            )
          )}
        </div>
      )}
    </div>
  );
}

interface KeyValueListProps {
  fieldName: number;
  isDisabled: boolean;
  name: 'headers' | 'queryParams';
}

function KeyValueList({
  fieldName,
  isDisabled,
  name,
}: Readonly<KeyValueListProps>) {
  const { t } = useTranslation();
  const { control } = useFormContext();
  const fieldPath = `destinations.${fieldName}.config.${name}` as const;
  const { fields, append, remove } = useFieldArray({
    control,
    name: fieldPath as never,
  });
  const isHeaders = name === 'headers';
  const testIdPrefix = isHeaders ? 'header' : 'query-param';

  return (
    <div className="tw:flex tw:flex-col tw:gap-2">
      <div className="tw:flex tw:items-center tw:justify-between">
        <span className="tw:text-sm tw:font-medium tw:text-primary">
          {isHeaders
            ? t('label.header-plural')
            : t('label.query-parameter-plural')}
        </span>
        {!isDisabled && (
          <Button
            aria-label={t('label.add')}
            color="secondary"
            data-testid={`add-${testIdPrefix}-button-${fieldName}`}
            iconLeading={Plus}
            size="xs"
            onPress={() => append({ key: '', value: '' } as never)}
          />
        )}
      </div>
      {fields.map((field, index) => (
        <div className="tw:flex tw:items-start tw:gap-2" key={field.id}>
          <div className="tw:grid tw:flex-1 tw:grid-cols-2 tw:gap-2">
            <Controller
              control={control}
              name={`${fieldPath}.${index}.key`}
              render={({ field: controllerField, fieldState }) => (
                <div>
                  <Input
                    data-testid={`${testIdPrefix}-key-input-${index}`}
                    inputDataTestId={`${testIdPrefix}-key-input-field-${index}`}
                    isDisabled={isDisabled}
                    placeholder={t('label.key')}
                    ref={controllerField.ref}
                    value={controllerField.value ?? ''}
                    onBlur={controllerField.onBlur}
                    onChange={controllerField.onChange}
                  />
                  <FieldError message={fieldState.error?.message} />
                </div>
              )}
              rules={{
                required: t('message.field-text-is-required', {
                  fieldText: t('label.key'),
                }),
              }}
            />
            <Controller
              control={control}
              name={`${fieldPath}.${index}.value`}
              render={({ field: controllerField, fieldState }) => (
                <div>
                  <Input
                    data-testid={`${testIdPrefix}-value-input-${index}`}
                    inputDataTestId={`${testIdPrefix}-value-input-field-${index}`}
                    isDisabled={isDisabled}
                    placeholder={t('label.value')}
                    ref={controllerField.ref}
                    value={controllerField.value ?? ''}
                    onBlur={controllerField.onBlur}
                    onChange={controllerField.onChange}
                  />
                  <FieldError message={fieldState.error?.message} />
                </div>
              )}
              rules={{
                required: t('message.field-text-is-required', {
                  fieldText: t('label.value'),
                }),
              }}
            />
          </div>
          {!isDisabled && (
            <Button
              aria-label={t('label.remove')}
              color="secondary"
              data-testid={`remove-${testIdPrefix}-button-${index}`}
              iconLeading={Trash01}
              size="xs"
              onPress={() => remove(index)}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function DestinationConfigField({
  type,
  fieldName,
  isViewMode = false,
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
                  isDisabled={isViewMode}
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
                          isDisabled={isViewMode}
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
                              isDisabled={isViewMode}
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
                                isDisabled={isViewMode}
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
                                isDisabled={isViewMode}
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
                                isDisabled={isViewMode}
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
                      <Grid.Item span={24}>
                        <Controller
                          control={control}
                          name={`destinations.${fieldName}.config.authType.scope`}
                          render={({ field }) => (
                            <Input
                              data-testid={`scope-input-${fieldName}`}
                              inputDataTestId={`scope-input-field-${fieldName}`}
                              isDisabled={isViewMode}
                              label={`${t('label.scope')}:`}
                              placeholder={`${t('label.scope')} (${t(
                                'label.optional'
                              )})`}
                              ref={field.ref}
                              value={field.value ?? ''}
                              onBlur={field.onBlur}
                              onChange={field.onChange}
                            />
                          )}
                        />
                      </Grid.Item>
                    </>
                  )}

                  <Grid.Item span={24}>
                    <KeyValueList
                      fieldName={fieldName}
                      isDisabled={isViewMode}
                      name="headers"
                    />
                  </Grid.Item>
                  <Grid.Item span={24}>
                    <KeyValueList
                      fieldName={fieldName}
                      isDisabled={isViewMode}
                      name="queryParams"
                    />
                  </Grid.Item>
                  <Grid.Item span={24}>
                    <Controller
                      control={control}
                      defaultValue={HTTPMethod.Post}
                      name={`destinations.${fieldName}.config.httpMethod`}
                      render={({ field }) => (
                        <RadioGroup
                          className="tw:flex tw:gap-4"
                          data-testid={`http-method-${fieldName}`}
                          isDisabled={isViewMode}
                          value={field.value ?? HTTPMethod.Post}
                          onChange={field.onChange}>
                          <RadioButton
                            label={HTTPMethod.Post}
                            value={HTTPMethod.Post}
                          />
                          <RadioButton
                            label={HTTPMethod.Put}
                            value={HTTPMethod.Put}
                          />
                        </RadioGroup>
                      )}
                    />
                  </Grid.Item>
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
        <Controller
          control={control}
          name={`destinations.${fieldName}.config.receivers`}
          render={({ fieldState }) => (
            <>
              <EmailTagInput fieldName={fieldName} isDisabled={isViewMode} />
              <FieldError message={fieldState.error?.message} />
            </>
          )}
          rules={{
            validate: (receivers) =>
              !isEmpty(receivers) ||
              t('message.field-text-is-required', {
                fieldText: t('label.email'),
              }),
          }}
        />
      </Grid.Item>
    );
  }

  if (
    type === SubscriptionCategory.Teams ||
    type === SubscriptionCategory.Users
  ) {
    const isTeam = type === SubscriptionCategory.Teams;

    return (
      <Grid.Item span={24}>
        <Controller
          control={control}
          name={`destinations.${fieldName}.config.receivers`}
          render={({ fieldState }) => (
            <>
              <TeamAndUserSelectItem
                destinationNumber={fieldName}
                entityType={
                  isTeam ? t('label.team-lowercase') : t('label.user-lowercase')
                }
                fieldName={[fieldName, 'config', 'receivers']}
                isDisabled={isViewMode}
                onSearch={isTeam ? getTeamOptions : getUserOptions}
              />
              <FieldError message={fieldState.error?.message} />
            </>
          )}
          rules={{
            validate: (receivers) =>
              !isEmpty(receivers) ||
              t('message.field-text-is-required', {
                fieldText: isTeam
                  ? t('label.team-lowercase')
                  : t('label.user-lowercase'),
              }),
          }}
        />
      </Grid.Item>
    );
  }

  return null;
}

export default DestinationConfigField;
