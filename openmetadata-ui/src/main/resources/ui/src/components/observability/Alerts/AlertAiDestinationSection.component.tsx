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
  Box,
  Button,
  Input,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { isEmpty, isNil, isUndefined } from 'lodash';
import { DEFAULT_READ_TIMEOUT } from '../../../constants/Alerts.constants';
import {
  Destination,
  SubscriptionCategory,
} from '../../../generated/events/eventSubscription';
import { testAlertDestination } from '../../../rest/alertsAPI';
import { getFormattedDestinations } from '../../../utils/Alerts/AlertsUtilPure';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AlertAiDestinationItem from './AlertAiDestinationItem.component';
import {
  ALERT_AI_DEFAULT_CONNECTION_TIMEOUT,
  ALERT_AI_FORM_CLASS_NAMES,
  EMPTY_ALERT_AI_DESTINATION,
} from './AlertAiFormFields.constants';
import { AlertAiDestinationSectionProps } from './AlertAiFormFields.interface';
import {
  hasExternalDestinationConfig,
  updateAlertAiValue,
} from './AlertAiFormFieldsPureUtils';
import AlertAiSection from './AlertAiSection.component';

/** Renders destination timeout fields and the destination list for alert add/edit/view. */
const AlertAiDestinationSection = ({
  isViewOnly,
  onChange,
  selectedSource,
  validationErrors,
  value,
}: AlertAiDestinationSectionProps) => {
  const { t } = useTranslation();
  const destinations = value.destinations ?? [];
  const destinationError = validationErrors?.destinations;
  const hasExternalDestination = hasExternalDestinationConfig(destinations);
  const [destinationsWithStatus, setDestinationsWithStatus] =
    useState<Destination[]>();
  const [isDestinationStatusLoading, setIsDestinationStatusLoading] =
    useState(false);
  const isTestDestinationDisabled =
    isEmpty(selectedSource) || isNil(selectedSource) || !hasExternalDestination;

  const handleTestDestination = useCallback(async () => {
    try {
      setIsDestinationStatusLoading(true);
      const formattedDestinations = getFormattedDestinations(destinations);

      if (!isUndefined(formattedDestinations)) {
        const externalDestinations = formattedDestinations.filter(
          (destination) =>
            destination.category === SubscriptionCategory.External &&
            !isEmpty(destination.config)
        );
        const results = await testAlertDestination({
          destinations: externalDestinations,
        });

        setDestinationsWithStatus(results);
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsDestinationStatusLoading(false);
    }
  }, [destinations]);

  return (
    <AlertAiSection
      description={t('message.alerts-destination-description')}
      isRequired={!isViewOnly}
      title={t('label.destination')}>
      <Box
        className={ALERT_AI_FORM_CLASS_NAMES.sectionCard}
        direction="col"
        gap={4}>
        <div className={ALERT_AI_FORM_CLASS_NAMES.twoColumnGrid}>
          <div className={ALERT_AI_FORM_CLASS_NAMES.field}>
            <Input
              data-testid="connection-timeout-input"
              isDisabled={isViewOnly}
              label={`${t('label.connection-timeout')} (${t(
                'label.second-plural'
              )})`}
              placeholder={`${t('label.connection-timeout')} (${t(
                'label.second-plural'
              )})`}
              size="sm"
              type="number"
              value={String(
                value.timeout ?? ALERT_AI_DEFAULT_CONNECTION_TIMEOUT
              )}
              onChange={(nextValue) =>
                updateAlertAiValue(
                  value,
                  onChange,
                  ['timeout'],
                  Number(nextValue)
                )
              }
            />
          </div>
          <div className={ALERT_AI_FORM_CLASS_NAMES.field}>
            <Input
              data-testid="read-timeout-input"
              isDisabled={isViewOnly}
              label={`${t('label.read-type', {
                type: t('label.timeout'),
              })} (${t('label.second-plural')})`}
              placeholder={`${t('label.read-type', {
                type: t('label.timeout'),
              })} (${t('label.second-plural')})`}
              size="sm"
              type="number"
              value={String(value.readTimeout ?? DEFAULT_READ_TIMEOUT)}
              onChange={(nextValue) =>
                updateAlertAiValue(
                  value,
                  onChange,
                  ['readTimeout'],
                  Number(nextValue)
                )
              }
            />
          </div>
        </div>
        <Box data-testid="destination-list" direction="col" gap={4}>
          {destinations.map((destination, index) => (
            <AlertAiDestinationItem
              destination={destination}
              destinationsWithStatus={destinationsWithStatus}
              isDestinationStatusLoading={isDestinationStatusLoading}
              isViewOnly={isViewOnly}
              key={`${destination.destinationType ?? 'destination'}-${index}`}
              name={index}
              remove={(destinationIndex) =>
                updateAlertAiValue(
                  value,
                  onChange,
                  ['destinations'],
                  destinations.filter((_, i) => i !== destinationIndex)
                )
              }
              selectedSource={selectedSource}
              validationErrors={validationErrors}
              value={value}
              onChange={onChange}
            />
          ))}
          {!isViewOnly && (
            <Box gap={2}>
              <Button
                className={ALERT_AI_FORM_CLASS_NAMES.actionButton}
                color="secondary"
                data-testid="add-destination-button"
                isDisabled={isEmpty(selectedSource) || isNil(selectedSource)}
                size="sm"
                onPress={() =>
                  updateAlertAiValue(
                    value,
                    onChange,
                    ['destinations'],
                    [...destinations, EMPTY_ALERT_AI_DESTINATION]
                  )
                }>
                {t('label.add-entity', {
                  entity: t('label.destination'),
                })}
              </Button>
              <Button
                className={ALERT_AI_FORM_CLASS_NAMES.actionButton}
                color="secondary"
                data-testid="test-destination-button"
                isDisabled={isTestDestinationDisabled}
                isLoading={isDestinationStatusLoading}
                size="sm"
                onPress={handleTestDestination}>
                {t('label.test-entity', {
                  entity: t('label.destination-plural'),
                })}
              </Button>
            </Box>
          )}
          {destinationError && (
            <Typography className="tw:text-error-primary" size="text-sm">
              {destinationError}
            </Typography>
          )}
        </Box>
      </Box>
    </AlertAiSection>
  );
};

export default AlertAiDestinationSection;
