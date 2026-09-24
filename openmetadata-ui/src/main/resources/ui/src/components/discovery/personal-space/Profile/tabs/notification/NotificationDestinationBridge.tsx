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

import { cloneDeep, isEmpty, isEqual } from 'lodash';
import { ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import DestinationFormItem from '../../../../../Alerts/DestinationFormItem/DestinationFormItem.component';
import { DestinationFormItemProps } from '../../../../../Alerts/DestinationFormItem/DestinationFormItem.interface';
import type { ModifiedCreateEventSubscription } from './Notification.types';

export type DestinationFormFields = Pick<
  ModifiedCreateEventSubscription,
  'destinations' | 'readTimeout' | 'resources' | 'timeout'
>;

export type DestinationFormValidator = () => Promise<void>;

interface NotificationDestinationBridgeProps extends DestinationFormItemProps {
  onChange: (values: Partial<DestinationFormFields>) => void;
  renderValidationField?: (validate: DestinationFormValidator) => ReactNode;
  values: Partial<DestinationFormFields>;
}

function getDestinationFormFields(
  values: Partial<DestinationFormFields>
): Partial<DestinationFormFields> {
  return {
    resources: values.resources,
    destinations: values.destinations,
    timeout: values.timeout,
    readTimeout: values.readTimeout,
  };
}

function NotificationDestinationBridge({
  isRequired = true,
  isViewMode = false,
  onChange,
  renderValidationField,
  values,
}: Readonly<NotificationDestinationBridgeProps>) {
  const { t } = useTranslation();
  const methods = useForm<DestinationFormFields>({
    defaultValues: getDestinationFormFields(values),
    mode: 'onBlur',
  });
  const { getValues, reset, setError, trigger, watch } = methods;
  const { destinations, readTimeout, resources, timeout } = values;
  const normalizedValues = useMemo(
    () =>
      getDestinationFormFields({
        destinations,
        readTimeout,
        resources,
        timeout,
      }),
    [destinations, readTimeout, resources, timeout]
  );
  const latestValues = useRef(cloneDeep(normalizedValues));
  const latestOnChange = useRef(onChange);

  latestOnChange.current = onChange;

  useEffect(() => {
    const synchronizedValues = {
      ...normalizedValues,
      readTimeout:
        normalizedValues.readTimeout ?? latestValues.current.readTimeout,
      timeout: normalizedValues.timeout ?? latestValues.current.timeout,
    };

    if (isEqual(latestValues.current, synchronizedValues)) {
      return;
    }

    latestValues.current = cloneDeep(synchronizedValues);

    if (!isEqual(getDestinationFormFields(getValues()), synchronizedValues)) {
      reset(synchronizedValues);
    }
  }, [getValues, normalizedValues, reset]);

  useEffect(() => {
    const subscription = watch(() => {
      const nextValues = getDestinationFormFields(getValues());

      if (!isEqual(latestValues.current, nextValues)) {
        latestValues.current = cloneDeep(nextValues);
        latestOnChange.current(nextValues);
      }
    });

    return () => subscription.unsubscribe();
  }, [getValues, watch]);

  const validate = useCallback(async () => {
    const coreFormIsValid = await trigger();
    const isDestinationMissing =
      isRequired && isEmpty(getValues('destinations'));
    const minimumDestinationError = t('message.length-validator-error', {
      field: t('label.destination'),
      length: 1,
    });

    if (isDestinationMissing) {
      setError('destinations', {
        message: minimumDestinationError,
        type: 'manual',
      });

      throw new Error(minimumDestinationError);
    }

    if (!coreFormIsValid) {
      throw new Error();
    }
  }, [getValues, isRequired, setError, t, trigger]);

  return (
    <>
      {renderValidationField?.(validate)}
      <FormProvider {...methods}>
        <DestinationFormItem isRequired={isRequired} isViewMode={isViewMode} />
      </FormProvider>
    </>
  );
}

export default NotificationDestinationBridge;
