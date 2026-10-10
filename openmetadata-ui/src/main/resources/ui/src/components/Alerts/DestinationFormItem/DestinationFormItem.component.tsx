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
import { get, isEmpty } from 'lodash';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Controller,
  useFieldArray,
  useFormContext,
  useWatch,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { DEFAULT_READ_TIMEOUT } from '../../../constants/Alerts.constants';
import type { Destination } from '../../../generated/events/eventSubscription';
import { useAlertSelectionContext } from '../../../hooks/useAlertSelection';
import type { ModifiedDestination } from '../../../pages/AddObservabilityPage/AddObservabilityPage.interface';
import { testAlertDestination } from '../../../rest/alertsAPI';
import {
  getDestinationsWithTestStatus,
  getFormattedDestinations,
} from '../../../utils/Alerts/AlertsUtilPure';
import { showErrorToast } from '../../../utils/ToastUtils';
import { DESTINATIONS_MIN_COUNT_ERROR_PATH } from './DestinationFormItem.constants';
import { DestinationFormItemProps } from './DestinationFormItem.interface';
import {
  alignDestinationsWithTestStatus,
  getTestableExternalDestinations,
  hasExternalDestination,
} from './DestinationFormItem.utils';
import DestinationSelectItem from './DestinationSelectItem/DestinationSelectItem';

function DestinationFormItem({
  isViewMode = false,
}: Readonly<DestinationFormItemProps>) {
  const { t } = useTranslation();
  const { control, clearErrors, formState, trigger } = useFormContext();

  const { fields, append, remove } = useFieldArray({
    name: 'destinations',
    control,
  });

  const [destinationsWithStatus, setDestinationsWithStatus] =
    useState<(Destination | undefined)[]>();
  const [isDestinationStatusLoading, setIsDestinationStatusLoading] =
    useState(false);
  // Nested header/query-param arrays can remount a destination row. Keeping
  // expansion here preserves the user's open panel across those updates.
  const [expandedDestinationConfigs, setExpandedDestinationConfigs] = useState<
    Set<number>
  >(new Set());

  const { sources } = useAlertSelectionContext();
  const destinations: ModifiedDestination[] =
    (useWatch({ name: 'destinations', control }) as ModifiedDestination[]) ??
    [];

  // Submit owns required validation; this only removes its stale error after
  // the user adds a destination, avoiding an error on untouched create forms.
  // The minimum-count error lives under the `root.*` namespace, so clearing it
  // never wipes nested per-destination field errors (e.g.
  // `destinations.0.config.receivers`) surfaced by `trigger('destinations')`.
  useEffect(() => {
    if (fields.length > 0) {
      clearErrors(DESTINATIONS_MIN_COUNT_ERROR_PATH);
    }
  }, [fields.length, clearErrors]);

  const isExternalDestinationSelected = useMemo(
    () => hasExternalDestination(destinations),
    [destinations]
  );

  const disableTestDestinationButton = useMemo(
    () => isEmpty(sources) || !isExternalDestinationSelected,
    [sources, isExternalDestinationSelected]
  );

  const handleDestinationConfigExpandedChange = useCallback(
    (index: number, isExpanded: boolean) => {
      setExpandedDestinationConfigs((current) => {
        const updated = new Set(current);
        if (isExpanded) {
          updated.add(index);
        } else {
          updated.delete(index);
        }

        return updated;
      });
    },
    []
  );

  const handleRemoveDestination = useCallback(
    (index: number) => {
      remove(index);
      // Destination indexes shift after removal, so stale UI-only expansion
      // state must not be applied to a different destination.
      setExpandedDestinationConfigs(new Set());
    },
    [remove]
  );

  const handleTestDestinationClick = useCallback(async () => {
    try {
      setIsDestinationStatusLoading(true);
      const formattedDestinations = getFormattedDestinations(destinations);
      const externalDestinations = getTestableExternalDestinations(
        formattedDestinations
      );
      if (isEmpty(externalDestinations)) {
        setDestinationsWithStatus(undefined);
        await trigger('destinations');

        return;
      }
      const results = await testAlertDestination({
        destinations: externalDestinations,
      });
      setDestinationsWithStatus(
        alignDestinationsWithTestStatus(
          formattedDestinations,
          getDestinationsWithTestStatus(externalDestinations, results)
        )
      );
    } catch (e) {
      showErrorToast(e as AxiosError);
    } finally {
      setIsDestinationStatusLoading(false);
    }
  }, [destinations, trigger]);

  const destinationListError = (
    get(formState.errors, DESTINATIONS_MIN_COUNT_ERROR_PATH) as
      | { message?: string }
      | undefined
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
              defaultValue={10}
              name="timeout"
              render={({ field, fieldState }) => (
                <Input
                  hint={fieldState.error?.message}
                  inputDataTestId="connection-timeout-input"
                  isDisabled={isViewMode}
                  isInvalid={Boolean(fieldState.error)}
                  placeholder={`${t('label.connection-timeout')} (${t(
                    'label.second-plural'
                  )})`}
                  ref={field.ref}
                  type="number"
                  value={field.value === undefined ? '' : String(field.value)}
                  onBlur={field.onBlur}
                  onChange={(val) =>
                    field.onChange(val === '' ? undefined : Number(val))
                  }
                />
              )}
              rules={{
                required: t('label.field-required', {
                  field: t('label.connection-timeout'),
                }),
                validate: (v) =>
                  (Number.isInteger(Number(v)) && Number(v) > 0) ||
                  t('label.field-invalid', {
                    field: t('label.connection-timeout'),
                  }),
              }}
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
              defaultValue={DEFAULT_READ_TIMEOUT}
              name="readTimeout"
              render={({ field, fieldState }) => (
                <Input
                  hint={fieldState.error?.message}
                  inputDataTestId="read-timeout-input"
                  isDisabled={isViewMode}
                  isInvalid={Boolean(fieldState.error)}
                  placeholder={`${t('label.read-type', {
                    type: t('label.timeout'),
                  })} (${t('label.second-plural')})`}
                  ref={field.ref}
                  type="number"
                  value={field.value === undefined ? '' : String(field.value)}
                  onBlur={field.onBlur}
                  onChange={(val) =>
                    field.onChange(val === '' ? undefined : Number(val))
                  }
                />
              )}
              rules={{
                required: t('label.field-required', {
                  field: t('label.read-type', { type: t('label.timeout') }),
                }),
                validate: (v) =>
                  (Number.isInteger(Number(v)) && Number(v) > 0) ||
                  t('label.field-invalid', {
                    field: t('label.read-type', { type: t('label.timeout') }),
                  }),
              }}
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
                <DestinationSelectItem
                  destinationsWithStatus={destinationsWithStatus}
                  id={index}
                  isConfigExpanded={expandedDestinationConfigs.has(index)}
                  isDestinationStatusLoading={isDestinationStatusLoading}
                  isViewMode={isViewMode}
                  remove={handleRemoveDestination}
                  selectorKey={index}
                  onConfigExpandedChange={(isExpanded) =>
                    handleDestinationConfigExpandedChange(index, isExpanded)
                  }
                />
                {index < fields.length - 1 && <Divider />}
              </Fragment>
            ))}
          </Grid.Item>

          {destinationListError && (
            <Grid.Item span={24}>
              <Typography
                as="p"
                className="tw:text-error-primary"
                size="text-sm">
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
                  isDisabled={isEmpty(sources)}
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

export default DestinationFormItem;
