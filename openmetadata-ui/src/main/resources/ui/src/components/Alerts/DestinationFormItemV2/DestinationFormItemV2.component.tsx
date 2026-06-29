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
  Button,
  Card,
  Divider,
  Grid,
  Input,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { isEmpty, isNil, isUndefined } from 'lodash';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Controller,
  useFieldArray,
  useFormContext,
  useWatch,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import {
  DEFAULT_READ_TIMEOUT,
  EXTERNAL_CATEGORY_OPTIONS,
} from '../../../constants/Alerts.constants';
import type { ModifiedDestination } from '../../../pages/AddObservabilityPage/AddObservabilityPage.interface';
import { testAlertDestination } from '../../../rest/alertsAPI';
import { getFormattedDestinations } from '../../../utils/Alerts/AlertsUtilPure';
import { showErrorToast } from '../../../utils/ToastUtils';
import { DestinationFormItemV2Props } from './DestinationFormItemV2.interface';
import DestinationSelectItemV2 from './DestinationSelectItemV2/DestinationSelectItemV2';

function DestinationFormItemV2({
  isViewMode = false,
}: Readonly<DestinationFormItemV2Props>) {
  const { t } = useTranslation();
  const { control, setError, clearErrors, formState } = useFormContext();

  const { fields, append, remove } = useFieldArray({
    name: 'destinations',
    control,
  });

  const [destinationsWithStatus, setDestinationsWithStatus] =
    useState<ModifiedDestination[]>();
  const [isDestinationStatusLoading, setIsDestinationStatusLoading] =
    useState(false);

  const selectedResources: string[] =
    useWatch({ name: 'resources', control }) ?? [];
  const destinations: ModifiedDestination[] =
    (useWatch({ name: 'destinations', control }) as ModifiedDestination[]) ??
    [];

  const selectedSource = selectedResources[0];

  useEffect(() => {
    if (fields.length === 0) {
      setError('destinations', {
        type: 'manual',
        message: t('message.minimum-count-error', {
          field: t('label.destination'),
          count: 1,
        }),
      });
    } else {
      clearErrors('destinations');
    }
  }, [fields.length, setError, clearErrors, t]);

  const isExternalDestinationSelected = useMemo(
    () =>
      destinations.some((destination) => {
        const externalDestinationTypes = EXTERNAL_CATEGORY_OPTIONS.map(
          (o) => o.value
        );

        return (
          destination.category === 'External' &&
          externalDestinationTypes.includes(destination.type ?? '')
        );
      }),
    [destinations]
  );

  const disableTestDestinationButton = useMemo(
    () =>
      isEmpty(selectedSource) ||
      isNil(selectedSource) ||
      !isExternalDestinationSelected,
    [selectedSource, isExternalDestinationSelected]
  );

  const handleTestDestinationClick = useCallback(async () => {
    try {
      setIsDestinationStatusLoading(true);
      const formattedDestinations = getFormattedDestinations(destinations);
      if (!isUndefined(formattedDestinations)) {
        const externalDestinations = formattedDestinations.filter(
          (d) => d.category === 'External' && !isEmpty(d?.config)
        );
        const results = await testAlertDestination({
          destinations: externalDestinations,
        });
        setDestinationsWithStatus(results as ModifiedDestination[]);
      }
    } catch (e) {
      showErrorToast(e as AxiosError);
    } finally {
      setIsDestinationStatusLoading(false);
    }
  }, [destinations]);

  const destinationListError = (
    formState.errors.destinations as { message?: string } | undefined
  )?.message;

  return (
    <Card variant="default">
      <Card.Header
        subtitle={t('message.alerts-destination-description')}
        title={t('label.destination')}
      />
      <Card.Content>
        <Grid colGap="4" rowGap="4">
          <Grid.Item span={7}>
            <Typography as="span" size="text-sm">
              {`${t('label.connection-timeout')} (${t('label.second-plural')})`}
            </Typography>
          </Grid.Item>
          <Grid.Item span={1}>
            <Typography as="span" size="text-sm">
              :
            </Typography>
          </Grid.Item>
          <Grid.Item data-testid="connection-timeout" span={16}>
            <Controller
              control={control}
              name="timeout"
              render={({ field }) => (
                <Input
                  data-testid="connection-timeout-input"
                  defaultValue="10"
                  inputDataTestId="connection-timeout-input-field"
                  placeholder={`${t('label.connection-timeout')} (${t(
                    'label.second-plural'
                  )})`}
                  ref={field.ref}
                  type="number"
                  value={field.value !== undefined ? String(field.value) : ''}
                  onBlur={field.onBlur}
                  onChange={(val) => field.onChange(val)}
                />
              )}
            />
          </Grid.Item>

          <Grid.Item span={7}>
            <Typography as="span" size="text-sm">
              {`${t('label.read-type', { type: t('label.timeout') })} (${t(
                'label.second-plural'
              )})`}
            </Typography>
          </Grid.Item>
          <Grid.Item span={1}>
            <Typography as="span" size="text-sm">
              :
            </Typography>
          </Grid.Item>
          <Grid.Item data-testid="read-timeout" span={16}>
            <Controller
              control={control}
              name="readTimeout"
              render={({ field }) => (
                <Input
                  data-testid="read-timeout-input"
                  defaultValue={String(DEFAULT_READ_TIMEOUT)}
                  inputDataTestId="read-timeout-input-field"
                  placeholder={`${t('label.read-type', {
                    type: t('label.timeout'),
                  })} (${t('label.second-plural')})`}
                  ref={field.ref}
                  type="number"
                  value={field.value !== undefined ? String(field.value) : ''}
                  onBlur={field.onBlur}
                  onChange={(val) => field.onChange(val)}
                />
              )}
            />
          </Grid.Item>

          <Grid.Item span={24}>
            <Divider />
          </Grid.Item>

          <Grid.Item
            className="tw:flex tw:flex-col tw:gap-4"
            data-testid="destination-list"
            span={24}>
            {fields.map(({ id: fieldId }, index) => (
              <Fragment key={fieldId}>
                <DestinationSelectItemV2
                  destinationsWithStatus={destinationsWithStatus}
                  id={index}
                  isDestinationStatusLoading={isDestinationStatusLoading}
                  isViewMode={isViewMode}
                  remove={remove}
                  selectorKey={index}
                />
                {index < fields.length - 1 && <Divider />}
              </Fragment>
            ))}
          </Grid.Item>

          {destinationListError && (
            <Grid.Item span={24}>
              <Typography as="p" size="text-sm">
                {destinationListError}
              </Typography>
            </Grid.Item>
          )}

          {!isViewMode && (
            <Grid.Item span={24}>
              <div className="tw:flex tw:gap-4">
                <Button
                  color="primary"
                  data-testid="add-destination-button"
                  isDisabled={isEmpty(selectedSource) || isNil(selectedSource)}
                  onPress={() => append({})}>
                  {t('label.add-entity', { entity: t('label.destination') })}
                </Button>
                <Tooltip
                  placement="right"
                  title={t('message.external-destination-selection')}>
                  <Button
                    color="secondary"
                    data-testid="test-destination-button"
                    isDisabled={disableTestDestinationButton}
                    onPress={handleTestDestinationClick}>
                    {t('label.test-entity', {
                      entity: t('label.destination-plural'),
                    })}
                  </Button>
                </Tooltip>
              </div>
            </Grid.Item>
          )}
        </Grid>
      </Card.Content>
    </Card>
  );
}

export default DestinationFormItemV2;
