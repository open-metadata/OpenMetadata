/*
 *  Copyright 2026 Collate.
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
  Box,
  Button,
  Input,
  Select,
  Toggle,
} from '@openmetadata/ui-core-components';
import { Trash01 } from '@untitledui/icons';
import { isEqual, isUndefined, omitBy } from 'lodash';
import {
  ComponentProps,
  ComponentType,
  Fragment,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Key } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import {
  SubscriptionCategory,
  SubscriptionType,
} from '../../../generated/events/eventSubscription';
import { normalizeDestinationConfig } from '../../../utils/Alerts/AlertsUtilPure';
import AlertAiDestinationConfigFields from './AlertAiDestinationConfigFields.component';
import {
  ALERT_AI_DEFAULT_DOWNSTREAM_DEPTH,
  ALERT_AI_FORM_CLASS_NAMES,
} from './AlertAiFormFields.constants';
import { AlertAiDestinationItemProps } from './AlertAiFormFields.interface';
import {
  getDestinationTypeUpdate,
  getDestinationWithNotifyDownstream,
  getValidationPath,
  isInternalDestination,
  updateAlertAiValue,
} from './AlertAiFormFieldsPureUtils';
import {
  getDestinationCategoryItems,
  getSubscriptionItems,
  renderSelectItem,
} from './AlertAiFormFieldsSelectUtils';

type ComboBoxProps = ComponentProps<typeof Select.ComboBox> & {
  showSearchIcon?: boolean;
};

const ComboBox = Select.ComboBox as ComponentType<ComboBoxProps>;

/** Renders one destination row for add/edit and the read-only configuration tab. */
const AlertAiDestinationItem = ({
  destination,
  destinationsWithStatus,
  isViewOnly,
  isDestinationStatusLoading,
  name,
  onChange,
  remove,
  validationErrors,
  value,
}: AlertAiDestinationItemProps) => {
  const { t } = useTranslation();
  const destinationType = destination?.destinationType;
  const isInternal = isInternalDestination(destinationType);
  const notifyDownstream = Boolean(destination?.notifyDownstream);
  const destinationTypeError =
    validationErrors?.[
      getValidationPath('destinations', name, 'destinationType')
    ];
  const internalTypeError =
    validationErrors?.[getValidationPath('destinations', name, 'type')];
  const downstreamDepthError =
    validationErrors?.[
      getValidationPath('destinations', name, 'downstreamDepth')
    ];
  const destinationStatusDetails = useMemo(() => {
    const { category, config, type } = destination;

    return destinationsWithStatus?.find((statusDestination) =>
      isEqual(
        { category, config: omitBy(config, isUndefined), type },
        {
          category: statusDestination.category,
          config: normalizeDestinationConfig(statusDestination.config),
          type: statusDestination.type,
        }
      )
    )?.statusDetails;
  }, [destination, destinationsWithStatus]);
  const isSuccessStatus = destinationStatusDetails?.status === 'Success';
  const destinationStatusLabel = isSuccessStatus
    ? t('label.success')
    : t('label.failed');
  const [isStatusAlertDismissed, setIsStatusAlertDismissed] = useState(false);

  useEffect(() => {
    setIsStatusAlertDismissed(false);
  }, [destinationStatusDetails]);
  const subscriptionItems = useMemo(
    () => getSubscriptionItems(destinationType),
    [destinationType]
  );
  const destinationCategoryItems = useMemo(
    () => getDestinationCategoryItems(t),
    [t]
  );

  /** Rebuilds destination category/type fields to match OSS destination behavior. */
  const handleDestinationChange = (key: Key | null) => {
    const nextDestinationType = key ? String(key) : '';

    if (nextDestinationType.startsWith('header-')) {
      return;
    }

    updateAlertAiValue(
      value,
      onChange,
      ['destinations', name],
      getDestinationTypeUpdate(destination, nextDestinationType)
    );
  };

  const renderDestinationCategoryItem = (
    item: (typeof destinationCategoryItems)[number]
  ) => (
    <Select.Item
      className={
        item.isDisabled
          ? 'tw:cursor-default tw:text-xs tw:font-semibold tw:uppercase tw:tracking-wider tw:text-secondary tw:opacity-50'
          : 'tw:pl-3.5'
      }
      icon={item.icon}
      id={item.id}
      isDisabled={item.isDisabled}
      key={item.id}
      textValue={item.label ?? item.id}>
      {item.label ?? item.id}
    </Select.Item>
  );

  return (
    <Box
      className={ALERT_AI_FORM_CLASS_NAMES.destinationCard}
      data-testid={`destination-${name}`}
      direction="col"
      gap={4}>
      {isViewOnly && isInternal && destinationType ? (
        <div className={ALERT_AI_FORM_CLASS_NAMES.twoColumnGrid}>
          <div className={ALERT_AI_FORM_CLASS_NAMES.field}>
            <Select
              isDisabled
              data-testid={`destination-category-select-${name}`}
              fontSize="sm"
              hint={destinationTypeError}
              isInvalid={Boolean(destinationTypeError)}
              items={destinationCategoryItems}
              label={t('label.destination')}
              placeholder={t('label.select-field', {
                field: t('label.destination'),
              })}
              selectedKey={destinationType ?? null}
              size="sm">
              {renderDestinationCategoryItem}
            </Select>
          </div>
          <div className={ALERT_AI_FORM_CLASS_NAMES.field}>
            <Select
              isDisabled
              data-testid={`destination-type-select-${name}`}
              fontSize="sm"
              hint={internalTypeError}
              isInvalid={Boolean(internalTypeError)}
              items={subscriptionItems}
              label={t('label.type')}
              placeholder={t('label.select-field', {
                field: t('label.destination'),
              })}
              selectedKey={destination?.type ?? null}
              size="sm"
              onSelectionChange={(key) =>
                updateAlertAiValue(
                  value,
                  onChange,
                  ['destinations', name, 'type'],
                  key ? String(key) : undefined
                )
              }>
              {renderSelectItem}
            </Select>
          </div>
        </div>
      ) : (
        <div
          className={
            isViewOnly
              ? ALERT_AI_FORM_CLASS_NAMES.ruleControlGroupFull
              : ALERT_AI_FORM_CLASS_NAMES.ruleControlGroup
          }>
          <Box
            className={ALERT_AI_FORM_CLASS_NAMES.ruleControlRow}
            direction="row"
            gap={3}>
            <div className={ALERT_AI_FORM_CLASS_NAMES.fieldFill}>
              {isViewOnly ? (
                <Select
                  isDisabled
                  data-testid={`destination-category-select-${name}`}
                  fontSize="sm"
                  hint={destinationTypeError}
                  isInvalid={Boolean(destinationTypeError)}
                  items={destinationCategoryItems}
                  label={t('label.destination')}
                  placeholder={t('label.select-field', {
                    field: t('label.destination'),
                  })}
                  selectedKey={destinationType ?? null}
                  size="sm">
                  {renderDestinationCategoryItem}
                </Select>
              ) : (
                <ComboBox
                  allowsEmptyCollection
                  data-testid={`destination-category-select-${name}`}
                  fontSize="sm"
                  hint={destinationTypeError}
                  isInvalid={Boolean(destinationTypeError)}
                  items={destinationCategoryItems}
                  label={t('label.destination')}
                  placeholder={t('label.select-field', {
                    field: t('label.destination'),
                  })}
                  selectedKey={destinationType ?? null}
                  shortcut={false}
                  showSearchIcon={false}
                  size="sm"
                  onSelectionChange={handleDestinationChange}>
                  {renderDestinationCategoryItem}
                </ComboBox>
              )}
            </div>
            {!isViewOnly && (
              <Button
                className={ALERT_AI_FORM_CLASS_NAMES.removeButton}
                color="secondary"
                data-testid={`remove-destination-${name}`}
                iconLeading={Trash01}
                size="sm"
                onPress={() => remove?.(name)}
              />
            )}
          </Box>
        </div>
      )}
      {destinationType && (
        <Fragment>
          {isInternal && (
            <Fragment>
              {!isViewOnly && (
                <div className={ALERT_AI_FORM_CLASS_NAMES.ruleControlField}>
                  <Select
                    data-testid={`destination-type-select-${name}`}
                    fontSize="sm"
                    hint={internalTypeError}
                    isDisabled={isViewOnly}
                    isInvalid={Boolean(internalTypeError)}
                    items={subscriptionItems}
                    label={t('label.type')}
                    placeholder={t('label.select-field', {
                      field: t('label.destination'),
                    })}
                    selectedKey={destination?.type ?? null}
                    size="sm"
                    onSelectionChange={(key) =>
                      updateAlertAiValue(
                        value,
                        onChange,
                        ['destinations', name, 'type'],
                        key ? String(key) : undefined
                      )
                    }>
                    {renderSelectItem}
                  </Select>
                </div>
              )}
              {!isViewOnly && destinationType && destination?.type && (
                <Alert
                  closable
                  className={ALERT_AI_FORM_CLASS_NAMES.destinationAlert}
                  title={
                    destinationType === SubscriptionCategory.Owners &&
                    destination.type !== SubscriptionType.Email
                      ? t('message.destination-owner-selection-warning', {
                          subscriptionCategory: destinationType,
                          subscriptionType: destination.type,
                        })
                      : t('message.destination-selection-warning', {
                          subscriptionCategory: destinationType,
                          subscriptionType: destination.type,
                        })
                  }
                  variant="warning"
                />
              )}
            </Fragment>
          )}
          <div className={ALERT_AI_FORM_CLASS_NAMES.twoColumnGrid}>
            <AlertAiDestinationConfigFields
              destination={destination}
              isViewOnly={isViewOnly}
              name={name}
              validationErrors={validationErrors}
              value={value}
              onChange={onChange}
            />
          </div>
          <Toggle
            isDisabled={isViewOnly}
            isSelected={notifyDownstream}
            label={t('label.notify-downstream')}
            size="sm"
            onChange={(checked) => {
              updateAlertAiValue(
                value,
                onChange,
                ['destinations', name],
                getDestinationWithNotifyDownstream(destination, checked)
              );
            }}
          />
          {notifyDownstream && (
            <div
              className={ALERT_AI_FORM_CLASS_NAMES.downstreamDepthField}
              data-testid={`destination-downstream-depth-field-${name}`}>
              <Input
                data-testid={`destination-downstream-depth-${name}`}
                hint={downstreamDepthError}
                isDisabled={isViewOnly}
                isInvalid={Boolean(downstreamDepthError)}
                label={t('label.downstream-depth')}
                placeholder={t('label.downstream-depth')}
                size="sm"
                type="number"
                value={String(
                  destination?.downstreamDepth ??
                    ALERT_AI_DEFAULT_DOWNSTREAM_DEPTH
                )}
                onChange={(nextValue) =>
                  updateAlertAiValue(
                    value,
                    onChange,
                    ['destinations', name, 'downstreamDepth'],
                    Number(nextValue)
                  )
                }
              />
            </div>
          )}
          {isDestinationStatusLoading &&
            destination.category === SubscriptionCategory.External && (
              <div className="tw:h-8 tw:animate-pulse tw:rounded-lg tw:bg-secondary" />
            )}
          {!isDestinationStatusLoading &&
            !isUndefined(destinationStatusDetails) &&
            !isStatusAlertDismissed && (
              <Alert
                closable
                title={`${t('label.status')}: ${
                  destinationStatusDetails?.statusCode
                } ${destinationStatusLabel} ${
                  destinationStatusDetails?.reason ?? ''
                }`}
                variant={isSuccessStatus ? 'success' : 'error'}
                onClose={() => setIsStatusAlertDismissed(true)}
              />
            )}
        </Fragment>
      )}
    </Box>
  );
};

export default AlertAiDestinationItem;
