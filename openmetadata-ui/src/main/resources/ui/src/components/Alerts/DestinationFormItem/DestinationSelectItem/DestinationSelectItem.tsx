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
  Alert,
  Button,
  Grid,
  Input,
  Select,
  Toggle,
} from '@openmetadata/ui-core-components';
import { X } from '@untitledui/icons';
import { isEmpty, isEqual, isUndefined, startCase } from 'lodash';
import { useCallback, useMemo, useState } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import {
  Status,
  SubscriptionCategory,
  SubscriptionType,
} from '../../../../generated/events/eventSubscription';
import { getDestinationStatusAlertData } from '../../../../utils/Alerts/AlertsUtil';
import {
  getSubscriptionTypeOptions,
  normalizeDestinationConfig,
} from '../../../../utils/Alerts/AlertsUtilPure';
import {
  checkIfDestinationIsInternal,
  getConfigFieldFromDestinationType,
} from '../../../../utils/ObservabilityUtils';
import DestinationConfigField from './DestinationConfigField/DestinationConfigField';
import { DestinationSelectItemProps } from './DestinationSelectItem.interface';
import { buildGroupedOptions } from './DestinationSelectItem.utils';

function DestinationSelectItem({
  selectorKey,
  id,
  remove,
  destinationsWithStatus,
  isConfigExpanded,
  isDestinationStatusLoading,
  isViewMode = false,
  onConfigExpandedChange,
}: Readonly<DestinationSelectItemProps>) {
  const { t } = useTranslation();
  const { control, setValue, unregister } = useFormContext();

  const destinationItem =
    useWatch({ name: `destinations.${id}`, control }) ?? {};
  const [selectedSource = ''] = useWatch({ name: 'resources', control }) ?? [];
  const [isSelectionWarningDismissed, setIsSelectionWarningDismissed] =
    useState(false);

  const destinationType: string | undefined = destinationItem.destinationType;
  const subscriptionType: string | undefined = destinationItem.type;
  const notifyDownstream: boolean = destinationItem.notifyDownstream ?? false;

  const isInternalDestinationSelected = useMemo(
    () => checkIfDestinationIsInternal(destinationType ?? ''),
    [destinationType]
  );

  const groupedOptions = useMemo(
    () =>
      buildGroupedOptions(
        t('label.internal'),
        t('label.external'),
        selectedSource
      ),
    [selectedSource, t]
  );

  const destinationStatusDetails = useMemo(() => {
    const { type, category, config } = destinationItem;
    const current = destinationsWithStatus?.find((d) =>
      isEqual(
        { type, category, config: normalizeDestinationConfig(config) },
        {
          type: d.type,
          category: d.category,
          config: normalizeDestinationConfig(d.config),
        }
      )
    );

    return current?.statusDetails;
  }, [destinationItem, destinationsWithStatus]);

  const { statusLabel } = useMemo(
    () => getDestinationStatusAlertData(destinationStatusDetails?.status),
    [destinationStatusDetails]
  );

  const statusAlertVariant =
    destinationStatusDetails?.status === Status.Success ? 'success' : 'error';

  const handleDestinationTypeSelect = useCallback(
    (value: string | null) => {
      if (!value || value.startsWith('header-')) {
        return;
      }
      setIsSelectionWarningDismissed(false);
      const isInternal = checkIfDestinationIsInternal(value);
      const configField = getConfigFieldFromDestinationType(value);

      // Replacing a parent object does not remove values owned by mounted RHF
      // descendants. Unregister destination-specific fields first so changing
      // type cannot carry endpoint, receiver, or downstream values forward.
      unregister([
        `destinations.${id}.config`,
        `destinations.${id}.downstreamDepth`,
        `destinations.${id}.notifyDownstream`,
        `destinations.${id}.type`,
      ]);
      setValue(
        `destinations.${id}`,
        {
          destinationType: value,
          category: isInternal ? value : SubscriptionCategory.External,
          type: isInternal ? undefined : value,
          config: configField ? { [configField]: true } : undefined,
          downstreamDepth: undefined,
          notifyDownstream: undefined,
        },
        {
          shouldDirty: true,
          shouldValidate: true,
        }
      );
    },
    [id, setValue, unregister]
  );

  const handleNotifyDownstreamChange = useCallback(
    (checked: boolean) => {
      if (!checked) {
        setValue(`destinations.${id}.downstreamDepth`, undefined);
      }
    },
    [id, setValue]
  );

  const hasDestinationType = destinationType !== undefined;
  const showExternalDestinationConfig =
    hasDestinationType && !isInternalDestinationSelected;
  const showInternalDestinationSection =
    hasDestinationType && isInternalDestinationSelected;
  const showTeamOrUserConfig =
    destinationType === SubscriptionCategory.Teams ||
    destinationType === SubscriptionCategory.Users;
  const showSelectionWarning = Boolean(
    destinationType && subscriptionType && !isSelectionWarningDismissed
  );
  const isOwnerNonEmailSelection =
    destinationType === SubscriptionCategory.Owners &&
    subscriptionType !== SubscriptionType.Email;
  const selectionWarningTitle = isOwnerNonEmailSelection
    ? t('message.destination-owner-selection-warning', {
        subscriptionCategory: destinationType,
        subscriptionType,
      })
    : t('message.destination-selection-warning', {
        subscriptionCategory: destinationType,
        subscriptionType,
      });

  return (
    <div
      className="tw:flex tw:gap-4"
      data-testid={`destination-${id}`}
      key={selectorKey}>
      <div className="tw:min-w-0 tw:flex-1">
        <Grid colGap="2" rowGap="4">
          <Grid.Item span={24}>
            <Controller
              control={control}
              name={`destinations.${id}.destinationType`}
              render={({ fieldState }) => (
                <div>
                  <Select.ComboBox
                    isRequired
                    data-testid={`destination-category-select-${id}`}
                    fontSize="sm"
                    isDisabled={isViewMode}
                    items={groupedOptions}
                    placeholder={t('label.select-field', {
                      field: t('label.destination'),
                    })}
                    selectedKey={destinationType ?? null}
                    shortcut={false}
                    showSearchIcon={false}
                    size="sm"
                    onSelectionChange={(key) =>
                      handleDestinationTypeSelect(key as string)
                    }>
                    {(item) => (
                      <Select.Item
                        className={
                          item.isDisabled
                            ? 'tw:cursor-default tw:text-xs tw:font-semibold tw:uppercase tw:tracking-wider tw:text-secondary tw:opacity-50 '
                            : 'tw:pl-3.5'
                        }
                        icon={item.icon}
                        id={item.id}
                        textValue={item.label ?? ''}>
                        {item.label}
                      </Select.Item>
                    )}
                  </Select.ComboBox>
                  {fieldState.error?.message && (
                    <p className="tw:mt-1 tw:text-sm tw:text-fg-error-secondary">
                      {fieldState.error.message}
                    </p>
                  )}
                </div>
              )}
              rules={{
                required: t('message.field-text-is-required', {
                  fieldText: t('label.destination'),
                }),
              }}
            />
          </Grid.Item>

          {showExternalDestinationConfig && (
            <DestinationConfigField
              fieldName={id}
              isConfigExpanded={isConfigExpanded}
              isViewMode={isViewMode}
              key={destinationType}
              type={destinationType as SubscriptionType}
              onConfigExpandedChange={onConfigExpandedChange}
            />
          )}

          {showInternalDestinationSection && (
            <>
              {showTeamOrUserConfig && (
                <DestinationConfigField
                  fieldName={id}
                  isConfigExpanded={isConfigExpanded}
                  isViewMode={isViewMode}
                  key={destinationType}
                  type={destinationType as SubscriptionCategory}
                  onConfigExpandedChange={onConfigExpandedChange}
                />
              )}

              <Grid.Item span={24}>
                <Controller
                  control={control}
                  name={`destinations.${id}.type`}
                  render={({ field, fieldState }) => (
                    <div>
                      <Select
                        isRequired
                        data-testid={`destination-type-select-${id}`}
                        isDisabled={isViewMode}
                        placeholder={t('label.select-field', {
                          field: t('label.destination'),
                        })}
                        selectedKey={field.value ?? null}
                        onSelectionChange={(key) => {
                          setIsSelectionWarningDismissed(false);
                          field.onChange(key);
                        }}>
                        {getSubscriptionTypeOptions(destinationType).map(
                          (option) => (
                            <Select.Item
                              id={option.value}
                              isDisabled={option.disabled}
                              key={option.value}
                              textValue={startCase(option.value)}>
                              {startCase(option.value)}
                            </Select.Item>
                          )
                        )}
                      </Select>
                      {fieldState.error?.message && (
                        <p className="tw:mt-1 tw:text-sm tw:text-fg-error-secondary">
                          {fieldState.error.message}
                        </p>
                      )}
                    </div>
                  )}
                  rules={{
                    required: t('message.field-text-is-required', {
                      fieldText: t('label.field'),
                    }),
                  }}
                />
              </Grid.Item>

              {showSelectionWarning && (
                <Grid.Item span={24}>
                  <Alert
                    closable
                    title={selectionWarningTitle}
                    variant="warning"
                    onClose={() => setIsSelectionWarningDismissed(true)}
                  />
                </Grid.Item>
              )}
            </>
          )}

          {!isEmpty(destinationItem) && (
            <Grid.Item span={24}>
              <Controller
                control={control}
                name={`destinations.${id}.notifyDownstream`}
                render={({ field }) => (
                  <Toggle
                    isDisabled={isViewMode}
                    isSelected={field.value ?? false}
                    label={t('label.notify-downstream')}
                    onChange={(checked) => {
                      field.onChange(checked);
                      handleNotifyDownstreamChange(checked);
                    }}
                  />
                )}
              />
            </Grid.Item>
          )}

          {notifyDownstream && (
            <Grid.Item span={24}>
              <Controller
                control={control}
                defaultValue={1}
                name={`destinations.${id}.downstreamDepth`}
                render={({ field, fieldState }) => (
                  <div>
                    <Input
                      data-testid={`destination-downstream-depth-${id}`}
                      inputDataTestId={`destination-downstream-depth-input-${id}`}
                      isDisabled={isViewMode}
                      label={t('label.downstream-depth')}
                      ref={field.ref}
                      type="number"
                      value={
                        field.value !== undefined ? String(field.value) : ''
                      }
                      onBlur={() => field.onBlur()}
                      onChange={(val) => field.onChange(val)}
                    />
                    {fieldState.error?.message && (
                      <p className="tw:mt-1 tw:text-sm tw:text-fg-error-secondary">
                        {fieldState.error.message}
                      </p>
                    )}
                  </div>
                )}
                rules={{
                  required: t('message.field-text-is-required', {
                    fieldText: t('label.downstream-depth'),
                  }),
                  validate: (value) => {
                    const numVal = Number(value);

                    return !Number.isFinite(numVal) || numVal <= 0
                      ? t('message.value-must-be-greater-than', {
                          field: t('label.downstream-depth'),
                          minimum: 0,
                        })
                      : true;
                  },
                }}
              />
            </Grid.Item>
          )}

          {isDestinationStatusLoading &&
            destinationItem.category === SubscriptionCategory.External && (
              <Grid.Item span={24}>
                <div className="tw:h-8 tw:animate-pulse tw:rounded-lg tw:bg-secondary" />
              </Grid.Item>
            )}

          {!isDestinationStatusLoading &&
            !isUndefined(destinationStatusDetails) && (
              <Grid.Item span={24}>
                <Alert
                  closable
                  title={`${t('label.status')}: ${
                    destinationStatusDetails?.statusCode
                  } ${statusLabel} ${destinationStatusDetails?.reason ?? ''}`}
                  variant={statusAlertVariant}
                />
              </Grid.Item>
            )}
        </Grid>
      </div>

      {!isViewMode && (
        <Button
          data-icon
          color="tertiary"
          data-testid={`remove-destination-${id}`}
          onPress={() => remove(id)}>
          <X />
        </Button>
      )}
    </div>
  );
}

export default DestinationSelectItem;
