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

import { isEmpty, isEqual } from 'lodash';
import { ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { ModifiedCreateEventSubscription } from '../../../pages/AddObservabilityPage/AddObservabilityPage.interface';
import DestinationFormItem from './DestinationFormItem.component';
import { DestinationFormItemProps } from './DestinationFormItem.interface';

export type DestinationFormFields = Pick<
  ModifiedCreateEventSubscription,
  'destinations' | 'readTimeout' | 'resources' | 'timeout'
>;

export type DestinationFormValidator = () => Promise<void>;

interface DestinationFormItemFormBridgeProps extends DestinationFormItemProps {
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

// Legacy form adapters need a mounted field to run the shared validator, while
// the visible control and its field-level errors stay in the core-UI form.
export function DestinationFormFieldRegistrar() {
  return <input readOnly aria-hidden="true" tabIndex={-1} type="hidden" />;
}

function DestinationFormItemFormBridge({
  isRequired = true,
  isViewMode = false,
  onChange,
  renderValidationField,
  values,
}: Readonly<DestinationFormItemFormBridgeProps>) {
  const { t } = useTranslation();
  const methods = useForm<DestinationFormFields>({
    defaultValues: getDestinationFormFields(values),
  });
  const { getValues, reset, trigger, watch } = methods;
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
  const latestValues = useRef(normalizedValues);
  const latestOnChange = useRef(onChange);

  // Legacy form boundaries create adapter props inline. Keeping their latest
  // values in refs prevents unrelated parent renders from replacing the RHF
  // subscription or re-running its reset guard.
  latestValues.current = normalizedValues;
  latestOnChange.current = onChange;

  useEffect(() => {
    if (!isEqual(getDestinationFormFields(getValues()), normalizedValues)) {
      reset(normalizedValues);
    }
  }, [getValues, normalizedValues, reset]);

  useEffect(() => {
    const subscription = watch(() => {
      const nextValues = getDestinationFormFields(getValues());

      if (!isEqual(latestValues.current, nextValues)) {
        latestOnChange.current(nextValues);
      }
    });

    return () => subscription.unsubscribe();
  }, [getValues, watch]);

  const validate = useCallback(async () => {
    const coreFormIsValid = await trigger();
    if (
      (!isRequired || !isEmpty(getValues('destinations'))) &&
      coreFormIsValid
    ) {
      return;
    }

    throw new Error(
      t('message.minimum-count-error', {
        field: t('label.destination'),
        count: 1,
      })
    );
  }, [getValues, isRequired, t, trigger]);

  return (
    <>
      {renderValidationField?.(validate)}
      <FormProvider {...methods}>
        <DestinationFormItem isRequired={isRequired} isViewMode={isViewMode} />
      </FormProvider>
    </>
  );
}

export default DestinationFormItemFormBridge;
